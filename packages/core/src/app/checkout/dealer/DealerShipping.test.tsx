import { Address } from '@bigcommerce/checkout-sdk';
import { groupBy, identity, isEqual, pickBy } from 'lodash';

import { AddressFormModal } from '../../address';

import { DealerShipping } from './DealerShipping';
import { createFflConsignmentCoordinator } from './fflConsignmentCoordinator';

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

const californiaCustomerAddress = {
  ...customerAddress,
  address1: '500 Selected Avenue',
  city: 'Los Angeles',
  postalCode: '90001',
  stateOrProvince: 'California',
  stateOrProvinceCode: 'CA',
} as Address;

const dealerAddress = {
  ...customerAddress,
  address1: '200 Dealer Road',
  city: 'Denver',
  company: 'Example FFL',
  firstName: 'FFL',
  lastName: 'Receiving',
  postalCode: '80202',
  stateOrProvince: 'Colorado',
  stateOrProvinceCode: 'CO',
};

const committedDealerAddress = {
  ...dealerAddress,
  firstName: 'Jane',
  lastName: 'Doe',
};

const makeCheckoutSelectors = (
  props: any,
  {
    cart = props.cart,
    checkoutId = props.cart.id,
    consignments = props.consignments,
  }: { cart?: any; checkoutId?: string; consignments?: any[] } = {},
) => ({
  data: {
    getCart: () => cart,
    getCheckout: () => (checkoutId ? { id: checkoutId } : undefined),
    getConsignments: () => consignments,
  },
});

const makeRequestError = (status: number) => ({ status, type: 'request' });

const findElementsByType = (node: any, type: any): any[] => {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findElementsByType(child, type));
  }

  if (!node?.props) {
    return [];
  }

  return [...(node.type === type ? [node] : []), ...findElementsByType(node.props.children, type)];
};

