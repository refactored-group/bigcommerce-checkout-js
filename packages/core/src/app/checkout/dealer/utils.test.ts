import { DealerData } from './types';
import {
  canCommitDealerConsignment,
  formatDealerForSelection,
  isAmmunitionOnlyCart,
  isAmmoFflRequiredState,
  resolveAmmoCheckoutSessionState,
  resolveAmmoRouting,
  resolveFflRecipientName,
  shouldDisableFflShippingSubmit,
  shouldShowAmmoAddressSelector,
  shouldShowCustomerRecipientNameFields,
} from './utils';

describe('isAmmunitionOnlyCart', () => {
  it('matches a cart containing only ammunition items', () => {
    expect(isAmmunitionOnlyCart(['ammo-1', 'ammo-2'], ['ammo-1', 'ammo-2'])).toBe(true);
  });

  it('rejects a mixed ammunition and ordinary-product cart', () => {
    expect(isAmmunitionOnlyCart(['ammo-1', 'coffee-1'], ['ammo-1'])).toBe(false);
  });

  it('rejects a cart with no ammunition', () => {
    expect(isAmmunitionOnlyCart(['coffee-1'], [])).toBe(false);
  });
});

describe('canCommitDealerConsignment', () => {
  it('requires both a selected dealer and FFL-bound items', () => {
    expect(canCommitDealerConsignment(true, 1)).toBe(true);
    expect(canCommitDealerConsignment(true, 0)).toBe(false);
    expect(canCommitDealerConsignment(false, 1)).toBe(false);
  });
});

const fflProducts = [
  {
    conditions: [
      {
        states: ['CA', 'NY'],
        type: 'ship_state',
      },
    ],
  },
];

describe('isAmmoFflRequiredState', () => {
  it('matches ship-state restrictions without assuming every product has conditions', () => {
    expect(isAmmoFflRequiredState('CA', [{}, ...fflProducts])).toBe(true);
    expect(isAmmoFflRequiredState('TX', [{}, ...fflProducts])).toBe(false);
  });
});

describe('resolveAmmoRouting', () => {
  const mixedCart = {
    applyAmmoStateRulesInMixedCarts: true,
    fflProducts,
    hasAmmunition: true,
    hasFirearms: true,
    multiShipment: false,
    stateCode: 'TX',
    withAmmoSubscription: true,
  };

  it('ships mixed-cart ammo normally in an unrestricted state by default', () => {
    expect(resolveAmmoRouting(mixedCart)).toBe('standard');
  });

  it('routes mixed-cart ammo to the dealer in a restricted state', () => {
    expect(resolveAmmoRouting({ ...mixedCart, stateCode: 'CA' })).toBe('ffl');
  });

  it('preserves legacy mixed-cart routing when the setting is disabled', () => {
    expect(resolveAmmoRouting({ ...mixedCart, applyAmmoStateRulesInMixedCarts: false })).toBe(
      'ffl',
    );
  });

  it('lets Ship Non-gun items to FFL override mixed-cart state routing', () => {
    expect(resolveAmmoRouting({ ...mixedCart, multiShipment: true })).toBe('ffl');
  });

  it('requires a destination before applying state rules', () => {
    expect(resolveAmmoRouting({ ...mixedCart, stateCode: '' })).toBe('pending');
  });

  it('keeps ammo-only carts state based regardless of the mixed-cart setting', () => {
    const ammoOnlyCart = {
      ...mixedCart,
      applyAmmoStateRulesInMixedCarts: false,
      hasFirearms: false,
    };

    expect(resolveAmmoRouting({ ...ammoOnlyCart, stateCode: '' })).toBe('pending');
    expect(resolveAmmoRouting({ ...ammoOnlyCart, stateCode: 'CA' })).toBe('ffl');
    expect(resolveAmmoRouting({ ...ammoOnlyCart, stateCode: 'TX' })).toBe('standard');
  });

  it('does not apply ammo routing without restricted ammo or the subscription', () => {
    expect(resolveAmmoRouting({ ...mixedCart, hasAmmunition: false })).toBe('standard');
    expect(resolveAmmoRouting({ ...mixedCart, withAmmoSubscription: false })).toBe('standard');
  });
});

