import { Address } from '@bigcommerce/checkout-sdk';

import { Checkout } from './Checkout';
import CheckoutStepType from './CheckoutStepType';

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

const makeCheckout = () => {
  const cart = {
    id: 'cart-1',
    lineItems: {
      physicalItems: [],
    },
  };
  let consignments: any[] = [];
  const selectors = () =>
    ({
      data: {
        getCart: () => cart,
        getCheckout: () => ({ id: cart.id }),
        getConsignments: () => consignments,
      },
    } as any);
  const deleteConsignment = jest.fn(async (id: string) => {
    consignments = consignments.filter((consignment) => consignment.id !== id);

    return selectors();
  });
  const props = {
    analyticsTracker: { exitCheckout: jest.fn() },
    assignItemsToAddress: jest.fn(),
    cart,
    clearError: jest.fn(),
    consignments,
    deleteConsignment,
    getCheckoutState: selectors,
    loadShippingAddressFields: jest.fn().mockResolvedValue(selectors()),
    loadShippingOptions: jest.fn().mockResolvedValue(selectors()),
    steps: [],
    unassignItemsToAddress: jest.fn(),
  } as any;
  const checkout = new Checkout(props);

  (checkout as any).setState = (update: any) => {
    const nextState =
      typeof update === 'function' ? update(checkout.state, checkout.props) : update;
    checkout.state = { ...checkout.state, ...nextState };
  };

  return {
    checkout,
    deleteConsignment,
    props,
    selectors,
    setConsignments: (nextConsignments: any[]) => {
      consignments = nextConsignments;
      props.consignments = nextConsignments;
    },
  };
};

describe('Checkout FFL lifecycle', () => {
  it('owns one coordinator and an identity-scoped confirmed route across Shipping renders', () => {
    const { checkout } = makeCheckout();
    const coordinator = (checkout as any).fflConsignmentCoordinator;
    (checkout as any).customerIdentityKey = 'guest:0';
    (checkout as any).state = {
      ...checkout.state,
      fflLineItems: [],
      fflProducts: [],
      fflStateRestrictedItems: [],
    };

    (checkout as any).confirmAmmoRoutingSession({
      cartId: 'cart-1',
      confirmedCustomerAddress: customerAddress,
      customerIdentityKey: 'guest:0',
      stateCode: 'TX',
    });

    const step = {
      isActive: true,
      isBusy: false,
      isRequired: true,
      type: CheckoutStepType.Shipping,
    } as any;
    const firstDealer = (checkout as any).renderDealerShippingStep(step).props.children.props
      .children;
    const secondDealer = (checkout as any).renderDealerShippingStep(step).props.children.props
      .children;

    expect(firstDealer.props.fflConsignmentCoordinator).toBe(coordinator);
    expect(secondDealer.props.fflConsignmentCoordinator).toBe(coordinator);
    expect(checkout.state.confirmedAmmoRoutingSession).toEqual(
      expect.objectContaining({ customerIdentityKey: 'guest:0', stateCode: 'TX' }),
    );

    (checkout as any).confirmAmmoRoutingSession({
      cartId: 'cart-1',
      customerIdentityKey: 'customer:4',
      stateCode: 'CA',
    });

    expect(checkout.state.confirmedAmmoRoutingSession).toEqual(
      expect.objectContaining({ customerIdentityKey: 'guest:0', stateCode: 'TX' }),
    );
  });

  it('clears identity-bound consignments through the shared coordinator', async () => {
    const { checkout, deleteConsignment, props, selectors, setConsignments } = makeCheckout();
    setConsignments([
      { id: 'consignment-1', lineItemIds: [], shippingAddress: customerAddress },
      { id: 'consignment-2', lineItemIds: [], shippingAddress: customerAddress },
    ]);

    const result = await (checkout as any).resetFflShippingState(selectors());

    expect(deleteConsignment.mock.calls.map(([id]) => id)).toEqual([
      'consignment-1',
      'consignment-2',
    ]);
    expect(result.data.getConsignments()).toEqual([]);
    expect(props.loadShippingAddressFields).toHaveBeenCalledTimes(1);
    expect(props.loadShippingOptions).toHaveBeenCalledTimes(1);
  });

  it('keeps the confirmed route and dealer when identity cleanup fails', async () => {
    const { checkout, deleteConsignment, selectors, setConsignments } = makeCheckout();
    const confirmedAmmoRoutingSession = {
      cartId: 'cart-1',
      confirmedCustomerAddress: customerAddress,
      customerIdentityKey: 'guest:0',
      stateCode: 'TX',
    };
    const handleUnhandledError = jest.fn();

    setConsignments([{ id: 'consignment-1', lineItemIds: [], shippingAddress: customerAddress }]);
    deleteConsignment.mockRejectedValueOnce(new Error('cleanup failed'));
    (checkout as any).state = {
      ...checkout.state,
      confirmedAmmoRoutingSession,
      customerAddressSelection: customerAddress,
      selectedFFL: customerAddress,
    };
    (checkout as any).isFflRelatedCart = true;
    (checkout as any).customerIdentityKey = 'guest:1';
    (checkout as any).handleUnhandledError = handleUnhandledError;

    await (checkout as any).queueCustomerIdentityReset(selectors(), 'guest:1');

    expect(checkout.state.confirmedAmmoRoutingSession).toBe(confirmedAmmoRoutingSession);
    expect(checkout.state.customerAddressSelection).toBe(customerAddress);
    expect(checkout.state.selectedFFL).toBe(customerAddress);
    expect(handleUnhandledError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('clears the confirmed route and dealer only after identity cleanup succeeds', async () => {
    const { checkout, selectors, setConsignments } = makeCheckout();

    setConsignments([{ id: 'consignment-1', lineItemIds: [], shippingAddress: customerAddress }]);
    (checkout as any).state = {
      ...checkout.state,
      confirmedAmmoRoutingSession: {
        cartId: 'cart-1',
        confirmedCustomerAddress: customerAddress,
        customerIdentityKey: 'guest:0',
        stateCode: 'TX',
      },
      customerAddressSelection: customerAddress,
      selectedFFL: customerAddress,
    };
    (checkout as any).isFflRelatedCart = true;
    (checkout as any).customerIdentityKey = 'guest:1';

    await (checkout as any).queueCustomerIdentityReset(selectors(), 'guest:1');

    expect(checkout.state.confirmedAmmoRoutingSession).toBeUndefined();
    expect(checkout.state.customerAddressSelection).toBeUndefined();
    expect(checkout.state.selectedFFL).toBeNull();
    expect(checkout.state.isResolvingFflShipping).toBe(false);
  });
});
