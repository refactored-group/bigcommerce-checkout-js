import {
  Address,
  AddressRequestBody,
  Cart,
  CheckoutSelectors,
  Consignment,
  ConsignmentAssignmentRequestBody,
  ConsignmentsRequestBody,
  ConsignmentUpdateRequestBody,
} from '@bigcommerce/checkout-sdk';
import { isEqual } from 'lodash';

import { matchesPickup, pickupCartSignature } from '../pickup/pickup';

import {
  CheckoutHandoffClient,
  CheckoutHandoffContext,
  CheckoutHandoffIntent,
  CheckoutHandoffPublisher,
  createCheckoutHandoffPublisher,
  isSameCheckoutHandoffDestination,
} from './checkoutHandoff';

export interface FflDestinationAssignment {
  address: AddressRequestBody;
  itemIds: string[];
}

export interface FflReconciliationPlan {
  assignments: FflDestinationAssignment[];
  cartId: string;
  handoff?: CheckoutHandoffIntent;
  unassignedItemIds: string[];
}

export type FflCoordinatorResult =
  | { status: 'fulfilled'; checkoutState: CheckoutSelectors }
  | { status: 'superseded' }
  | {
      status: 'failed';
      kind: 'assign' | 'unassign' | 'internal';
      error: unknown;
    };

export interface FflConsignmentCoordinator {
  suspendShipping(): Promise<void>;
  resumeShipping(): void;
  selectPickup(cartId: string, signature: string, methodId: number, eligibleMethodIds: number[], handoff?: CheckoutHandoffIntent): Promise<FflCoordinatorResult>;
  reconcile(plan: FflReconciliationPlan): Promise<FflCoordinatorResult>;
  clearAll(cartId: string, handoff?: CheckoutHandoffIntent): Promise<FflCoordinatorResult>;
  configureHandoff(context: CheckoutHandoffContext): void;
  deactivateHandoff(): void;
  dispose(): void;
}

export const synchronizeCheckoutHandoffPresence = (
  coordinator: FflConsignmentCoordinator,
  cart: Pick<Cart, 'id'> | undefined,
  storeHash: string,
  hasFflRelatedItems: boolean,
): void => {
  if (!cart) {
    return;
  }

  coordinator.configureHandoff({ cartId: cart.id, storeHash });

  if (!hasFflRelatedItems) {
    coordinator.deactivateHandoff();
  }
};

interface FflConsignmentCoordinatorDependencies {
  createConsignments?(consignments: ConsignmentsRequestBody): Promise<CheckoutSelectors>;
  updateConsignment?(consignment: ConsignmentUpdateRequestBody): Promise<CheckoutSelectors>;
  assignItemsToAddress(consignment: ConsignmentAssignmentRequestBody): Promise<CheckoutSelectors>;
  deleteConsignment(consignmentId: string): Promise<CheckoutSelectors>;
  getState(): CheckoutSelectors;
  handoffClient?: CheckoutHandoffClient;
  handoffPublisher?: CheckoutHandoffPublisher;
  onHandoffError?(error: Error): void;
  refreshCheckout?(cartId: string): Promise<CheckoutSelectors>;
  unassignItemsToAddress(consignment: ConsignmentAssignmentRequestBody): Promise<CheckoutSelectors>;
}

interface FflCheckoutSnapshot {
  cart: Cart;
  checkoutState: CheckoutSelectors;
  consignments: Consignment[];
}

const preventAddressBookPersistence = (
  address: AddressRequestBody,
): AddressRequestBody & { shouldSaveAddress: false } => ({
  ...address,
  shouldSaveAddress: false,
});

const normalizeDestinationAddress = (address: Partial<Address>) => ({
  firstName: address.firstName,
  lastName: address.lastName,
  company: address.company,
  address1: address.address1,
  address2: address.address2,
  city: address.city,
  stateOrProvince: address.stateOrProvince,
  countryCode: address.countryCode,
  postalCode: address.postalCode,
  phone: address.phone,
  customFields: address.customFields?.length ? address.customFields : undefined,
});