describe('resolveAmmoCheckoutSessionState', () => {
  const sessionState = {
    ammoSelectedState: 'CA',
    ammoStateFFLRequired: true,
    cartId: 'cart-1',
    customerIdentityKey: 'customer:4',
  };

  it('restores state while the same checkout page moves between steps', () => {
    expect(resolveAmmoCheckoutSessionState('cart-1', 'customer:4', sessionState)).toEqual(
      sessionState,
    );
  });

  it('does not carry state into a different cart', () => {
    expect(resolveAmmoCheckoutSessionState('cart-2', 'customer:4', sessionState)).toBeNull();
  });

  it('does not carry signed-in routing state into a guest checkout', () => {
    expect(resolveAmmoCheckoutSessionState('cart-1', 'guest:0', sessionState)).toBeNull();
  });
});

describe('shouldDisableFflShippingSubmit', () => {
  it('blocks a quoted partial consignment while ammo is still unassigned', () => {
    expect(
      shouldDisableFflShippingSubmit({
        hasAmmoRoutingError: false,
        hasSelectedShippingOptions: true,
        hasUnassignedLineItems: true,
        isAmmoStateSelectionPending: false,
        isLoading: false,
        isUpdatingShippingData: false,
      }),
    ).toBe(true);
  });

  it('allows checkout once every item is assigned and quoted', () => {
    expect(
      shouldDisableFflShippingSubmit({
        hasAmmoRoutingError: false,
        hasSelectedShippingOptions: true,
        hasUnassignedLineItems: false,
        isAmmoStateSelectionPending: false,
        isLoading: false,
        isUpdatingShippingData: false,
      }),
    ).toBe(false);
  });

  it('blocks checkout until the store ammo settings are loaded', () => {
    expect(
      shouldDisableFflShippingSubmit({
        hasAmmoRoutingError: false,
        hasSelectedShippingOptions: true,
        hasUnassignedLineItems: false,
        isAmmoStateSelectionPending: false,
        isLoading: true,
        isUpdatingShippingData: false,
      }),
    ).toBe(true);
  });

  it('blocks checkout until the buyer chooses an ammo destination state', () => {
    expect(
      shouldDisableFflShippingSubmit({
        hasAmmoRoutingError: false,
        hasSelectedShippingOptions: true,
        hasUnassignedLineItems: false,
        isAmmoStateSelectionPending: true,
        isLoading: false,
        isUpdatingShippingData: false,
      }),
    ).toBe(true);
  });

  it('keeps checkout blocked after a routing reconciliation failure', () => {
    expect(
      shouldDisableFflShippingSubmit({
        hasAmmoRoutingError: true,
        hasSelectedShippingOptions: true,
        hasUnassignedLineItems: false,
        isAmmoStateSelectionPending: false,
        isLoading: false,
        isUpdatingShippingData: false,
      }),
    ).toBe(true);
  });
});

describe('resolveFflRecipientName', () => {
  it('uses trimmed customer names when the setting is missing or disabled', () => {
    expect(
      resolveFflRecipientName({
        customerFirstName: ' Jane ',
        customerLastName: ' Doe ',
      }),
    ).toEqual({ firstName: 'Jane', lastName: 'Doe' });

    expect(
      resolveFflRecipientName({
        customerFirstName: 'Jane',
        customerLastName: 'Doe',
        resolvedFirstName: 'FFL',
        resolvedLastName: 'Receiving',
        useGenericRecipientName: false,
      }),
    ).toEqual({ firstName: 'Jane', lastName: 'Doe' });
  });

  it('uses the recipient already resolved by AutoFFL when the setting is enabled', () => {
    expect(
      resolveFflRecipientName({
        customerFirstName: 'Jane',
        customerLastName: 'Doe',
        resolvedFirstName: ' FFL ',
        resolvedLastName: ' Receiving ',
        useGenericRecipientName: true,
      }),
    ).toEqual({ firstName: 'FFL', lastName: 'Receiving' });
  });
});

