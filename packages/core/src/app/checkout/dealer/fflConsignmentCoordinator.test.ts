import {
  Address,
  AddressRequestBody,
  CheckoutSelectors,
  Consignment,
} from '@bigcommerce/checkout-sdk';
import { isEqual, pick } from 'lodash';

import {
  createFflConsignmentCoordinator,
  FflReconciliationPlan,
  synchronizeCheckoutHandoffPresence,
} from './fflConsignmentCoordinator';

const customerAddress = {
  address1: '100 Customer Way',
  address2: '',
  city: 'Austin',
  company: '',
  country: 'United States',
  countryCode: 'US',
  customFields: [],
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '5555550100',
  postalCode: '78701',
  shouldSaveAddress: false,
  stateOrProvince: 'Texas',
  stateOrProvinceCode: 'TX',
} as Address;

const dealerAddress = {
  ...customerAddress,
  address1: '200 Dealer Road',
  city: 'Denver',
  company: 'Example FFL',
  postalCode: '80202',
  stateOrProvince: 'Colorado',
  stateOrProvinceCode: 'CO',
} as Address;

const otherAddress = {
  ...customerAddress,
  address1: '300 New Customer Road',
  city: 'Dallas',
  postalCode: '75201',
} as Address;

const exactAddressFields = [
  'firstName',
  'lastName',
  'company',
  'address1',
  'address2',
  'city',
  'stateOrProvince',
  'countryCode',
  'postalCode',
  'phone',
  'customFields',
];

interface StatefulSdkOptions {
  beforeAssign?(call: number): Promise<void>;
  failDeleteId?: string;
}

const createStatefulSdk = (options: StatefulSdkOptions = {}) => {
  const cart = {
    id: 'cart-1',
    lineItems: {
      physicalItems: [
        { id: 'gun-1', quantity: 1 },
        { id: 'ammo-1', quantity: 2 },
        { id: 'regular-1', quantity: 1 },
      ],
    },
  };
  let assignCall = 0;
  let nextConsignmentId = 1;
  let consignments: Consignment[] = [];
  const sameNativeAddress = (addressA: Address, addressB: AddressRequestBody) =>
    isEqual(pick(addressA, exactAddressFields), pick(addressB, exactAddressFields));
  const selectors = (): CheckoutSelectors =>
    ({
      data: {
        getCart: () => cart,
        getCheckout: () => ({ id: cart.id }),
        getConsignments: () => consignments,
      },
    } as CheckoutSelectors);

  const assignItemsToAddress = jest.fn(async (request: any) => {
    assignCall += 1;
    await options.beforeAssign?.(assignCall);

    const address = request.address as AddressRequestBody;
    const requestedItemIds = request.lineItems.map(({ itemId }: any) => String(itemId));
    const target = consignments.find((consignment) =>
      sameNativeAddress(consignment.shippingAddress, address),
    );
    const targetId = target?.id || `created-${nextConsignmentId++}`;

    consignments = consignments
      .map((consignment) => ({
        ...consignment,
        lineItemIds: consignment.lineItemIds.filter(
          (itemId) => !requestedItemIds.includes(String(itemId)),
        ),
      }))
      .filter(({ lineItemIds }) => lineItemIds.length);

    const currentTarget = consignments.find(({ id }) => id === targetId);

    if (currentTarget) {
      currentTarget.lineItemIds.push(...requestedItemIds);
    } else {
      consignments.push({
        id: targetId,
        lineItemIds: requestedItemIds,
        shippingAddress: address as Address,
      } as Consignment);
    }

    return selectors();
  });

  const unassignItemsToAddress = jest.fn(async (request: any) => {
    const address = request.address as AddressRequestBody;
    const requestedItemIds = request.lineItems.map(({ itemId }: any) => String(itemId));
    const target = consignments.find((consignment) =>
      sameNativeAddress(consignment.shippingAddress, address),
    );

    if (!target) {
      throw new Error('No consignment found for the specified address');
    }

    target.lineItemIds = target.lineItemIds.filter(
      (itemId) => !requestedItemIds.includes(String(itemId)),
    );
    consignments = consignments.filter(({ lineItemIds }) => lineItemIds.length);

    return selectors();
  });

  const deleteConsignment = jest.fn(async (consignmentId: string) => {
    if (consignmentId === options.failDeleteId) {
      throw new Error('Delete failed');
    }

    consignments = consignments.filter(({ id }) => id !== consignmentId);

    return selectors();
  });

  return {
    assignItemsToAddress,
    deleteConsignment,
    get consignments() {
      return consignments;
    },
    getState: jest.fn(selectors),
    ownerAddresses: (itemId: string) =>
      consignments
        .filter((consignment) => consignment.lineItemIds.includes(itemId))
        .map(({ shippingAddress }) => shippingAddress.address1),
    setConsignments: (nextConsignments: Consignment[]) => {
      consignments = nextConsignments;
    },
    unassignItemsToAddress,
  };
};

