import { Address } from '@bigcommerce/checkout-sdk';
import { identity, isEqual, pickBy } from 'lodash';

import { DealerShipping } from './DealerShipping';

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

const makeProps = (isGuest = false) => {
  const props = {
    assignItem: jest.fn().mockResolvedValue({}),
    billingAddress: undefined as Address | undefined,
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
    customer: { addresses: isGuest ? [] : [customerAddress], id: isGuest ? 0 : 4, isGuest },
    createCustomerAddress: jest.fn().mockResolvedValue({}),
    deleteConsignment: jest.fn().mockResolvedValue({}),
    fflConsignmentItems: [{ itemId: 'gun-1', quantity: 1 }],
    fflProducts: [{ conditions: [{ states: ['CA', 'NY'], type: 'ship_state' }] }],
    getCurrentConsignments: jest.fn(),
    getFields: jest.fn().mockReturnValue([]),
    isLoading: false,
    isValid: true,
    customerMessage: '',
    navigateNextStep: jest.fn(),
    onUnhandledError: jest.fn(),
    reloadCheckout: jest.fn(),
    selectedFFL: null,
    setFFLtoOrderComments: jest.fn(),
    setCustomerAddressSelection: jest.fn(),
    setSelectedFFL: jest.fn(),
    setWithAmmoSubscription: jest.fn(),
    shippingAddress: isGuest ? undefined : customerAddress,
    stateRestrictedConsignmentItems: [{ itemId: 'ammo-1', quantity: 2 }],
    storeHash: 'store-hash',
    unassignItem: jest.fn().mockResolvedValue({}),
    updateConsignment: jest.fn().mockResolvedValue({}),
    updateCheckout: jest.fn().mockResolvedValue({}),
  };

  props.getCurrentConsignments.mockImplementation(() => props.consignments);
  props.reloadCheckout.mockImplementation(async () => makeCheckoutSelectors(props));

  return props;
};