describe('shouldShowCustomerRecipientNameFields', () => {
  it('hides guest ammo names until a state is selected regardless of the generic setting', () => {
    for (const useGenericRecipientName of [false, true]) {
      expect(
        shouldShowCustomerRecipientNameFields({
          ammoStateFflRequired: null,
          hasFflItems: false,
          hasOnlyAmmunition: true,
          isGuest: true,
          useGenericRecipientName,
        }),
      ).toBe(false);
    }
  });

  it('keeps customer name collection for guest non-FFL shipping', () => {
    expect(
      shouldShowCustomerRecipientNameFields({
        ammoStateFflRequired: false,
        hasFflItems: false,
        hasOnlyAmmunition: true,
        isGuest: true,
        useGenericRecipientName: true,
      }),
    ).toBe(true);
  });

  it('hides extra name fields for signed-in ammo until the saved address requires an FFL', () => {
    for (const ammoStateFflRequired of [null, false]) {
      expect(
        shouldShowCustomerRecipientNameFields({
          ammoStateFflRequired,
          hasFflItems: false,
          hasOnlyAmmunition: true,
          isGuest: false,
          useGenericRecipientName: false,
        }),
      ).toBe(false);
    }
  });

  it('shows customer names for signed-in FFL-required ammo when generic names are disabled', () => {
    expect(
      shouldShowCustomerRecipientNameFields({
        ammoStateFflRequired: true,
        hasFflItems: true,
        hasOnlyAmmunition: true,
        isGuest: false,
        useGenericRecipientName: false,
      }),
    ).toBe(true);
  });

  it('hides customer names for signed-in FFL-required ammo when generic names are enabled', () => {
    expect(
      shouldShowCustomerRecipientNameFields({
        ammoStateFflRequired: true,
        hasFflItems: true,
        hasOnlyAmmunition: true,
        isGuest: false,
        useGenericRecipientName: true,
      }),
    ).toBe(false);
  });
});

describe('shouldShowAmmoAddressSelector', () => {
  const baseOptions = {
    hasAmmunitionOnlyCart: true,
    hasAmmoWithoutFirearms: true,
    isBypassEnabled: false,
    isGuest: false,
  };

  it('hides the saved-address dropdown after the selected state requires an FFL', () => {
    expect(
      shouldShowAmmoAddressSelector({
        ...baseOptions,
        ammoStateFflRequired: true,
      }),
    ).toBe(false);
  });

  it('shows the saved-address dropdown while the destination is undecided or allows direct shipping', () => {
    for (const ammoStateFflRequired of [null, false]) {
      expect(
        shouldShowAmmoAddressSelector({
          ...baseOptions,
          ammoStateFflRequired,
        }),
      ).toBe(true);
    }
  });

  it('keeps the dropdown for the ordinary-item consignment in a mixed ammo cart', () => {
    expect(
      shouldShowAmmoAddressSelector({
        ...baseOptions,
        ammoStateFflRequired: true,
        hasAmmunitionOnlyCart: false,
      }),
    ).toBe(true);
  });
});

describe('formatDealerForSelection', () => {
  it('keeps the dealer business name in company', () => {
    const dealer: DealerData = {
      id: '123',
      business_name: 'A Very Long Dealer Business Name LLC',
      license: '1-23-456-78-9A-01234',
      phone_number: '5555551234',
      premise_street: '100 Main St',
      premise_city: 'Denver',
      premise_state: 'CO',
      premise_zip: '80202',
      lat: 39.7392,
      lng: -104.9903,
      fees: [],
      schedules: [],
    };

    expect(formatDealerForSelection(dealer).company).toBe(dealer.business_name);
  });

  it('passes through the AutoFFL-resolved recipient name', () => {
    const dealer: DealerData = {
      id: '123',
      business_name: 'ACME Guns',
      license: '1-23-456-78-9A-01234',
      phone_number: '5555551234',
      premise_street: '100 Main St',
      premise_city: 'Denver',
      premise_state: 'CO',
      premise_zip: '80202',
      lat: 39.7392,
      lng: -104.9903,
      fees: [],
      schedules: [],
      shipping_recipient_first_name: 'FFL',
      shipping_recipient_last_name: 'Receiving',
    };

    expect(formatDealerForSelection(dealer)).toMatchObject({
      firstName: 'FFL',
      lastName: 'Receiving',
    });
  });
});