const makeProps = (isGuest = false) => {
  const props = {
    assignItem: jest.fn().mockResolvedValue({}),
    billingAddress: undefined as Address | undefined,
    clearConfirmedAmmoRoutingSession: jest.fn(),
    confirmedAmmoRoutingSession: undefined as any,
    confirmAmmoRoutingSession: jest.fn(),
    cart: {
      id: 'cart-1',
      lineItems: {
        physicalItems: [
          { addedByPromotion: false, id: 'gun-1', parentId: null, quantity: 1 },
          { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
        ],
      },
    },
    consignments: [
      {
        id: 'dealer-consignment',
        lineItemIds: ['gun-1'],
        shippingAddress: committedDealerAddress,
      },
      { id: 'customer-consignment', lineItemIds: ['ammo-1'], shippingAddress: customerAddress },
    ],
    countries: [
      {
        code: 'US',
        name: 'United States',
        hasPostalCodes: true,
        requiresState: true,
        subdivisions: [
          { code: 'CA', name: 'California' },
          { code: 'TX', name: 'Texas' },
        ],
      },
    ],
    customer: { addresses: isGuest ? [] : [customerAddress], id: isGuest ? 0 : 4, isGuest },
    createCustomerAddress: jest.fn().mockResolvedValue({}),
    deleteConsignment: jest.fn().mockResolvedValue({}),
    fflConsignmentItems: [{ itemId: 'gun-1', quantity: 1 }],
    fflConsignmentCoordinator: undefined as any,
    fflProducts: [{ conditions: [{ states: ['CA', 'NY'], type: 'ship_state' }] }],
    getCheckoutState: jest.fn(),
    getFields: jest.fn().mockReturnValue([]),
    loadShippingAddressFields: jest.fn().mockResolvedValue({}),
    loadBillingAddressFields: jest.fn().mockResolvedValue({}),
    loadShippingOptions: jest.fn().mockResolvedValue({}),
    isLoading: false,
    isValid: true,
    customerMessage: '',
    navigateNextStep: jest.fn(),
    onUnhandledError: jest.fn(),
    selectedFFL: null,
    setFFLtoOrderComments: jest.fn(),
    setCustomerAddressSelection: jest.fn(),
    setSelectedFFL: jest.fn(),
    setWithAmmoSubscription: jest.fn(),
    shippingAddress: isGuest ? undefined : customerAddress,
    stateRestrictedConsignmentItems: [{ itemId: 'ammo-1', quantity: 2 }],
    storeHash: 'store-hash',
    unassignItem: jest.fn().mockResolvedValue({}),
    updateCheckout: jest.fn().mockResolvedValue({}),
  };

  props.getCheckoutState.mockImplementation(() => makeCheckoutSelectors(props));
  props.fflConsignmentCoordinator = createFflConsignmentCoordinator({
    assignItemsToAddress: props.assignItem,
    deleteConsignment: props.deleteConsignment,
    getState: props.getCheckoutState,
    unassignItemsToAddress: props.unassignItem,
  });

  return props;
};

const makeSubject = (
  isGuest = false,
  prepareProps?: (props: ReturnType<typeof makeProps>) => void,
) => {
  const props = makeProps(isGuest);
  prepareProps?.(props);
  installStatefulConsignmentSdk(props);
  const subject = new DealerShipping(props as any);

  (subject as any).setState = (update: any, callback?: () => void) => {
    const nextState = typeof update === 'function' ? update(subject.state, subject.props) : update;
    subject.state = { ...subject.state, ...nextState };
    callback?.();
  };

  subject.state = {
    ...subject.state,
    applyAmmoStateRulesInMixedCarts: true,
    customFirstNameInput: 'Jane',
    customLastNameInput: 'Doe',
    isLoading: false,
    selectedDealer: props.selectedFFL || dealerAddress,
    withAmmoSubscription: true,
  };

  return { props, subject };
};

const normalizeSdkAddress = (address: Address) =>
  pickBy(
    {
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
    },
    identity,
  );

const installStatefulConsignmentSdk = (
  props: ReturnType<typeof makeProps>,
  beforeAssign?: (call: number) => Promise<void>,
) => {
  let assignCall = 0;
  let nextConsignmentId = 1;
  let shippingQueue = Promise.resolve<any>(undefined);
  const sameAddress = (addressA: Address, addressB: Address) =>
    isEqual(normalizeSdkAddress(addressA), normalizeSdkAddress(addressB));
  const selectors = () => makeCheckoutSelectors(props);
  const enqueueShippingOperation = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = shippingQueue.then(operation, operation);
    shippingQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  props.assignItem.mockImplementation((request: any) =>
    enqueueShippingOperation(async () => {
      assignCall += 1;
      await beforeAssign?.(assignCall);

      const address = (request.address || request.shippingAddress) as Address;
      const requestedItemIds = request.lineItems.map((lineItem: any) => lineItem.itemId);
      const target = props.consignments.find((consignment) =>
        sameAddress(consignment.shippingAddress, address),
      );

      if (target?.lineItemIds.some((itemId) => requestedItemIds.includes(itemId))) {
        throw new Error('The assignment contains an item already at the target address');
      }

      const targetId = target?.id || `created-consignment-${nextConsignmentId++}`;
      props.consignments = props.consignments
        .map((consignment) => ({
          ...consignment,
          lineItemIds: consignment.lineItemIds.filter(
            (itemId) => !requestedItemIds.includes(itemId),
          ),
        }))
        .filter((consignment) => consignment.lineItemIds.length > 0);

      const updatedTarget = props.consignments.find(({ id }) => id === targetId);

      if (updatedTarget) {
        updatedTarget.lineItemIds.push(...requestedItemIds);
      } else {
        props.consignments.push({
          id: targetId,
          lineItemIds: requestedItemIds,
          shippingAddress: address,
        });
      }

      return selectors();
    }),
  );

  props.unassignItem.mockImplementation((request: any) =>
    enqueueShippingOperation(async () => {
      const address = (request.address || request.shippingAddress) as Address;
      const requestedItemIds = request.lineItems.map((lineItem: any) => lineItem.itemId);
      const target = props.consignments.find((consignment) =>
        sameAddress(consignment.shippingAddress, address),
      );

      if (!target) {
        throw new Error('No consignment found for the specified address');
      }

      target.lineItemIds = target.lineItemIds.filter(
        (itemId) => !requestedItemIds.includes(itemId),
      );
      props.consignments = props.consignments.filter(
        (consignment) => consignment.lineItemIds.length > 0,
      );

      return selectors();
    }),
  );

  props.deleteConsignment.mockImplementation((consignmentId: string) =>
    enqueueShippingOperation(async () => {
      const target = props.consignments.find(({ id }) => id === consignmentId);

      if (!target) {
        throw makeRequestError(404);
      }

      props.consignments = props.consignments.filter(({ id }) => id !== consignmentId);

      return selectors();
    }),
  );

  props.getCheckoutState.mockImplementation(selectors);

  return {
    ownerIds: (itemId: string) =>
      props.consignments
        .filter((consignment) => consignment.lineItemIds.includes(itemId))
        .map(({ id }) => id),
  };
};

const makeAmmoOnlySubject = () => {
  const result = makeSubject(false, (props) => {
    props.fflConsignmentItems = [];
    props.cart.lineItems.physicalItems = [
      { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
    ];
    props.consignments = [
      {
        id: 'stale-ammo-consignment',
        lineItemIds: ['ammo-1'],
        shippingAddress: customerAddress,
      },
    ];
  });

  result.subject.state = {
    ...result.subject.state,
    ammoSelectedState: 'CA',
    ammoStateFFLRequired: true,
    selectedDealer: null,
  };

  return result;
};

describe('DealerShipping ammo reconciliation', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() => new Promise(() => undefined)) as jest.Mock;
  });

  it('loads native shipping data before reporting the shipping step ready', async () => {
    const { subject } = makeSubject(true);
    const onReady = jest.fn();

    (subject.props as any).onReady = onReady;

    await subject.componentDidMount();

    expect(subject.props.loadShippingAddressFields).toHaveBeenCalledTimes(1);
    expect(subject.props.loadShippingOptions).toHaveBeenCalledTimes(1);
    expect(subject.props.loadBillingAddressFields).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('routes a firearm-only cart through the coordinator', async () => {
    const explicitDealer = {
      ...dealerAddress,
      fflID: 'ffl-firearm-only',
      shouldSaveAddress: true,
    };
    const { props, subject } = makeSubject(false, (nextProps) => {
      nextProps.cart.lineItems.physicalItems = [
        { addedByPromotion: false, id: 'gun-1', parentId: null, quantity: 1 },
      ];
      nextProps.consignments = [];
      nextProps.stateRestrictedConsignmentItems = [];
    });
    const model = installStatefulConsignmentSdk(props);

    await subject.selectDealer(explicitDealer);

    expect(props.assignItem).toHaveBeenCalledWith({
      address: expect.objectContaining({
        company: 'Example FFL',
        fflID: 'ffl-firearm-only',
        shouldSaveAddress: false,
      }),
      lineItems: [{ itemId: 'gun-1', quantity: 1 }],
    });
    expect(subject.state.selectedDealer).toEqual(
      expect.objectContaining({ fflID: 'ffl-firearm-only', shouldSaveAddress: false }),
    );
    expect(model.ownerIds('gun-1')).toHaveLength(1);
    expect(props.setSelectedFFL).toHaveBeenCalledWith(
      expect.objectContaining({ fflID: 'ffl-firearm-only', shouldSaveAddress: false }),
    );
  });

  it('routes a restricted ammo-only cart to the selected dealer', async () => {
    const explicitDealer = { ...dealerAddress, fflID: 'ffl-ammo-only' };
    const { props, subject } = makeAmmoOnlySubject();
    const model = installStatefulConsignmentSdk(props);

    await subject.selectDealer(explicitDealer);

    expect(props.assignItem).toHaveBeenCalledWith({
      address: expect.objectContaining({ company: 'Example FFL', fflID: 'ffl-ammo-only' }),
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(model.ownerIds('ammo-1')).toHaveLength(1);
    expect(props.setSelectedFFL).toHaveBeenCalledWith(
      expect.objectContaining({ fflID: 'ffl-ammo-only' }),
    );
  });

  it('keeps manual mode disabled when native unassignment fails', async () => {
    const { props, subject } = makeSubject();
    props.unassignItem.mockRejectedValueOnce(new Error('native unassignment failed'));

    await subject.handleManualFFLInput();

    expect(subject.state.manualFflInput).toBe(false);
    expect(subject.state.selectedDealer).toBe(dealerAddress);
    expect(subject.state.ammoRoutingError).toBe(true);
    expect(props.setSelectedFFL).not.toHaveBeenCalledWith(null);
    expect(props.onUnhandledError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('lets bypass supersede in-flight routing without recreating consignments', async () => {
    let releaseAssign!: () => void;
    let markAssignStarted!: () => void;
    const assignStarted = new Promise<void>((resolve) => {
      markAssignStarted = resolve;
    });
    const assignBlocked = new Promise<void>((resolve) => {
      releaseAssign = resolve;
    });
    const { props, subject } = makeSubject();
    props.cart.id = 'bypass-cart';

    installStatefulConsignmentSdk(props, async () => {
      markAssignStarted();
      await assignBlocked;
    });

    const routing = (subject as any).reconcileAmmoRouting('CA', californiaCustomerAddress);
    await assignStarted;

    const bypass = (subject as any).handleBypassFFLToggle({ target: { checked: true } });
    releaseAssign();
    await Promise.all([routing, bypass]);

    expect(subject.state.bypassFFL).toBe(true);
    expect(subject.state.ammoRoutingError).toBe(false);
    expect(props.consignments).toEqual([]);
    expect(props.deleteConsignment).toHaveBeenCalledTimes(1);
  });

  it('waits for a logged-in ammo customer to select a persisted direct-shipping address', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        announcement: '',
        apply_ammo_state_rules_in_mixed_carts: true,
        bypass_option: false,
        bypass_text: '',
        ffl_to_order_comments: false,
        multi_shipment: false,
        use_generic_ffl_recipient_name: true,
        with_ammo_subscription: true,
      }),
      ok: true,
    }) as jest.Mock;
    const { props, subject } = makeSubject(false, (nextProps) => {
      nextProps.fflConsignmentItems = [];
      nextProps.cart.lineItems.physicalItems = [
        { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
      ];
      nextProps.consignments = [
        {
          id: 'customer-consignment',
          lineItemIds: ['ammo-1'],
          shippingAddress: {
            ...customerAddress,
            localizedCountry: 'United States',
          } as Address,
        },
      ];
    });
    subject.state = { ...subject.state, selectedDealer: null };

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subject.state.ammoSelectedState).toBe('');
    expect(subject.state.ammoStateFFLRequired).toBeNull();
    expect(subject.state.showAmmoFflNotice).toBe(false);
    expect(subject.state.isLoading).toBe(false);
    expect(props.assignItem).not.toHaveBeenCalled();
    expect(props.deleteConsignment).not.toHaveBeenCalled();
    expect(props.setSelectedFFL).not.toHaveBeenCalled();
  });

  it('requires explicit selection before applying a restricted persisted address', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        announcement: '',
        apply_ammo_state_rules_in_mixed_carts: true,
        bypass_option: false,
        bypass_text: '',
        ffl_to_order_comments: false,
        multi_shipment: false,
        use_generic_ffl_recipient_name: true,
        with_ammo_subscription: true,
      }),
      ok: true,
    }) as jest.Mock;
    const californiaAddress = {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    };
    const prepareDefaultAddress = (props: ReturnType<typeof makeProps>) => {
      props.cart.id = 'fresh-default-ca-cart';
      props.fflConsignmentItems = [];
      props.cart.lineItems.physicalItems = [
        { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
      ];
      props.shippingAddress = californiaAddress;
      props.customer.addresses = [californiaAddress];
      props.consignments = [
        {
          id: 'customer-consignment',
          lineItemIds: ['ammo-1'],
          shippingAddress: californiaAddress,
        },
      ];
    };
    const firstCheckout = makeSubject(false, prepareDefaultAddress);
    installStatefulConsignmentSdk(firstCheckout.props);
    firstCheckout.subject.state = {
      ...firstCheckout.subject.state,
      selectedDealer: null,
    };

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(firstCheckout.subject.state.ammoSelectedState).toBe('');
    expect(firstCheckout.subject.state.ammoStateFFLRequired).toBeNull();
    expect(firstCheckout.subject.state.showAmmoFflNotice).toBe(false);
    expect(firstCheckout.props.deleteConsignment).not.toHaveBeenCalled();

    await (firstCheckout.subject as any).handleSelectAddress(californiaAddress, 'ammo-1', 'ammo-1');

    expect(firstCheckout.subject.state.ammoSelectedState).toBe('CA');
    expect(firstCheckout.subject.state.ammoStateFFLRequired).toBe(true);
    expect(firstCheckout.subject.state.showAmmoFflNotice).toBe(true);
    expect(firstCheckout.props.unassignItem).toHaveBeenCalledTimes(1);
  });

  it('waits for address selection in a signed-in firearm, ammo, and regular-item cart', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        announcement: '',
        apply_ammo_state_rules_in_mixed_carts: true,
        bypass_option: false,
        bypass_text: '',
        ffl_to_order_comments: false,
        multi_shipment: false,
        use_generic_ffl_recipient_name: true,
        with_ammo_subscription: true,
      }),
      ok: true,
    }) as jest.Mock;
    const californiaAddress = {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    };
    const { props, subject } = makeSubject(false, (nextProps) => {
      nextProps.cart.id = 'saved-customer-address-refresh';
      nextProps.cart.lineItems.physicalItems.push({
        addedByPromotion: false,
        id: 'regular-1',
        parentId: null,
        quantity: 1,
      });
      nextProps.consignments = [
        {
          id: 'customer-consignment',
          lineItemIds: ['gun-1', 'ammo-1', 'regular-1'],
          shippingAddress: californiaAddress,
        },
      ];
      nextProps.customer.addresses = [californiaAddress];
      nextProps.shippingAddress = californiaAddress;
    });
    const model = installStatefulConsignmentSdk(props);
    subject.state = { ...subject.state, selectedDealer: null };

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subject.state.ammoSelectedState).toBe('');
    expect(subject.state.ammoStateFFLRequired).toBeNull();
    expect(subject.state.showAmmoFflNotice).toBe(false);
    expect(subject.state.selectedDealer).toBeNull();
    expect(
      (subject as any).getExplicitlySelectedCustomerAddress(californiaAddress),
    ).toBeUndefined();
    expect(props.setSelectedFFL).not.toHaveBeenCalled();
    expect(props.deleteConsignment).not.toHaveBeenCalled();
    expect(props.unassignItem).not.toHaveBeenCalled();
    expect(model.ownerIds('ammo-1')).toEqual(['customer-consignment']);
    expect(model.ownerIds('gun-1')).toEqual(['customer-consignment']);
    expect(model.ownerIds('regular-1')).toEqual(['customer-consignment']);

    await (subject as any).handleSelectAddress(californiaAddress, 'regular-1', 'regular-1');

    expect(subject.state.ammoSelectedState).toBe('CA');
    expect(subject.state.ammoStateFFLRequired).toBe(true);
    expect(subject.state.showAmmoFflNotice).toBe(true);
    expect((subject as any).getExplicitlySelectedCustomerAddress(californiaAddress)).toEqual(
      californiaAddress,
    );
    expect(props.unassignItem).toHaveBeenCalledWith({
      address: californiaAddress,
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(model.ownerIds('ammo-1')).toEqual([]);
  });

  it('moves regular items from persisted address A to explicitly selected address B', async () => {
    const { props, subject } = makeSubject(false, (nextProps) => {
      nextProps.cart.lineItems.physicalItems.push({
        addedByPromotion: false,
        id: 'regular-1',
        parentId: null,
        quantity: 1,
      });
      nextProps.consignments = [
        {
          id: 'customer-consignment',
          lineItemIds: ['gun-1', 'ammo-1', 'regular-1'],
          shippingAddress: customerAddress,
        },
      ];
      nextProps.customer.addresses = [customerAddress, californiaCustomerAddress];
      nextProps.shippingAddress = customerAddress;
    });
    const model = installStatefulConsignmentSdk(props);
    subject.state = { ...subject.state, selectedDealer: null };

    await (subject as any).handleSelectAddress(californiaCustomerAddress, 'regular-1', 'regular-1');

    expect(model.ownerIds('ammo-1')).toEqual([]);
    expect(model.ownerIds('regular-1')).toHaveLength(1);
    expect((subject as any).getCustomerItemsConsignment()?.shippingAddress).toEqual(
      californiaCustomerAddress,
    );
    expect((subject as any).getSelectedCustomerAddress()).toEqual(californiaCustomerAddress);
    expect(props.confirmAmmoRoutingSession).toHaveBeenLastCalledWith({
      cartId: 'cart-1',
      confirmedCustomerAddress: californiaCustomerAddress,
      customerIdentityKey: 'customer:4',
      stateCode: 'CA',
    });
    expect(subject.state.ammoRoutingError).toBe(false);
  });

  it('shows address B while restricted routing is still moving the regular item', async () => {
    let releaseAssignment: (() => void) | undefined;
    const assignmentGate = new Promise<void>((resolve) => {
      releaseAssignment = resolve;
    });
    const { props, subject } = makeSubject(false, (nextProps) => {
      nextProps.cart.lineItems.physicalItems.push({
        addedByPromotion: false,
        id: 'regular-1',
        parentId: null,
        quantity: 1,
      });
      nextProps.consignments = [
        {
          id: 'customer-consignment',
          lineItemIds: ['gun-1', 'ammo-1', 'regular-1'],
          shippingAddress: customerAddress,
        },
      ];
      nextProps.customer.addresses = [customerAddress, californiaCustomerAddress];
      nextProps.shippingAddress = customerAddress;
    });
    installStatefulConsignmentSdk(props, async () => assignmentGate);
    subject.state = { ...subject.state, selectedDealer: null };

    const selection = (subject as any).handleSelectAddress(
      californiaCustomerAddress,
      'regular-1',
      'regular-1',
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subject.state.isUpdatingShippingData).toBe(true);
    expect((subject as any).getSelectedCustomerAddress()).toEqual(californiaCustomerAddress);
    expect((subject as any).getCustomerItemsConsignment()?.shippingAddress).toEqual(
      customerAddress,
    );

    releaseAssignment?.();
    await selection;

    expect(subject.state.isUpdatingShippingData).toBe(false);
    expect((subject as any).getCustomerItemsConsignment()?.shippingAddress).toEqual(
      californiaCustomerAddress,
    );
  });

  it('rolls the displayed address back when the SDK does not move the regular item', async () => {
    const { props, subject } = makeSubject(false, (nextProps) => {
      nextProps.cart.lineItems.physicalItems.push({
        addedByPromotion: false,
        id: 'regular-1',
        parentId: null,
        quantity: 1,
      });
      nextProps.consignments = [
        {
          id: 'customer-consignment',
          lineItemIds: ['gun-1', 'ammo-1', 'regular-1'],
          shippingAddress: customerAddress,
        },
      ];
      nextProps.customer.addresses = [customerAddress, californiaCustomerAddress];
      nextProps.shippingAddress = customerAddress;
    });
    installStatefulConsignmentSdk(props);
    props.assignItem.mockImplementation(async () => makeCheckoutSelectors(props));
    subject.state = { ...subject.state, selectedDealer: null };

    await (subject as any).handleSelectAddress(californiaCustomerAddress, 'regular-1', 'regular-1');

    expect(subject.state.ammoRoutingError).toBe(true);
    expect(subject.state.requiresAmmoRoutingReconciliation).toBe(true);
    expect((subject as any).getSelectedCustomerAddress()).toEqual(customerAddress);
    expect(props.setCustomerAddressSelection).not.toHaveBeenCalled();
    expect(props.onUnhandledError).toHaveBeenCalled();
  });

  it('does not expose or route from a persisted guest consignment', () => {
    const props = makeProps(true);
    props.billingAddress = customerAddress;
    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    props.consignments = [
      {
        id: 'cached-customer-consignment',
        lineItemIds: ['ammo-1', 'regular-1'],
        shippingAddress: customerAddress,
      },
    ];
    const subject = new DealerShipping(props as any);

    expect(subject.state.customFirstNameInput).toBe('');
    expect(subject.state.customLastNameInput).toBe('');
    expect((subject as any).getExplicitlySelectedCustomerAddress(customerAddress)).toBeUndefined();
    expect((subject as any).getCustomerDestinationAddress()).toBeUndefined();
  });

  it('keeps BigCommerce countries available to the regular-item add-address modal', () => {
    const { props, subject } = makeSubject(true, (nextProps) => {
      nextProps.stateRestrictedConsignmentItems = [];
      nextProps.cart.lineItems.physicalItems = [
        { addedByPromotion: false, id: 'gun-1', parentId: null, quantity: 1 },
        { addedByPromotion: false, id: 'regular-1', parentId: null, quantity: 1 },
      ];
    });

    const previousLodashGlobal = (global as any)._;
    let addressModals: any[] = [];

    try {
      (global as any)._ = { groupBy };
      addressModals = findElementsByType(subject.render(), AddressFormModal);
    } finally {
      (global as any)._ = previousLodashGlobal;
    }

    expect(addressModals).not.toHaveLength(0);
    expect(addressModals[0].props.countries).toBe(props.countries);
  });

  it('restores a confirmed guest mixed-cart address without unassigning any items', async () => {
    const { props, subject } = makeSubject(true, (nextProps) => {
      nextProps.fflConsignmentItems = [];
      nextProps.cart.lineItems.physicalItems = [
        { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
        { addedByPromotion: false, id: 'regular-1', parentId: null, quantity: 1 },
      ];
      nextProps.consignments = [
        {
          id: 'customer-consignment',
          lineItemIds: ['ammo-1', 'regular-1'],
          shippingAddress: customerAddress,
        },
      ];
      nextProps.confirmedAmmoRoutingSession = {
        cartId: 'cart-1',
        confirmedCustomerAddress: customerAddress,
        customerIdentityKey: 'guest:0',
        stateCode: 'TX',
      };
    });
    subject.state = { ...subject.state, selectedDealer: null };

    await (subject as any).restoreConfirmedAmmoRoutingSession(props.confirmedAmmoRoutingSession);

    expect(props.assignItem).not.toHaveBeenCalled();
    expect(props.unassignItem).not.toHaveBeenCalled();
    expect(subject.state.requiresAmmoRoutingReconciliation).toBe(false);
    expect(subject.state.customerAddressSelection).toEqual(customerAddress);
    expect(subject.state.customFirstNameInput).toBe('Jane');
    expect(subject.state.customLastNameInput).toBe('Doe');
    expect(subject.state.customAddressLine1Input).toBe('100 Customer Way');
    expect(subject.state.customCityInput).toBe('Austin');
    expect(subject.state.customPostCodeInput).toBe('78701');
  });

  it('blocks a restored standard route without a confirmed address and leaves routing untouched', async () => {
    const { props, subject } = makeSubject(true, (nextProps) => {
      nextProps.fflConsignmentItems = [];
      nextProps.cart.lineItems.physicalItems = [
        { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
        { addedByPromotion: false, id: 'regular-1', parentId: null, quantity: 1 },
      ];
      nextProps.confirmedAmmoRoutingSession = {
        cartId: 'cart-1',
        customerIdentityKey: 'guest:0',
        stateCode: 'TX',
      };
    });
    subject.state = { ...subject.state, selectedDealer: null };

    await (subject as any).restoreConfirmedAmmoRoutingSession(props.confirmedAmmoRoutingSession);

    expect(props.assignItem).not.toHaveBeenCalled();
    expect(props.unassignItem).not.toHaveBeenCalled();
    expect(subject.state.ammoSelectedState).toBe('TX');
    expect(subject.state.ammoStateFFLRequired).toBe(false);
    expect(subject.state.requiresAmmoRoutingReconciliation).toBe(true);
    expect(props.onUnhandledError).not.toHaveBeenCalled();
  });

  it('resets persisted dealer ammo by consignment ID while requiring a fresh selection', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        announcement: '',
        apply_ammo_state_rules_in_mixed_carts: true,
        bypass_option: false,
        bypass_text: '',
        ffl_to_order_comments: false,
        multi_shipment: false,
        use_generic_ffl_recipient_name: true,
        with_ammo_subscription: true,
      }),
      ok: true,
    }) as jest.Mock;
    const californiaAddress = {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    };
    const { props, subject } = makeSubject(false, (nextProps) => {
      nextProps.cart.id = 'persisted-dealer-restricted-refresh';
      nextProps.cart.lineItems.physicalItems.push({
        addedByPromotion: false,
        id: 'regular-1',
        parentId: null,
        quantity: 1,
      });
      nextProps.consignments = [
        {
          id: 'dealer-consignment',
          lineItemIds: ['gun-1', 'ammo-1'],
          shippingAddress: committedDealerAddress,
        },
        {
          id: 'customer-consignment',
          lineItemIds: ['regular-1'],
          shippingAddress: californiaAddress,
        },
      ];
      nextProps.customer.addresses = [californiaAddress];
      nextProps.shippingAddress = californiaAddress;
    });
    const model = installStatefulConsignmentSdk(props);
    subject.state = { ...subject.state, selectedDealer: null };

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subject.state.ammoSelectedState).toBe('');
    expect(subject.state.ammoStateFFLRequired).toBeNull();
    expect(props.unassignItem).not.toHaveBeenCalled();
    expect(props.unassignItem).not.toHaveBeenCalled();
    expect(model.ownerIds('ammo-1')).toEqual(['dealer-consignment']);

    await (subject as any).handleSelectAddress(californiaAddress, 'regular-1', 'regular-1');

    expect(props.unassignItem).toHaveBeenCalledWith({
      address: committedDealerAddress,
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(props.onUnhandledError).not.toHaveBeenCalled();
    expect(subject.state.ammoRoutingError).toBe(false);
    expect(subject.state.requiresAmmoRoutingReconciliation).toBe(false);
    expect(subject.state.selectedDealer).toBeNull();
    expect((subject as any).shouldDisableSubmit()).toBe(true);
    expect(model.ownerIds('gun-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('ammo-1')).toEqual([]);
    expect(model.ownerIds('regular-1')).toEqual(['customer-consignment']);
  });

  it('blocks checkout when persisted assignments exist without a fresh dealer selection', async () => {
    const { props, subject } = makeSubject();
    props.consignments = [
      {
        availableShippingOptions: [],
        id: 'persisted-consignment',
        lineItemIds: ['gun-1', 'ammo-1'],
        selectedShippingOption: { id: 'persisted-custom', type: 'custom' },
        shippingAddress: customerAddress,
      },
    ] as any;
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'CA',
      ammoStateFFLRequired: true,
      selectedDealer: null,
    };

    expect((subject as any).shouldDisableSubmit()).toBe(true);

    await (subject as any).handleMultiShippingSubmit({ orderComment: '' });

    expect(props.navigateNextStep).not.toHaveBeenCalled();
  });

  it('allows checkout after a selected dealer and customer address both have shipping methods', async () => {
    const { props, subject } = makeSubject();
    const californiaAddress = {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    };

    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    props.consignments = [
      {
        availableShippingOptions: [{ id: 'dealer-free' }],
        id: 'dealer-consignment',
        lineItemIds: ['gun-1', 'ammo-1'],
        selectedShippingOption: { id: 'dealer-free' },
        shippingAddress: {
          ...committedDealerAddress,
          stateOrProvince: 'Colorado',
          stateOrProvinceCode: 'CO',
        },
      },
      {
        availableShippingOptions: [{ id: 'customer-free' }],
        id: 'customer-consignment',
        lineItemIds: ['regular-1'],
        selectedShippingOption: { id: 'customer-free' },
        shippingAddress: californiaAddress,
      },
    ] as any;
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'CA',
      ammoStateFFLRequired: true,
      selectedDealer: {
        ...dealerAddress,
        stateOrProvince: 'CO',
        stateOrProvinceCode: 'CO',
      },
    };

    expect((subject as any).requiresExplicitDealerSelection()).toBe(false);
    expect((subject as any).shouldDisableSubmit()).toBe(false);

    await (subject as any).handleMultiShippingSubmit({ orderComment: '' });

    expect(props.navigateNextStep).toHaveBeenCalledWith(false);
  });

  it('preserves regular-item shipping when switching a mixed consignment to manual FFL input', async () => {
    const { props, subject } = makeSubject();
    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    props.consignments = [
      {
        id: 'mixed-consignment',
        lineItemIds: ['gun-1', 'ammo-1', 'regular-1'],
        shippingAddress: customerAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'CA',
      ammoStateFFLRequired: true,
    };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).handleManualFFLInput();

    expect(props.deleteConsignment).not.toHaveBeenCalled();
    expect(props.setSelectedFFL).toHaveBeenCalledWith(null);
    expect(model.ownerIds('gun-1')).toEqual([]);
    expect(model.ownerIds('ammo-1')).toEqual([]);
    expect(model.ownerIds('regular-1')).toEqual(['mixed-consignment']);
    expect(subject.state.manualFflInput).toBe(true);
  });

  it('preserves regular-item shipping when missing recipient names clear dealer items', async () => {
    const { props, subject } = makeSubject();
    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    props.consignments = [
      {
        id: 'mixed-consignment',
        lineItemIds: ['gun-1', 'ammo-1', 'regular-1'],
        shippingAddress: committedDealerAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'CA',
      ammoStateFFLRequired: true,
      customFirstNameInput: '',
      customLastNameInput: '',
    };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).commitDealerConsignment();

    expect(props.deleteConsignment).not.toHaveBeenCalled();
    expect(model.ownerIds('gun-1')).toEqual([]);
    expect(model.ownerIds('ammo-1')).toEqual([]);
    expect(model.ownerIds('regular-1')).toEqual(['mixed-consignment']);
    expect(subject.state.customFirstNameInputError).toBe(true);
    expect(subject.state.customLastNameInputError).toBe(true);
  });

  it('accepts a fresh selection of the same persisted dealer without reassigning items', async () => {
    const explicitDealer = { ...dealerAddress, fflID: 'ffl-123' };
    const { props, subject } = makeSubject();
    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['gun-1', 'ammo-1'],
        shippingAddress: committedDealerAddress,
      },
      {
        id: 'customer-consignment',
        lineItemIds: ['regular-1'],
        shippingAddress: customerAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'CA',
      ammoStateFFLRequired: true,
      selectedDealer: null,
    };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).selectDealer(explicitDealer);

    expect(props.assignItem).not.toHaveBeenCalled();
    expect(props.setSelectedFFL).toHaveBeenCalledWith(
      expect.objectContaining({ fflID: 'ffl-123' }),
    );
    expect(model.ownerIds('gun-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('ammo-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('regular-1')).toEqual(['customer-consignment']);
  });

  it('moves only the missing FFL item when the persisted dealer is selected again', async () => {
    const explicitDealer = { ...dealerAddress, fflID: 'ffl-123' };
    const { props, subject } = makeSubject();
    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['gun-1'],
        shippingAddress: committedDealerAddress,
      },
      {
        id: 'customer-consignment',
        lineItemIds: ['ammo-1', 'regular-1'],
        shippingAddress: customerAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'CA',
      ammoStateFFLRequired: true,
      selectedDealer: null,
    };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).selectDealer(explicitDealer);

    expect(props.assignItem).toHaveBeenCalledTimes(1);
    expect(props.assignItem).toHaveBeenCalledWith({
      address: expect.objectContaining({ company: 'Example FFL' }),
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(model.ownerIds('gun-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('ammo-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('regular-1')).toEqual(['customer-consignment']);
  });

  it.each([false, true])(
    'routes an unrestricted completed address for %s guest status',
    async (isGuest) => {
      const { props, subject } = makeSubject(isGuest);

      await (subject as any).handleSelectAddress(customerAddress, 'ammo-1', 'ammo-1');

      expect(subject.state.ammoStateFFLRequired).toBe(false);
      expect(subject.state.selectedDealer).toBe(dealerAddress);
      expect(props.assignItem).not.toHaveBeenCalled();
    },
  );

  it('moves ammo to the retained dealer when the destination becomes restricted', async () => {
    const { props, subject } = makeSubject();

    await (subject as any).reconcileAmmoRouting('CA', {
      ...customerAddress,
      stateOrProvinceCode: 'CA',
    });

    expect(subject.state.ammoStateFFLRequired).toBe(true);
    expect(subject.state.selectedDealer).toBe(dealerAddress);
    expect(props.assignItem).toHaveBeenCalledTimes(1);
    expect(props.assignItem).toHaveBeenCalledWith({
      address: expect.objectContaining({ company: 'Example FFL' }),
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
  });

  it('moves only ammo from the customer consignment when the state becomes restricted', async () => {
    const { props, subject } = makeSubject();
    const californiaAddress = {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    };
    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['gun-1'],
        shippingAddress: committedDealerAddress,
      },
      {
        id: 'customer-consignment',
        lineItemIds: ['ammo-1', 'regular-1'],
        shippingAddress: californiaAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'TX',
      ammoStateFFLRequired: false,
    };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).reconcileAmmoRouting('CA', californiaAddress);

    expect(props.deleteConsignment).not.toHaveBeenCalled();
    expect(props.assignItem).toHaveBeenCalledTimes(1);
    expect(props.assignItem).toHaveBeenCalledWith({
      address: expect.objectContaining({ company: 'Example FFL' }),
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(model.ownerIds('gun-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('ammo-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('regular-1')).toEqual(['customer-consignment']);
  });

  it('keeps the firearm and ammo together when the dealer recipient changes', async () => {
    const { props, subject } = makeSubject();
    const californiaAddress = {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    };
    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['gun-1'],
        shippingAddress: committedDealerAddress,
      },
      {
        id: 'customer-consignment',
        lineItemIds: ['ammo-1', 'regular-1'],
        shippingAddress: californiaAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'TX',
      ammoStateFFLRequired: false,
      customFirstNameInput: 'Janet',
    };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).reconcileAmmoRouting('CA', californiaAddress);

    expect(props.assignItem).toHaveBeenCalledWith({
      address: expect.objectContaining({ firstName: 'Janet' }),
      lineItems: [
        { itemId: 'gun-1', quantity: 1 },
        { itemId: 'ammo-1', quantity: 2 },
      ],
    });
    expect(model.ownerIds('gun-1')).toHaveLength(1);
    expect(model.ownerIds('ammo-1')).toEqual(model.ownerIds('gun-1'));
    expect(model.ownerIds('regular-1')).toEqual(['customer-consignment']);
  });

  it('uses the newest dealer when dealer changes overlap state reconciliation', async () => {
    const { props, subject } = makeSubject();
    const dealerB = {
      ...dealerAddress,
      address1: '300 Dealer Road',
      company: 'Dealer B',
    };
    const dealerC = {
      ...dealerAddress,
      address1: '400 Dealer Road',
      company: 'Dealer C',
    };
    let releaseFirstAssignment: () => void = () => undefined;
    let markFirstAssignmentStarted: () => void = () => undefined;
    const firstAssignmentStarted = new Promise<void>((resolve) => {
      markFirstAssignmentStarted = resolve;
    });
    const model = installStatefulConsignmentSdk(props, async (call) => {
      if (call === 1) {
        markFirstAssignmentStarted();
        await new Promise<void>((resolve) => {
          releaseFirstAssignment = resolve;
        });
      }
    });

    subject.state = { ...subject.state, selectedDealer: dealerB };
    const dealerBCommit = (subject as any).startDealerConsignmentCommit();
    await firstAssignmentStarted;

    const reconciliation = (subject as any).reconcileAmmoRouting('CA', {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    });
    subject.state = { ...subject.state, selectedDealer: dealerC };
    const dealerCCommit = (subject as any).startDealerConsignmentCommit();

    releaseFirstAssignment();
    await Promise.all([dealerBCommit, dealerCCommit, reconciliation]);

    const dealerCConsignment = props.consignments.find(
      ({ shippingAddress }) => shippingAddress.company === 'Dealer C',
    );
    expect(dealerCConsignment?.lineItemIds.sort()).toEqual(['ammo-1', 'gun-1']);
    expect(model.ownerIds('gun-1')).toEqual([dealerCConsignment?.id]);
    expect(model.ownerIds('ammo-1')).toEqual([dealerCConsignment?.id]);
    expect(subject.state.selectedDealer).toBe(dealerC);
    expect(subject.state.ammoRoutingError).toBe(false);
  });

  it('moves only ammo to the customer consignment when the state becomes unrestricted', async () => {
    const { props, subject } = makeSubject();
    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['gun-1', 'ammo-1'],
        shippingAddress: committedDealerAddress,
      },
      {
        id: 'customer-consignment',
        lineItemIds: ['regular-1'],
        shippingAddress: customerAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'CA',
      ammoStateFFLRequired: true,
      customAddressLine1Input: 'dealer-flow-local-value',
    };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).reconcileAmmoRouting('TX', customerAddress);

    expect(props.deleteConsignment).not.toHaveBeenCalled();
    expect(props.assignItem).toHaveBeenCalledTimes(1);
    expect(props.assignItem).toHaveBeenCalledWith({
      address: customerAddress,
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(model.ownerIds('gun-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('ammo-1')).toEqual(['customer-consignment']);
    expect(model.ownerIds('regular-1')).toEqual(['customer-consignment']);
    expect(subject.state.customAddressLine1Input).toBe('dealer-flow-local-value');
  });

  it('keeps the ship non-gun items to FFL override without assigning promotion-added items', async () => {
    const { props, subject } = makeSubject();
    props.cart.lineItems.physicalItems.push(
      {
        addedByPromotion: false,
        id: 'regular-1',
        parentId: null,
        quantity: 1,
      },
      {
        addedByPromotion: true,
        id: 'promotion-1',
        parentId: null,
        quantity: 1,
      },
    );
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['gun-1'],
        shippingAddress: committedDealerAddress,
      },
      {
        id: 'customer-consignment',
        lineItemIds: ['ammo-1', 'regular-1'],
        shippingAddress: customerAddress,
      },
    ];
    subject.state = { ...subject.state, multiShipment: true };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).reconcileAmmoRouting('TX', customerAddress);

    expect(props.assignItem).toHaveBeenCalledTimes(1);
    expect(props.assignItem).toHaveBeenCalledWith({
      address: expect.objectContaining({ company: 'Example FFL' }),
      lineItems: [
        { itemId: 'ammo-1', quantity: 2 },
        { itemId: 'regular-1', quantity: 1 },
      ],
    });
    expect(model.ownerIds('gun-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('ammo-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('regular-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('promotion-1')).toEqual([]);
  });

  it('clears an ammo-only dealer when the destination becomes unrestricted', async () => {
    const { props, subject } = makeSubject(true);
    props.fflConsignmentItems = [];
    props.cart.lineItems.physicalItems = [
      { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
    ];
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['ammo-1'],
        shippingAddress: committedDealerAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'CA',
      ammoStateFFLRequired: true,
    };

    await (subject as any).reconcileAmmoRouting('TX', customerAddress);

    expect(subject.state.ammoStateFFLRequired).toBe(false);
    expect(subject.state.selectedDealer).toBeNull();
    expect(props.setSelectedFFL).toHaveBeenCalledWith(null);
    expect(props.assignItem).toHaveBeenCalledWith({
      address: customerAddress,
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
  });

  it('retains an ammo-only dealer when a newer restricted state supersedes direct shipping', async () => {
    let releaseFirstAssignment: () => void = () => undefined;
    let markFirstAssignmentStarted: () => void = () => undefined;
    const firstAssignmentStarted = new Promise<void>((resolve) => {
      markFirstAssignmentStarted = resolve;
    });
    const { props, subject } = makeAmmoOnlySubject();
    props.cart.id = 'ammo-only-overlap-cart';
    subject.state = { ...subject.state, selectedDealer: dealerAddress };
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['ammo-1'],
        shippingAddress: committedDealerAddress,
      },
    ];
    installStatefulConsignmentSdk(props, async (call) => {
      if (call === 1) {
        markFirstAssignmentStarted();
        await new Promise<void>((resolve) => {
          releaseFirstAssignment = resolve;
        });
      }
    });

    const directShipping = (subject as any).reconcileAmmoRouting('TX', customerAddress);
    await firstAssignmentStarted;

    const restrictedShipping = (subject as any).reconcileAmmoRouting(
      'CA',
      californiaCustomerAddress,
    );
    releaseFirstAssignment();
    await Promise.all([directShipping, restrictedShipping]);

    expect(subject.state.ammoSelectedState).toBe('CA');
    expect(subject.state.ammoStateFFLRequired).toBe(true);
    expect(subject.state.selectedDealer).toBe(dealerAddress);
    expect(props.setSelectedFFL).not.toHaveBeenCalledWith(null);
    expect(
      props.consignments.find(({ lineItemIds }) => lineItemIds.includes('ammo-1'))?.shippingAddress
        .company,
    ).toBe('Example FFL');
  });

  it('honors only the newest state when address changes overlap', async () => {
    const { props, subject } = makeSubject();
    let releaseFirstAssignment: () => void = () => undefined;
    let markFirstAssignmentStarted: () => void = () => undefined;
    const firstAssignmentStarted = new Promise<void>((resolve) => {
      markFirstAssignmentStarted = resolve;
    });
    const model = installStatefulConsignmentSdk(props, async (call) => {
      if (call === 1) {
        markFirstAssignmentStarted();
        await new Promise<void>((resolve) => {
          releaseFirstAssignment = resolve;
        });
      }
    });

    const restricted = (subject as any).reconcileAmmoRouting('CA', {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    });
    await firstAssignmentStarted;

    const unrestricted = (subject as any).reconcileAmmoRouting('TX', customerAddress);
    releaseFirstAssignment();
    await Promise.all([restricted, unrestricted]);

    expect(subject.state.ammoSelectedState).toBe('TX');
    expect(subject.state.ammoStateFFLRequired).toBe(false);
    expect(props.assignItem).toHaveBeenCalledTimes(2);
    expect(props.assignItem).toHaveBeenNthCalledWith(1, {
      address: expect.objectContaining({ company: 'Example FFL' }),
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(props.assignItem).toHaveBeenNthCalledWith(2, {
      address: customerAddress,
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(model.ownerIds('gun-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('ammo-1')).toHaveLength(1);
    expect(model.ownerIds('ammo-1')).not.toContain('dealer-consignment');
    expect(props.confirmAmmoRoutingSession).toHaveBeenCalledTimes(1);
    expect(props.confirmAmmoRoutingSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ stateCode: 'TX' }),
    );
  });

  it('does not let an obsolete routing failure block the newest state', async () => {
    const { props, subject } = makeSubject();
    let rejectFirstAssignment: (error: Error) => void = () => undefined;
    let markFirstAssignmentStarted: () => void = () => undefined;
    const firstAssignmentStarted = new Promise<void>((resolve) => {
      markFirstAssignmentStarted = resolve;
    });
    props.assignItem.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirstAssignment = reject;
          markFirstAssignmentStarted();
        }),
    );

    const restricted = (subject as any).reconcileAmmoRouting('CA', {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    });
    await firstAssignmentStarted;

    const unrestricted = (subject as any).reconcileAmmoRouting('TX', customerAddress);
    rejectFirstAssignment(new Error('obsolete assignment failed'));
    await Promise.all([restricted, unrestricted]);

    expect(subject.state.ammoSelectedState).toBe('TX');
    expect(subject.state.ammoStateFFLRequired).toBe(false);
    expect(subject.state.ammoRoutingError).toBe(false);
    expect(subject.state.requiresAmmoRoutingReconciliation).toBe(false);
    expect(props.onUnhandledError).not.toHaveBeenCalled();
  });

  it('stops before assigning customer items when the dealer ammo move fails', async () => {
    const { props, subject } = makeSubject();
    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['gun-1'],
        shippingAddress: committedDealerAddress,
      },
    ];
    props.assignItem.mockRejectedValueOnce(new Error('assign failed'));

    await (subject as any).reconcileAmmoRouting('CA', {
      ...customerAddress,
      stateOrProvinceCode: 'CA',
    });

    expect(subject.state.ammoRoutingError).toBe(true);
    expect(subject.state.requiresAmmoRoutingReconciliation).toBe(true);
    expect(props.assignItem).toHaveBeenCalledTimes(1);
    expect(props.assignItem).toHaveBeenCalledWith({
      address: expect.objectContaining({ company: 'Example FFL' }),
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(props.onUnhandledError).toHaveBeenCalledTimes(1);
  });

  it('unblocks after a customer-address assignment is retried successfully', async () => {
    const { props, subject } = makeSubject(true);
    props.fflConsignmentItems = [];
    props.cart.lineItems.physicalItems = [
      { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'TX',
      ammoStateFFLRequired: false,
      selectedDealer: null,
    };
    props.consignments = [];
    props.assignItem.mockRejectedValueOnce(new Error('assign failed'));

    await (subject as any).assignCustomerItemsToAddress(customerAddress);
    expect(subject.state.ammoRoutingError).toBe(true);

    await (subject as any).assignCustomerItemsToAddress(customerAddress);
    expect(subject.state.ammoRoutingError).toBe(false);
  });

  it('accepts BigCommerce normalization for a guest ammo-only shipping address', async () => {
    const { props, subject } = makeSubject(true);
    props.fflConsignmentItems = [];
    props.cart.lineItems.physicalItems = [
      { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
    ];
    props.consignments = [];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'TX',
      ammoStateFFLRequired: false,
      customAddressLine1Input: '100 Customer Way',
      customAddressLine2Input: '',
      customCityInput: 'Austin',
      customCompanyInput: '',
      customFirstNameInput: 'Jane',
      customLastNameInput: 'Doe',
      customPhoneInput: '5555550100',
      customPostCodeInput: '78701',
      selectedDealer: null,
    };
    props.assignItem.mockImplementation(async ({ address, lineItems }) => {
      const normalizedAddress = { ...address, country: 'United States' };
      delete normalizedAddress.customFields;
      props.consignments = [
        {
          id: 'customer-consignment',
          lineItemIds: lineItems.map((lineItem: { itemId: string }) => lineItem.itemId),
          shippingAddress: normalizedAddress,
        },
      ];

      return makeCheckoutSelectors(props);
    });

    (subject as any).debouncedAssignCustomShippingAddress();
    await (subject as any).debouncedAssignCustomShippingAddress.flush();

    expect(props.assignItem).toHaveBeenCalledWith({
      address: {
        address1: '100 Customer Way',
        address2: '',
        city: 'Austin',
        company: '',
        countryCode: 'US',
        customFields: [],
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '5555550100',
        postalCode: '78701',
        shouldSaveAddress: false,
        stateOrProvince: 'Texas',
        stateOrProvinceCode: 'TX',
      },
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(subject.state.ammoRoutingError).toBe(false);
    expect(props.onUnhandledError).not.toHaveBeenCalled();
    expect(props.confirmAmmoRoutingSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cartId: 'cart-1',
        confirmedCustomerAddress: expect.objectContaining({
          address1: '100 Customer Way',
          stateOrProvince: 'Texas',
          stateOrProvinceCode: 'TX',
        }),
        customerIdentityKey: 'guest:0',
        stateCode: 'TX',
      }),
    );

    (subject as any).debouncedAssignCustomShippingAddress();
    await (subject as any).debouncedAssignCustomShippingAddress.flush();

    expect(props.assignItem).toHaveBeenCalledTimes(1);
  });

  it('rejects a returned customer-item consignment at a different destination', async () => {
    const { props, subject } = makeSubject(true);
    props.fflConsignmentItems = [];
    props.cart.lineItems.physicalItems = [
      { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
    ];
    props.consignments = [];
    props.assignItem.mockImplementation(async () => {
      props.consignments = [
        {
          id: 'customer-consignment',
          lineItemIds: ['ammo-1'],
          shippingAddress: californiaCustomerAddress,
        },
      ];

      return makeCheckoutSelectors(props);
    });

    await expect((subject as any).assignCustomerItemsToAddress(customerAddress)).resolves.toBe(
      false,
    );

    expect(subject.state.ammoRoutingError).toBe(true);
    expect(props.onUnhandledError).toHaveBeenCalledTimes(1);
  });

  it('assigns a new guest address without deleting the dealer or saving an account address', async () => {
    const { props, subject } = makeSubject(true);
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['gun-1'],
        shippingAddress: committedDealerAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: '',
      ammoStateFFLRequired: null,
      itemAddingAddress: { itemId: 'ammo-1', key: 'ammo-1' },
    };

    await (subject as any).handleSaveAddress({
      ...customerAddress,
      customFields: {},
      shouldSaveAddress: true,
    });

    expect(props.deleteConsignment).not.toHaveBeenCalled();
    expect(props.assignItem).toHaveBeenCalledTimes(1);
    expect(props.assignItem).toHaveBeenCalledWith({
      address: { ...customerAddress, shouldSaveAddress: false },
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(props.createCustomerAddress).not.toHaveBeenCalled();
    expect(subject.state.showAmmoFflNotice).toBe(false);
    expect(subject.state.itemAddingAddress).toBeUndefined();
  });

  it.each([false, true])(
    'moves ammo into the existing dealer consignment for %s guest status and a restricted new address',
    async (isGuest) => {
      const { props, subject } = makeSubject(isGuest);
      props.consignments = isGuest
        ? []
        : [
            {
              id: 'dealer-consignment',
              lineItemIds: ['gun-1'],
              shippingAddress: committedDealerAddress,
            },
          ];
      props.cart.lineItems.physicalItems.push({
        addedByPromotion: false,
        id: 'regular-1',
        parentId: null,
        quantity: 1,
      });
      subject.state = {
        ...subject.state,
        ammoSelectedState: '',
        ammoStateFFLRequired: null,
        customFirstNameInput: isGuest ? '' : subject.state.customFirstNameInput,
        customLastNameInput: isGuest ? '' : subject.state.customLastNameInput,
        itemAddingAddress: { itemId: 'ammo-1', key: 'ammo-1' },
      };
      const model = installStatefulConsignmentSdk(props);

      if (isGuest) {
        await (subject as any).startDealerConsignmentCommit();
        expect(props.assignItem).not.toHaveBeenCalled();
      }

      await (subject as any).handleSaveAddress({
        ...customerAddress,
        customFields: {},
        shouldSaveAddress: true,
        stateOrProvince: 'California',
        stateOrProvinceCode: 'CA',
      });

      expect(props.deleteConsignment).not.toHaveBeenCalled();
      expect(props.assignItem).toHaveBeenNthCalledWith(1, {
        address: expect.objectContaining({ company: 'Example FFL' }),
        lineItems: isGuest
          ? [
              { itemId: 'gun-1', quantity: 1 },
              { itemId: 'ammo-1', quantity: 2 },
            ]
          : [{ itemId: 'ammo-1', quantity: 2 }],
      });
      expect(props.assignItem).toHaveBeenNthCalledWith(2, {
        address: expect.objectContaining({ stateOrProvinceCode: 'CA' }),
        lineItems: [{ itemId: 'regular-1', quantity: 1 }],
      });
      expect(props.createCustomerAddress).toHaveBeenCalledTimes(isGuest ? 0 : 1);
      expect(subject.state.ammoStateFFLRequired).toBe(true);
      expect(subject.state.customFirstNameInput).toBe('Jane');
      expect(subject.state.customLastNameInput).toBe('Doe');
      expect(subject.state.showAmmoFflNotice).toBe(true);
      expect(subject.state.itemAddingAddress).toBeUndefined();
      expect(model.ownerIds('gun-1')).toHaveLength(1);
      expect(model.ownerIds('ammo-1')).toEqual(model.ownerIds('gun-1'));
      expect(model.ownerIds('regular-1')).toHaveLength(1);
      expect(model.ownerIds('regular-1')).not.toContain('dealer-consignment');
    },
  );

  it('does not show the FFL notice during a non-customer-triggered reconciliation', async () => {
    const { subject } = makeSubject(true);

    await (subject as any).reconcileAmmoRouting('CA', {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    });

    expect(subject.state.ammoStateFFLRequired).toBe(true);
    expect(subject.state.showAmmoFflNotice).toBe(false);
  });

  it('shows the FFL notice immediately without reopening it after dismissal', async () => {
    const { props, subject } = makeSubject(false);
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'TX',
      ammoStateFFLRequired: false,
    };
    let releaseAssignment: () => void = () => undefined;
    let markAssignmentStarted: () => void = () => undefined;
    const assignmentStarted = new Promise<void>((resolve) => {
      markAssignmentStarted = resolve;
    });
    installStatefulConsignmentSdk(props, async (call) => {
      if (call === 1) {
        markAssignmentStarted();
        await new Promise<void>((resolve) => {
          releaseAssignment = resolve;
        });
      }
    });

    const addressSelection = (subject as any).handleSelectAddress(
      {
        ...customerAddress,
        stateOrProvince: 'California',
        stateOrProvinceCode: 'CA',
      },
      'ammo-1',
      'ammo-1',
    );
    await assignmentStarted;

    expect(subject.state.showAmmoFflNotice).toBe(true);
    expect(subject.state.ammoFflNoticeState).toBe('California');
    expect(subject.state.isUpdatingShippingData).toBe(true);

    (subject as any).handleCloseAmmoFflNotice();
    releaseAssignment();
    await addressSelection;

    expect(subject.state.showAmmoFflNotice).toBe(false);
    expect(subject.state.isUpdatingShippingData).toBe(false);
  });

  it('does not mutate a restricted mixed cart until its customer address is available', async () => {
    const { props, subject } = makeSubject(true);
    const californiaAddress = {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    };
    props.fflConsignmentItems = [];
    props.cart.lineItems.physicalItems = [
      { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
      { addedByPromotion: false, id: 'regular-1', parentId: null, quantity: 1 },
    ];
    props.consignments = [];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'TX',
      ammoStateFFLRequired: false,
      itemAddingAddress: { itemId: 'regular-1', key: 'regular-1' },
    };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).validateSelectedState({ target: { value: 'CA' } });

    expect(subject.state.ammoStateFFLRequired).toBe(true);
    expect(subject.state.showAmmoFflNotice).toBe(false);
    expect(subject.state.requiresAmmoRoutingReconciliation).toBe(true);
    expect(model.ownerIds('ammo-1')).toHaveLength(0);
    expect(model.ownerIds('regular-1')).toHaveLength(0);

    await (subject as any).handleSaveAddress({
      ...californiaAddress,
      customFields: {},
      shouldSaveAddress: true,
    });

    expect(subject.state.showAmmoFflNotice).toBe(true);
    expect(model.ownerIds('ammo-1')).toHaveLength(1);
    expect(model.ownerIds('regular-1')).toHaveLength(1);
    expect(model.ownerIds('ammo-1')).not.toEqual(model.ownerIds('regular-1'));
    expect(subject.state.customAddressLine1Input).toBe('');
  });

  it('prefills the guest direct-shipping form after a new address makes an ammo cart unrestricted', async () => {
    const { props, subject } = makeSubject(true);
    const texasAddress = {
      ...customerAddress,
      address2: 'Suite 200',
      company: 'Customer Company',
      phone: '5555550199',
    };
    props.fflConsignmentItems = [];
    props.cart.lineItems.physicalItems = [
      { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
      { addedByPromotion: false, id: 'regular-1', parentId: null, quantity: 1 },
    ];
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['ammo-1'],
        shippingAddress: committedDealerAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'CA',
      ammoStateFFLRequired: true,
      customAddressLine1Input: '',
      customAddressLine2Input: '',
      customCityInput: '',
      customCompanyInput: '',
      customPhoneInput: '',
      customPostCodeInput: '',
      itemAddingAddress: { itemId: 'regular-1', key: 'regular-1' },
    };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).handleSaveAddress({
      ...texasAddress,
      customFields: {},
      shouldSaveAddress: true,
    });

    expect(subject.state.ammoStateFFLRequired).toBe(false);
    expect(subject.state.customFirstNameInput).toBe('Jane');
    expect(subject.state.customLastNameInput).toBe('Doe');
    expect(subject.state.customCompanyInput).toBe('Customer Company');
    expect(subject.state.customPhoneInput).toBe('5555550199');
    expect(subject.state.customAddressLine1Input).toBe('100 Customer Way');
    expect(subject.state.customAddressLine2Input).toBe('Suite 200');
    expect(subject.state.customCityInput).toBe('Austin');
    expect(subject.state.customPostCodeInput).toBe('78701');
    expect(subject.state.customerAddressSelection).toEqual(
      expect.objectContaining({ address1: '100 Customer Way', stateOrProvinceCode: 'TX' }),
    );
    expect(model.ownerIds('ammo-1')).toEqual(model.ownerIds('regular-1'));
    expect(props.assignItem).toHaveBeenCalledTimes(1);
    expect(props.createCustomerAddress).not.toHaveBeenCalled();
  });

  it('shows the notice when submitted address still needs ammo assigned to an FFL', async () => {
    const { props, subject } = makeSubject(true);
    const californiaAddress = {
      ...customerAddress,
      stateOrProvince: 'California',
      stateOrProvinceCode: 'CA',
    };
    props.fflConsignmentItems = [];
    props.cart.lineItems.physicalItems = [
      { addedByPromotion: false, id: 'ammo-1', parentId: null, quantity: 2 },
      { addedByPromotion: false, id: 'regular-1', parentId: null, quantity: 1 },
    ];
    props.consignments = [];
    subject.state = {
      ...subject.state,
      ammoSelectedState: 'TX',
      ammoStateFFLRequired: false,
      itemAddingAddress: { itemId: 'regular-1', key: 'regular-1' },
      selectedDealer: null,
    };
    const model = installStatefulConsignmentSdk(props);

    await (subject as any).validateSelectedState({ target: { value: 'CA' } });

    expect(subject.state.showAmmoFflNotice).toBe(false);
    expect(model.ownerIds('ammo-1')).toHaveLength(0);

    await (subject as any).handleSaveAddress({
      ...californiaAddress,
      customFields: {},
      shouldSaveAddress: true,
    });

    expect(subject.state.showAmmoFflNotice).toBe(true);
    expect(model.ownerIds('ammo-1')).toHaveLength(0);
    expect(model.ownerIds('regular-1')).toHaveLength(1);
  });

  it('does not show a state notice when legacy mixed-cart routing already requires an FFL', async () => {
    const { props, subject } = makeSubject(true);
    props.consignments = [
      {
        id: 'dealer-consignment',
        lineItemIds: ['gun-1'],
        shippingAddress: committedDealerAddress,
      },
    ];
    subject.state = {
      ...subject.state,
      applyAmmoStateRulesInMixedCarts: false,
      ammoSelectedState: '',
      ammoStateFFLRequired: null,
    };

    await (subject as any).handleSelectAddress(
      {
        ...customerAddress,
        stateOrProvince: 'California',
        stateOrProvinceCode: 'CA',
      },
      'ammo-1',
      'ammo-1',
    );

    expect(subject.state.showAmmoFflNotice).toBe(false);
  });

  it('dismisses the FFL shipping notice', () => {
    const { subject } = makeSubject(true);
    subject.state = { ...subject.state, showAmmoFflNotice: true };

    (subject as any).handleCloseAmmoFflNotice();

    expect(subject.state.showAmmoFflNotice).toBe(false);
  });

  it('still saves a new address to a signed-in customer account', async () => {
    const { props, subject } = makeSubject(false);
    subject.state = {
      ...subject.state,
      itemAddingAddress: { itemId: 'ammo-1', key: 'ammo-1' },
    };

    await (subject as any).handleSaveAddress({
      ...customerAddress,
      customFields: {},
      shouldSaveAddress: true,
    });

    expect(props.createCustomerAddress).toHaveBeenCalledWith({
      ...customerAddress,
      shouldSaveAddress: true,
    });
    expect(subject.state.itemAddingAddress).toBeUndefined();
  });
});