export const isSameConsignmentDestination = (
  addressA?: Partial<Address>,
  addressB?: Partial<Address>,
): boolean => {
  if (!addressA || !addressB) {
    return false;
  }

  const { stateOrProvince: _stateA, ...normalizedAddressA } = normalizeDestinationAddress(addressA);
  const { stateOrProvince: _stateB, ...normalizedAddressB } = normalizeDestinationAddress(addressB);
  const hasStateCodes = Boolean(addressA.stateOrProvinceCode && addressB.stateOrProvinceCode);
  const isSameState = hasStateCodes
    ? addressA.stateOrProvinceCode === addressB.stateOrProvinceCode
    : addressA.stateOrProvince === addressB.stateOrProvince;

  return isSameState && isEqual(normalizedAddressA, normalizedAddressB);
};

const getCheckoutSnapshot = (
  checkoutState: CheckoutSelectors,
  cartId: string,
): FflCheckoutSnapshot => {
  const cart = checkoutState?.data?.getCart?.();
  const checkout = checkoutState?.data?.getCheckout?.();

  if (!cart || !checkout || cart.id !== cartId || checkout.id !== cartId) {
    throw new Error('BigCommerce checkout state does not match the active cart');
  }

  return {
    cart,
    checkoutState,
    consignments: checkoutState.data.getConsignments?.() || [],
  };
};

const getPhysicalItemsById = (cart: Cart) =>
  new Map(cart.lineItems.physicalItems.map((item) => [String(item.id), item]));

const getActiveItemIds = (itemIds: string[], cart: Cart): string[] => {
  const physicalItemsById = getPhysicalItemsById(cart);

  return itemIds.filter((itemId) => physicalItemsById.has(itemId));
};

const getLineItems = (itemIds: string[], cart: Cart) => {
  const physicalItemsById = getPhysicalItemsById(cart);

  return itemIds.flatMap((itemId) => {
    const item = physicalItemsById.get(itemId);

    return item ? [{ itemId, quantity: item.quantity }] : [];
  });
};

const getItemOwners = (consignments: Consignment[], itemId: string): Consignment[] =>
  consignments.filter((consignment) =>
    consignment.lineItemIds.some((lineItemId) => String(lineItemId) === itemId),
  );

const getCanonicalAssignmentAddress = (
  assignment: FflDestinationAssignment,
  consignments: Consignment[],
): AddressRequestBody => {
  const equivalentConsignments = consignments.filter((consignment) =>
    isSameConsignmentDestination(consignment.shippingAddress, assignment.address),
  );

  if (!equivalentConsignments.length) {
    return assignment.address;
  }

  const requestedItemIds = new Set(assignment.itemIds);
  const canonicalConsignment = equivalentConsignments.reduce((best, candidate) => {
    const bestMatches = best.lineItemIds.filter((itemId) => requestedItemIds.has(itemId)).length;
    const candidateMatches = candidate.lineItemIds.filter((itemId) =>
      requestedItemIds.has(itemId),
    ).length;

    return candidateMatches > bestMatches ? candidate : best;
  });

  return canonicalConsignment.shippingAddress as AddressRequestBody;
};

const getMissingAssignmentItemIds = (
  assignment: FflDestinationAssignment,
  snapshot: FflCheckoutSnapshot,
): string[] =>
  getActiveItemIds(assignment.itemIds, snapshot.cart).filter((itemId) => {
    const owners = getItemOwners(snapshot.consignments, itemId);

    return !owners.some((owner) =>
      isSameConsignmentDestination(owner.shippingAddress, assignment.address),
    );
  });

const validatePlan = (plan: FflReconciliationPlan): void => {
  const seenItemIds = new Set<string>();
  const itemGroups = [...plan.assignments.map(({ itemIds }) => itemIds), plan.unassignedItemIds];

  for (const itemIds of itemGroups) {
    for (const itemId of itemIds) {
      if (seenItemIds.has(itemId)) {
        throw new Error(`FFL reconciliation plan assigns item ${itemId} more than once`);
      }

      seenItemIds.add(itemId);
    }
  }
};

const verifyAssignments = (
  assignments: FflDestinationAssignment[],
  snapshot: FflCheckoutSnapshot,
): boolean =>
  assignments.every((assignment) =>
    getActiveItemIds(assignment.itemIds, snapshot.cart).every((itemId) => {
      const owners = getItemOwners(snapshot.consignments, itemId);

      return (
        owners.length === 1 &&
        isSameConsignmentDestination(owners[0].shippingAddress, assignment.address)
      );
    }),
  );

const verifyUnassignedItems = (itemIds: string[], snapshot: FflCheckoutSnapshot): boolean =>
  getActiveItemIds(itemIds, snapshot.cart).every(
    (itemId) => getItemOwners(snapshot.consignments, itemId).length === 0,
  );