const makePlan = (
  address: AddressRequestBody,
  itemIds: string[],
  unassignedItemIds: string[] = [],
): FflReconciliationPlan => ({
  assignments: [{ address, itemIds }],
  cartId: 'cart-1',
  unassignedItemIds,
});

describe('fflConsignmentCoordinator', () => {
  it('deactivates a prior handoff when the current cart has no FFL items', () => {
    const coordinator = {
      configureHandoff: jest.fn(),
      deactivateHandoff: jest.fn(),
    };

    synchronizeCheckoutHandoffPresence(
      coordinator as any,
      { id: 'ordinary-cart' },
      'store-hash',
      false,
    );

    expect(coordinator.configureHandoff).toHaveBeenCalledWith({
      cartId: 'ordinary-cart',
      storeHash: 'store-hash',
    });
    expect(coordinator.deactivateHandoff).toHaveBeenCalledTimes(1);
  });

  it('publishes an active handoff only after BigCommerce confirms the dealer assignment', async () => {
    const sdk = createStatefulSdk();
    const handoffPublisher = {
      configure: jest.fn(),
      dispose: jest.fn(),
      publish: jest.fn(),
    };
    const coordinator = createFflConsignmentCoordinator({ ...sdk, handoffPublisher });
    const handoff = {
      active: true as const,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    };

    coordinator.configureHandoff({ cartId: 'cart-1', storeHash: 'store-hash' });
    const result = await coordinator.reconcile({
      ...makePlan(dealerAddress as AddressRequestBody, ['gun-1']),
      handoff,
    });

    expect(result).toMatchObject({ status: 'fulfilled' });
    expect(handoffPublisher.configure).toHaveBeenCalledWith({
      cartId: 'cart-1',
      storeHash: 'store-hash',
    });
    expect(handoffPublisher.publish).toHaveBeenCalledWith(
      handoff,
      expect.objectContaining({ data: expect.any(Object) }),
    );
  });

  it('publishes a tombstone only after every consignment is cleared', async () => {
    const sdk = createStatefulSdk();
    sdk.setConsignments([
      { id: 'dealer', lineItemIds: ['gun-1'], shippingAddress: dealerAddress } as Consignment,
    ]);
    const handoffPublisher = {
      configure: jest.fn(),
      dispose: jest.fn(),
      publish: jest.fn(),
    };
    const coordinator = createFflConsignmentCoordinator({ ...sdk, handoffPublisher });
    const tombstone = {
      active: false as const,
      previousDealerId: 42,
      previousDestination: dealerAddress,
    };

    await expect(coordinator.clearAll('cart-1', tombstone)).resolves.toMatchObject({
      status: 'fulfilled',
    });

    expect(handoffPublisher.publish).toHaveBeenCalledWith(tombstone);
  });

  it('does not mutate an already fulfilled plan', async () => {
    const sdk = createStatefulSdk();
    sdk.setConsignments([
      {
        id: 'customer',
        lineItemIds: ['ammo-1'],
        shippingAddress: { ...customerAddress, shouldSaveAddress: true },
      } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);

    await expect(
      coordinator.reconcile(makePlan(customerAddress as AddressRequestBody, ['ammo-1'])),
    ).resolves.toMatchObject({ status: 'fulfilled' });

    expect(sdk.assignItemsToAddress).not.toHaveBeenCalled();
    expect(sdk.unassignItemsToAddress).not.toHaveBeenCalled();
  });

  it('reuses BigCommerce normalized address data when assigning a missing item', async () => {
    const sdk = createStatefulSdk();
    const canonicalCustomerAddress = {
      ...customerAddress,
      shouldSaveAddress: true,
    } as Address;

    sdk.setConsignments([
      {
        id: 'customer',
        lineItemIds: ['regular-1'],
        shippingAddress: canonicalCustomerAddress,
      } as Consignment,
      {
        id: 'dealer',
        lineItemIds: ['ammo-1'],
        shippingAddress: dealerAddress,
      } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);
    const submittedAddress = {
      ...customerAddress,
      customFields: undefined,
      stateOrProvince: 'TX',
    } as unknown as AddressRequestBody;

    await expect(
      coordinator.reconcile(makePlan(submittedAddress, ['ammo-1', 'regular-1'])),
    ).resolves.toMatchObject({ status: 'fulfilled' });

    expect(sdk.assignItemsToAddress).toHaveBeenCalledWith({
      address: { ...canonicalCustomerAddress, shouldSaveAddress: false },
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(sdk.consignments).toHaveLength(1);
    expect(sdk.ownerAddresses('ammo-1')).toEqual([customerAddress.address1]);
  });

  it('keeps a real recipient change distinct from address normalization', async () => {
    const sdk = createStatefulSdk();
    sdk.setConsignments([
      {
        id: 'customer',
        lineItemIds: ['ammo-1'],
        shippingAddress: customerAddress,
      } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);
    const updatedRecipient = {
      ...customerAddress,
      firstName: 'John',
    } as AddressRequestBody;

    await expect(
      coordinator.reconcile(makePlan(updatedRecipient, ['ammo-1'])),
    ).resolves.toMatchObject({ status: 'fulfilled' });

    expect(sdk.assignItemsToAddress).toHaveBeenCalledWith({
      address: updatedRecipient,
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(sdk.consignments[0].shippingAddress.firstName).toBe('John');
  });

  it('moves only missing items and preserves unrelated ownership', async () => {
    const sdk = createStatefulSdk();
    sdk.setConsignments([
      {
        id: 'customer',
        lineItemIds: ['ammo-1', 'regular-1'],
        shippingAddress: customerAddress,
      } as Consignment,
      {
        id: 'dealer',
        lineItemIds: ['gun-1'],
        shippingAddress: dealerAddress,
      } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);

    await expect(
      coordinator.reconcile(makePlan(dealerAddress as AddressRequestBody, ['gun-1', 'ammo-1'])),
    ).resolves.toMatchObject({ status: 'fulfilled' });

    expect(sdk.assignItemsToAddress).toHaveBeenCalledWith({
      address: dealerAddress,
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(sdk.ownerAddresses('regular-1')).toEqual([customerAddress.address1]);
  });

  it('uses native unassignment to preserve ordinary items in a mixed consignment', async () => {
    const sdk = createStatefulSdk();
    const persistedCustomerAddress = {
      ...customerAddress,
      shouldSaveAddress: true,
    } as Address;

    sdk.setConsignments([
      {
        id: 'customer',
        lineItemIds: ['ammo-1', 'regular-1'],
        shippingAddress: persistedCustomerAddress,
      } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);

    await expect(
      coordinator.reconcile({
        assignments: [],
        cartId: 'cart-1',
        unassignedItemIds: ['ammo-1'],
      }),
    ).resolves.toMatchObject({ status: 'fulfilled' });

    expect(sdk.unassignItemsToAddress).toHaveBeenCalledWith({
      address: { ...persistedCustomerAddress, shouldSaveAddress: false },
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(sdk.ownerAddresses('ammo-1')).toEqual([]);
    expect(sdk.ownerAddresses('regular-1')).toEqual([customerAddress.address1]);
  });

  it('lets native unassignment remove an empty consignment', async () => {
    const sdk = createStatefulSdk();
    sdk.setConsignments([
      {
        id: 'ammo-only',
        lineItemIds: ['ammo-1'],
        shippingAddress: customerAddress,
      } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);

    await expect(
      coordinator.reconcile({
        assignments: [],
        cartId: 'cart-1',
        unassignedItemIds: ['ammo-1'],
      }),
    ).resolves.toMatchObject({ status: 'fulfilled' });

    expect(sdk.unassignItemsToAddress).toHaveBeenCalledTimes(1);
    expect(sdk.deleteConsignment).not.toHaveBeenCalled();
    expect(sdk.consignments).toEqual([]);
  });

  it('plans each assignment from the selectors returned by the previous assignment', async () => {
    const sdk = createStatefulSdk();
    sdk.setConsignments([
      {
        id: 'customer',
        lineItemIds: ['gun-1', 'ammo-1', 'regular-1'],
        shippingAddress: customerAddress,
      } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);

    await expect(
      coordinator.reconcile({
        assignments: [
          { address: dealerAddress as AddressRequestBody, itemIds: ['gun-1'] },
          { address: otherAddress as AddressRequestBody, itemIds: ['ammo-1'] },
        ],
        cartId: 'cart-1',
        unassignedItemIds: [],
      }),
    ).resolves.toMatchObject({ status: 'fulfilled' });

    expect(sdk.getState).toHaveBeenCalledTimes(1);
    expect(sdk.assignItemsToAddress).toHaveBeenCalledTimes(2);
    expect(sdk.ownerAddresses('gun-1')).toEqual([dealerAddress.address1]);
    expect(sdk.ownerAddresses('ammo-1')).toEqual([otherAddress.address1]);
    expect(sdk.ownerAddresses('regular-1')).toEqual([customerAddress.address1]);
  });

  it('lets only the newest overlapping plan publish a result', async () => {
    let releaseFirstAssignment: () => void = () => undefined;
    const firstAssignmentPending = new Promise<void>((resolve) => {
      releaseFirstAssignment = resolve;
    });
    const sdk = createStatefulSdk({
      beforeAssign: (call) => (call === 1 ? firstAssignmentPending : Promise.resolve()),
    });
    sdk.setConsignments([
      {
        id: 'customer',
        lineItemIds: ['ammo-1'],
        shippingAddress: customerAddress,
      } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);
    const first = coordinator.reconcile(makePlan(dealerAddress as AddressRequestBody, ['ammo-1']));

    await Promise.resolve();
    const newest = coordinator.reconcile(makePlan(otherAddress as AddressRequestBody, ['ammo-1']));
    releaseFirstAssignment();

    await expect(first).resolves.toEqual({ status: 'superseded' });
    await expect(newest).resolves.toMatchObject({ status: 'fulfilled' });
    expect(sdk.ownerAddresses('ammo-1')).toEqual([otherAddress.address1]);
  });

  it('queues identity cleanup behind an in-flight route and clears its returned state', async () => {
    let releaseAssignment: () => void = () => undefined;
    const assignmentPending = new Promise<void>((resolve) => {
      releaseAssignment = resolve;
    });
    const sdk = createStatefulSdk({ beforeAssign: () => assignmentPending });
    sdk.setConsignments([
      {
        id: 'customer',
        lineItemIds: ['ammo-1'],
        shippingAddress: customerAddress,
      } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);
    const routing = coordinator.reconcile(
      makePlan(dealerAddress as AddressRequestBody, ['ammo-1']),
    );

    await Promise.resolve();
    const cleanup = coordinator.clearAll('cart-1');
    releaseAssignment();

    await expect(routing).resolves.toEqual({ status: 'superseded' });
    await expect(cleanup).resolves.toMatchObject({ status: 'fulfilled' });
    expect(sdk.consignments).toEqual([]);
  });

  it('suppresses an in-flight result after disposal', async () => {
    let releaseAssignment: () => void = () => undefined;
    const assignmentPending = new Promise<void>((resolve) => {
      releaseAssignment = resolve;
    });
    const sdk = createStatefulSdk({ beforeAssign: () => assignmentPending });
    sdk.setConsignments([
      {
        id: 'customer',
        lineItemIds: ['ammo-1'],
        shippingAddress: customerAddress,
      } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);
    const result = coordinator.reconcile(makePlan(dealerAddress as AddressRequestBody, ['ammo-1']));

    await Promise.resolve();
    coordinator.dispose();
    releaseAssignment();

    await expect(result).resolves.toEqual({ status: 'superseded' });
  });

  it('clears consignments sequentially and adopts each returned state', async () => {
    const sdk = createStatefulSdk();
    sdk.setConsignments([
      { id: 'first', lineItemIds: ['gun-1'], shippingAddress: dealerAddress } as Consignment,
      { id: 'second', lineItemIds: ['ammo-1'], shippingAddress: customerAddress } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);

    await expect(coordinator.clearAll('cart-1')).resolves.toMatchObject({
      status: 'fulfilled',
    });

    expect(sdk.deleteConsignment.mock.calls).toEqual([['first'], ['second']]);
    expect(sdk.consignments).toEqual([]);
  });

  it('fails closed when clear-all cannot delete every consignment', async () => {
    const sdk = createStatefulSdk({ failDeleteId: 'second' });
    sdk.setConsignments([
      { id: 'first', lineItemIds: ['gun-1'], shippingAddress: dealerAddress } as Consignment,
      { id: 'second', lineItemIds: ['ammo-1'], shippingAddress: customerAddress } as Consignment,
    ]);
    const coordinator = createFflConsignmentCoordinator(sdk);

    await expect(coordinator.clearAll('cart-1')).resolves.toMatchObject({
      status: 'failed',
      kind: 'unassign',
    });

    expect(sdk.consignments.map(({ id }) => id)).toEqual(['second']);
  });

  it('rejects conflicting item ownership before calling the SDK', async () => {
    const sdk = createStatefulSdk();
    const coordinator = createFflConsignmentCoordinator(sdk);

    await expect(
      coordinator.reconcile({
        assignments: [
          { address: customerAddress as AddressRequestBody, itemIds: ['ammo-1'] },
          { address: dealerAddress as AddressRequestBody, itemIds: ['ammo-1'] },
        ],
        cartId: 'cart-1',
        unassignedItemIds: [],
      }),
    ).resolves.toMatchObject({ status: 'failed', kind: 'internal' });

    expect(sdk.assignItemsToAddress).not.toHaveBeenCalled();
    expect(sdk.unassignItemsToAddress).not.toHaveBeenCalled();
  });
});