const makeSubject = (
  isGuest = false,
  prepareProps?: (props: ReturnType<typeof makeProps>) => void,
) => {
  const props = makeProps(isGuest);
  prepareProps?.(props);
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
      customFields: address.customFields,
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

  props.updateConsignment.mockImplementation((request: any) =>
    enqueueShippingOperation(async () => {
      const target = props.consignments.find(({ id }) => id === request.id);

      if (!target) {
        throw new Error('No consignment found for the specified ID');
      }

      target.lineItemIds = (request.lineItems || []).map((lineItem: any) => lineItem.itemId);
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

  it('uses live SDK consignments before attempting an ammo deletion', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    props.getCurrentConsignments.mockReturnValue([]);

    await expect((subject as any).unassignAmmunition()).resolves.toBe(true);

    expect(props.deleteConsignment).not.toHaveBeenCalled();
    expect(props.reloadCheckout).not.toHaveBeenCalled();
    expect(props.onUnhandledError).not.toHaveBeenCalled();
  });

  it('accepts a delete 404 only after reload verifies that ammo is unassigned', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    installStatefulConsignmentSdk(props);
    props.deleteConsignment.mockRejectedValueOnce(makeRequestError(404));
    props.reloadCheckout.mockImplementation(async () => {
      props.consignments = [];

      return makeCheckoutSelectors(props);
    });

    await expect((subject as any).unassignAmmunition()).resolves.toBe(true);

    expect(props.deleteConsignment).toHaveBeenCalledTimes(1);
    expect(props.deleteConsignment).toHaveBeenCalledWith('stale-ammo-consignment');
    expect(props.reloadCheckout).toHaveBeenCalledTimes(1);
    expect(props.onUnhandledError).not.toHaveBeenCalled();
  });

  it('retries a delete once with the refreshed consignment ID', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    const model = installStatefulConsignmentSdk(props);
    props.deleteConsignment.mockRejectedValueOnce(makeRequestError(404));
    props.reloadCheckout.mockImplementation(async () => {
      props.consignments = [
        {
          id: 'fresh-ammo-consignment',
          lineItemIds: ['ammo-1'],
          shippingAddress: customerAddress,
        },
      ];

      return makeCheckoutSelectors(props);
    });

    await expect((subject as any).unassignAmmunition()).resolves.toBe(true);

    expect(props.deleteConsignment.mock.calls).toEqual([
      ['stale-ammo-consignment'],
      ['fresh-ammo-consignment'],
    ]);
    expect(props.reloadCheckout).toHaveBeenCalledTimes(1);
    expect(model.ownerIds('ammo-1')).toEqual([]);
    expect(props.onUnhandledError).not.toHaveBeenCalled();
  });

  it('updates a refreshed mixed consignment instead of deleting its regular item', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    props.cart.lineItems.physicalItems.push({
      addedByPromotion: false,
      id: 'regular-1',
      parentId: null,
      quantity: 1,
    });
    const model = installStatefulConsignmentSdk(props);
    props.deleteConsignment.mockRejectedValueOnce(makeRequestError(404));
    props.reloadCheckout.mockImplementation(async () => {
      props.consignments = [
        {
          id: 'fresh-mixed-consignment',
          lineItemIds: ['ammo-1', 'regular-1'],
          shippingAddress: customerAddress,
        },
      ];

      return makeCheckoutSelectors(props);
    });

    await expect((subject as any).unassignAmmunition()).resolves.toBe(true);

    expect(props.deleteConsignment).toHaveBeenCalledTimes(1);
    expect(props.updateConsignment).toHaveBeenCalledWith({
      id: 'fresh-mixed-consignment',
      lineItems: [{ itemId: 'regular-1', quantity: 1 }],
    });
    expect(model.ownerIds('ammo-1')).toEqual([]);
    expect(model.ownerIds('regular-1')).toEqual(['fresh-mixed-consignment']);
    expect(props.onUnhandledError).not.toHaveBeenCalled();
  });

  it('surfaces a second delete 404 without attempting a third mutation', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    installStatefulConsignmentSdk(props);
    props.deleteConsignment
      .mockRejectedValueOnce(makeRequestError(404))
      .mockRejectedValueOnce(makeRequestError(404));
    props.reloadCheckout.mockImplementation(async () => {
      props.consignments = [
        {
          id: 'fresh-ammo-consignment',
          lineItemIds: ['ammo-1'],
          shippingAddress: customerAddress,
        },
      ];

      return makeCheckoutSelectors(props);
    });

    await expect((subject as any).unassignAmmunition()).resolves.toBe(false);

    expect(props.deleteConsignment.mock.calls).toEqual([
      ['stale-ammo-consignment'],
      ['fresh-ammo-consignment'],
    ]);
    expect(props.reloadCheckout).toHaveBeenCalledTimes(1);
    expect(props.onUnhandledError).toHaveBeenCalledTimes(1);
    expect(subject.state.ammoRoutingError).toBe(true);
    expect(subject.state.requiresAmmoRoutingReconciliation).toBe(true);
  });

  it('does not reload after a non-404 ammo deletion failure', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    props.deleteConsignment.mockRejectedValueOnce(makeRequestError(500));

    await expect((subject as any).unassignAmmunition()).resolves.toBe(false);

    expect(props.deleteConsignment).toHaveBeenCalledTimes(1);
    expect(props.reloadCheckout).not.toHaveBeenCalled();
    expect(props.onUnhandledError).toHaveBeenCalledTimes(1);
  });

  it('rejects a delete 404 when reload does not return the active checkout', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    props.deleteConsignment.mockRejectedValueOnce(makeRequestError(404));
    props.reloadCheckout.mockResolvedValue(
      makeCheckoutSelectors(props, { checkoutId: 'different-checkout' }),
    );

    await expect((subject as any).unassignAmmunition()).resolves.toBe(false);

    expect(props.reloadCheckout).toHaveBeenCalledTimes(1);
    expect(props.onUnhandledError).toHaveBeenCalledTimes(1);
  });

  it('keeps checkout blocked when delete 404 recovery cannot reload checkout', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    props.deleteConsignment.mockRejectedValueOnce(makeRequestError(404));
    props.reloadCheckout.mockRejectedValueOnce(new Error('Checkout reload failed'));

    await expect((subject as any).unassignAmmunition()).resolves.toBe(false);

    expect(props.reloadCheckout).toHaveBeenCalledTimes(1);
    expect(props.onUnhandledError).toHaveBeenCalledTimes(1);
    expect(subject.state.ammoRoutingError).toBe(true);
    expect(subject.state.requiresAmmoRoutingReconciliation).toBe(true);
  });

  it('abandons stale 404 recovery when the routing revision changes during reload', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    let resolveReload: (selectors: any) => void = () => undefined;
    props.deleteConsignment.mockRejectedValueOnce(makeRequestError(404));
    props.reloadCheckout.mockReturnValue(
      new Promise((resolve) => {
        resolveReload = resolve;
      }),
    );
    (subject as any).ammoRoutingRevision = 1;

    const result = (subject as any).unassignAmmunition(1);
    await Promise.resolve();
    await Promise.resolve();
    (subject as any).ammoRoutingRevision = 2;
    resolveReload(makeCheckoutSelectors(props));

    await expect(result).resolves.toBe(false);
    expect(props.deleteConsignment).toHaveBeenCalledTimes(1);
    expect(props.onUnhandledError).not.toHaveBeenCalled();
  });

  it('does not remove ammo that reaches a selected dealer during 404 recovery', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    installStatefulConsignmentSdk(props);
    let resolveReload: (selectors: any) => void = () => undefined;
    props.deleteConsignment.mockRejectedValueOnce(makeRequestError(404));
    props.reloadCheckout.mockReturnValue(
      new Promise((resolve) => {
        resolveReload = resolve;
      }),
    );

    const result = (subject as any).unassignAmmunition();
    await Promise.resolve();
    await Promise.resolve();
    subject.selectDealer(dealerAddress);
    await (subject as any).pendingDealerCommit;
    resolveReload(makeCheckoutSelectors(props));

    await expect(result).resolves.toBe(true);
    expect(props.deleteConsignment).toHaveBeenCalledTimes(1);
    expect(props.updateConsignment).not.toHaveBeenCalled();
    expect(
      props.consignments.some(
        (consignment) =>
          consignment.lineItemIds.includes('ammo-1') &&
          isEqual(
            normalizeSdkAddress(consignment.shippingAddress),
            normalizeSdkAddress(committedDealerAddress),
          ),
      ),
    ).toBe(true);
    expect(props.onUnhandledError).not.toHaveBeenCalled();
  });

  it('removes refreshed customer ammo when dealer selection remains incomplete', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    installStatefulConsignmentSdk(props);
    props.deleteConsignment.mockRejectedValueOnce(makeRequestError(404));
    props.reloadCheckout.mockImplementation(async () => {
      props.consignments = [
        {
          id: 'fresh-customer-consignment',
          lineItemIds: ['ammo-1'],
          shippingAddress: customerAddress,
        },
      ];
      subject.state = { ...subject.state, selectedDealer: dealerAddress };

      return makeCheckoutSelectors(props);
    });

    await expect((subject as any).unassignAmmunition()).resolves.toBe(true);

    expect(props.deleteConsignment.mock.calls).toEqual([
      ['stale-ammo-consignment'],
      ['fresh-customer-consignment'],
    ]);
    expect(props.onUnhandledError).not.toHaveBeenCalled();
  });

  it('keeps manual cleanup delete 404s terminal', async () => {
    const { props, subject } = makeAmmoOnlySubject();
    props.deleteConsignment.mockRejectedValueOnce(makeRequestError(404));

    await expect(
      (subject as any).unassignLineItemsFromConsignment(
        props.consignments[0],
        props.stateRestrictedConsignmentItems,
      ),
    ).resolves.toBe('failure');

    expect(props.reloadCheckout).not.toHaveBeenCalled();
    expect(props.onUnhandledError).toHaveBeenCalledTimes(1);
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
    expect(firstCheckout.props.deleteConsignment).toHaveBeenCalledTimes(1);
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
    expect(props.updateConsignment).not.toHaveBeenCalled();
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
    expect(props.updateConsignment).toHaveBeenCalledWith({
      id: 'customer-consignment',
      lineItems: [
        { itemId: 'gun-1', quantity: 1 },
        { itemId: 'regular-1', quantity: 1 },
      ],
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
    expect(props.setCustomerAddressSelection).toHaveBeenLastCalledWith(californiaCustomerAddress);
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
    props.unassignItem.mockRejectedValue(
      new Error('No consignment found for the specified address'),
    );
    subject.state = { ...subject.state, selectedDealer: null };

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subject.state.ammoSelectedState).toBe('');
    expect(subject.state.ammoStateFFLRequired).toBeNull();
    expect(props.unassignItem).not.toHaveBeenCalled();
    expect(props.updateConsignment).not.toHaveBeenCalled();
    expect(model.ownerIds('ammo-1')).toEqual(['dealer-consignment']);

    await (subject as any).handleSelectAddress(californiaAddress, 'regular-1', 'regular-1');

    expect(props.updateConsignment).toHaveBeenCalledWith({
      id: 'dealer-consignment',
      lineItems: [{ itemId: 'gun-1', quantity: 1 }],
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

    (subject as any).selectDealer(explicitDealer);
    await (subject as any).pendingDealerCommit;

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

    (subject as any).selectDealer(explicitDealer);
    await (subject as any).pendingDealerCommit;

    expect(props.assignItem).toHaveBeenCalledTimes(1);
    expect(props.assignItem).toHaveBeenCalledWith({
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
      shippingAddress: expect.objectContaining({ fflID: 'ffl-123' }),
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
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
      shippingAddress: expect.objectContaining({ company: 'Example FFL' }),
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
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
      shippingAddress: expect.objectContaining({ company: 'Example FFL' }),
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
      lineItems: [
        { itemId: 'gun-1', quantity: 1 },
        { itemId: 'ammo-1', quantity: 2 },
      ],
      shippingAddress: expect.objectContaining({ firstName: 'Janet' }),
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
      lineItems: [
        { itemId: 'ammo-1', quantity: 2 },
        { itemId: 'regular-1', quantity: 1 },
      ],
      shippingAddress: expect.objectContaining({ company: 'Example FFL' }),
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
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
      shippingAddress: expect.objectContaining({ company: 'Example FFL' }),
    });
    expect(props.assignItem).toHaveBeenNthCalledWith(2, {
      address: customerAddress,
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
    });
    expect(model.ownerIds('gun-1')).toEqual(['dealer-consignment']);
    expect(model.ownerIds('ammo-1')).toHaveLength(1);
    expect(model.ownerIds('ammo-1')).not.toContain('dealer-consignment');
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
      lineItems: [{ itemId: 'ammo-1', quantity: 2 }],
      shippingAddress: expect.objectContaining({ company: 'Example FFL' }),
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
    props.assignItem.mockRejectedValueOnce(new Error('assign failed')).mockResolvedValueOnce({});

    await (subject as any).assignCustomerItemsToAddress(customerAddress);
    expect(subject.state.ammoRoutingError).toBe(true);

    await (subject as any).assignCustomerItemsToAddress(customerAddress);
    expect(subject.state.ammoRoutingError).toBe(false);
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
      address: { ...customerAddress, shouldSaveAddress: true },
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
        lineItems: isGuest
          ? [
              { itemId: 'gun-1', quantity: 1 },
              { itemId: 'ammo-1', quantity: 2 },
            ]
          : [{ itemId: 'ammo-1', quantity: 2 }],
        shippingAddress: expect.objectContaining({ company: 'Example FFL' }),
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

  it('does not show the notice when ammo was already assigned to the FFL before address submission', async () => {
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
    expect(model.ownerIds('ammo-1')).toHaveLength(1);
    expect(model.ownerIds('regular-1')).toHaveLength(0);

    await (subject as any).handleSaveAddress({
      ...californiaAddress,
      customFields: {},
      shouldSaveAddress: true,
    });

    expect(subject.state.showAmmoFflNotice).toBe(false);
    expect(model.ownerIds('ammo-1')).toHaveLength(1);
    expect(model.ownerIds('regular-1')).toHaveLength(1);
    expect(model.ownerIds('ammo-1')).not.toEqual(model.ownerIds('regular-1'));
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