export const createFflConsignmentCoordinator = (
  dependencies: FflConsignmentCoordinatorDependencies,
): FflConsignmentCoordinator => {
  let disposed = false;
  let shippingEnabled = true;
  let previousDealer: CheckoutHandoffIntent = { active: false };
  let generation = 0;
  let queue: Promise<void> = Promise.resolve();

  const scheduleRefresh = (cartId: string): Promise<CheckoutSelectors> => {
    if (!dependencies.refreshCheckout) {
      return Promise.reject(new Error('BigCommerce checkout refresh is not configured'));
    }

    const result = queue.then(() => dependencies.refreshCheckout!(cartId));
    queue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  };

  const handoffPublisher =
    dependencies.handoffPublisher ||
    (dependencies.handoffClient && dependencies.refreshCheckout
      ? createCheckoutHandoffPublisher({
          client: dependencies.handoffClient,
          getCheckoutState: dependencies.getState,
          matchesDestination: isSameCheckoutHandoffDestination,
          onError: dependencies.onHandoffError,
          refreshCheckout: scheduleRefresh,
        })
      : undefined);

  const isSuperseded = (requestGeneration: number): boolean =>
    disposed || requestGeneration !== generation;

  const schedule = (
    operation: (requestGeneration: number) => Promise<FflCoordinatorResult>,
  ): Promise<FflCoordinatorResult> => {
    const requestGeneration = ++generation;
    const result = queue.then(() =>
      isSuperseded(requestGeneration)
        ? Promise.resolve<FflCoordinatorResult>({ status: 'superseded' })
        : operation(requestGeneration),
    );

    queue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  };

  const reconcile = (plan: FflReconciliationPlan): Promise<FflCoordinatorResult> =>
    !shippingEnabled ? Promise.resolve({ status: 'superseded' }) : schedule(async (requestGeneration) => {
      let snapshot: FflCheckoutSnapshot;

      try {
        validatePlan(plan);
        snapshot = getCheckoutSnapshot(dependencies.getState(), plan.cartId);
      } catch (error) {
        return isSuperseded(requestGeneration)
          ? { status: 'superseded' }
          : { status: 'failed', kind: 'internal', error };
      }

      for (const assignment of plan.assignments) {
        const missingItemIds = getMissingAssignmentItemIds(assignment, snapshot);

        if (!missingItemIds.length) {
          continue;
        }

        const address = preventAddressBookPersistence(
          getCanonicalAssignmentAddress(assignment, snapshot.consignments),
        );

        try {
          const checkoutState = await dependencies.assignItemsToAddress({
            address,
            lineItems: getLineItems(missingItemIds, snapshot.cart),
          });

          if (isSuperseded(requestGeneration)) {
            return { status: 'superseded' };
          }

          snapshot = getCheckoutSnapshot(checkoutState, plan.cartId);
        } catch (error) {
          return isSuperseded(requestGeneration)
            ? { status: 'superseded' }
            : { status: 'failed', kind: 'assign', error };
        }
      }

      for (const consignment of snapshot.consignments) {
        const assignedItemIds = getActiveItemIds(plan.unassignedItemIds, snapshot.cart).filter(
          (itemId) => consignment.lineItemIds.some((lineItemId) => String(lineItemId) === itemId),
        );

        if (!assignedItemIds.length) {
          continue;
        }

        try {
          const checkoutState = await dependencies.unassignItemsToAddress({
            address: preventAddressBookPersistence(
              consignment.shippingAddress as AddressRequestBody,
            ),
            lineItems: getLineItems(assignedItemIds, snapshot.cart),
          });

          if (isSuperseded(requestGeneration)) {
            return { status: 'superseded' };
          }

          snapshot = getCheckoutSnapshot(checkoutState, plan.cartId);
        } catch (error) {
          return isSuperseded(requestGeneration)
            ? { status: 'superseded' }
            : { status: 'failed', kind: 'unassign', error };
        }
      }

      if (!verifyAssignments(plan.assignments, snapshot)) {
        return {
          status: 'failed',
          kind: 'assign',
          error: new Error('BigCommerce did not fulfill the requested FFL assignments'),
        };
      }

      if (!verifyUnassignedItems(plan.unassignedItemIds, snapshot)) {
        return {
          status: 'failed',
          kind: 'unassign',
          error: new Error('BigCommerce did not unassign the requested FFL items'),
        };
      }

      if (plan.handoff) {
        previousDealer = plan.handoff.active ? {
          active: false,
          previousDealerId: plan.handoff.dealerId,
          previousDestination: plan.handoff.destination,
        } : plan.handoff;
        handoffPublisher?.publish(plan.handoff, snapshot.checkoutState);
      }

      return { status: 'fulfilled', checkoutState: snapshot.checkoutState };
    });

  const clearAll = (
    cartId: string,
    handoff: CheckoutHandoffIntent = { active: false },
  ): Promise<FflCoordinatorResult> =>
    schedule(async (requestGeneration) => {
      let snapshot: FflCheckoutSnapshot;

      try {
        snapshot = getCheckoutSnapshot(dependencies.getState(), cartId);
      } catch (error) {
        return isSuperseded(requestGeneration)
          ? { status: 'superseded' }
          : { status: 'failed', kind: 'internal', error };
      }

      const consignmentIds = snapshot.consignments.map(({ id }) => id);

      for (const consignmentId of consignmentIds) {
        if (!snapshot.consignments.some(({ id }) => id === consignmentId)) {
          continue;
        }

        try {
          const checkoutState = await dependencies.deleteConsignment(consignmentId);

          if (isSuperseded(requestGeneration)) {
            return { status: 'superseded' };
          }

          snapshot = getCheckoutSnapshot(checkoutState, cartId);
        } catch (error) {
          return isSuperseded(requestGeneration)
            ? { status: 'superseded' }
            : { status: 'failed', kind: 'unassign', error };
        }
      }

      if (snapshot.consignments.length) {
        return {
          status: 'failed',
          kind: 'unassign',
          error: new Error('BigCommerce did not clear every consignment'),
        };
      }

      handoffPublisher?.publish(handoff);

      return { status: 'fulfilled', checkoutState: snapshot.checkoutState };
    });

  const selectPickup: FflConsignmentCoordinator['selectPickup'] = (
    cartId, signature, methodId, eligibleMethodIds, handoff = previousDealer,
  ) => schedule(async (requestGeneration) => {
    try {
      let snapshot = getCheckoutSnapshot(dependencies.getState(), cartId);

      if (pickupCartSignature(snapshot.cart) !== signature ||
          !snapshot.cart.lineItems.physicalItems.length || !eligibleMethodIds.includes(methodId)) {
        throw new Error('Pickup must be confirmed for the current cart');
      }

      if (!dependencies.createConsignments || !dependencies.updateConsignment) {
        throw new Error('Native pickup mutations are not configured');
      }

      if (snapshot.consignments.length > 1) {
        for (const { id } of snapshot.consignments) {
          const state = await dependencies.deleteConsignment(id);

          if (isSuperseded(requestGeneration)) {
            return { status: 'superseded' };
          }

          snapshot = getCheckoutSnapshot(state, cartId);
        }
      }

      if (pickupCartSignature(snapshot.cart) !== signature) {
        throw new Error('Cart changed during pickup selection');
      }

      const body = {
        lineItems: snapshot.cart.lineItems.physicalItems.map(({ id, quantity }) => ({ itemId: id, quantity })),
        pickupOption: { pickupMethodId: methodId },
      };
      const state = snapshot.consignments.length === 1
        ? await dependencies.updateConsignment({ ...body, id: snapshot.consignments[0].id })
        : await dependencies.createConsignments([body]);

      if (isSuperseded(requestGeneration)) {
        return { status: 'superseded' };
      }

      if (!matchesPickup(state, signature, methodId) ||
          !matchesPickup(dependencies.getState(), signature, methodId)) {
        throw new Error('BigCommerce did not confirm the requested whole-cart pickup');
      }

      handoffPublisher?.publish({ ...handoff, active: false }, state);

      return { status: 'fulfilled', checkoutState: state };
    } catch (error) {
      return isSuperseded(requestGeneration)
        ? { status: 'superseded' }
        : { status: 'failed', kind: 'assign', error };
    }
  });

  return {
    suspendShipping: async () => {
      shippingEnabled = false;
      generation += 1;
      await queue;
    },
    resumeShipping: () => { shippingEnabled = true; },
    selectPickup,
    reconcile,
    clearAll,
    configureHandoff: (context) => handoffPublisher?.configure(context),
    deactivateHandoff: () => handoffPublisher?.publish(previousDealer),
    dispose: () => {
      disposed = true;
      generation += 1;
      handoffPublisher?.dispose();
    },
  };
};
