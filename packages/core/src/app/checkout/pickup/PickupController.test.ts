import { Cart, CheckoutSelectors, Consignment } from '@bigcommerce/checkout-sdk';

import { createFflConsignmentCoordinator } from '../dealer/fflConsignmentCoordinator';

import { matchesPickup, PickupChoice, pickupCartSignature } from './pickup';
import PickupController from './PickupController';

const choice = { id: 7, location: { entityId: 3 }, displayName: 'Collect' } as PickupChoice;
const flush = async () => {
  for (let i = 0; i < 30; i += 1) {
    await Promise.resolve();
  }
};

const setup = () => {
  const cart = {
    id: 'cart-1',
    lineItems: {
      physicalItems: [
        { id: 'gun', variantId: 12, quantity: 1 },
        { id: 'ammo', variantId: 13, quantity: 2 },
        { id: 'shirt', variantId: 14, quantity: 1 },
      ],
    },
  } as Cart;
  let consignments: Consignment[] = [];
  let customerMessage = 'Please ring the bell';
  const state = {
    data: {
      getCart: () => cart,
      getCheckout: () => ({ id: cart.id, customerMessage }),
      getConsignments: () => consignments,
    },
  } as CheckoutSelectors;
  const save = async (request: any) => {
    consignments = [
      {
        id: request.id || 'new',
        selectedPickupOption: request.pickupOption,
        lineItemIds: request.lineItems.map(({ itemId }: any) => itemId),
      } as Consignment,
    ];

    return state;
  };
  const sdk = {
    getState: () => state,
    createConsignments: jest.fn(async ([body]) => save(body)),
    updateConsignment: jest.fn(save),
    deleteConsignment: jest.fn(async (id) => {
      consignments = consignments.filter((c) => c.id !== id);
      return state;
    }),
    assignItemsToAddress: jest.fn(async () => state),
    unassignItemsToAddress: jest.fn(async () => state),
  };
  const handoffPublisher = { configure: jest.fn(), dispose: jest.fn(), publish: jest.fn() };
  const coordinator = createFflConsignmentCoordinator({ ...sdk, handoffPublisher });
  const deps = {
    coordinator,
    getState: () => state,
    onChange: jest.fn(async () => undefined),
    onRequireDelivery: jest.fn(),
    onConfirmed: jest.fn(),
    onShipping: jest.fn(),
    settleShipping: jest.fn(async () => undefined),
    log: jest.fn(),
    updateCheckout: jest.fn(async (body) => {
      customerMessage = body.customerMessage;
      return state;
    }),
    discover: jest.fn(async () => [choice]),
  };
  const controller = new PickupController(deps);

  return {
    cart,
    state,
    sdk,
    coordinator,
    controller,
    deps,
    handoffPublisher,
    setConsignments: (value: Consignment[]) => {
      consignments = value;
    },
    setMessage: (value: string) => {
      customerMessage = value;
    },
  };
};

describe('shared native pickup', () => {
  it.each(['idle', 'loading'])(
    'accepts pickup during %s discovery and waits for eligibility before confirming',
    async (status) => {
      const { controller, deps, sdk } = setup();
      let resolveDiscovery: (choices: PickupChoice[]) => void = () => undefined;
      deps.discover.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveDiscovery = resolve;
          }),
      );
      if (status === 'loading') {
        controller.observe(true);
        await flush();
      }

      await controller.choosePickup();
      expect(controller.state.intent).toBe('pickup');
      expect(controller.state.status).toBe('loading');
      expect(controller.state.draftMethodId).toBeUndefined();
      await controller.confirm();
      expect(sdk.createConsignments).not.toHaveBeenCalled();
      expect(deps.onConfirmed).not.toHaveBeenCalled();
      expect(deps.discover).toHaveBeenCalledTimes(1);

      resolveDiscovery([choice]);
      await flush();
      expect(controller.state.draftMethodId).toBe(choice.id);
      expect(controller.isReady()).toBe(false);
      await controller.confirm();
      expect(controller.isReady()).toBe(true);
    },
  );

  it('keeps shipping selected when the shopper switches back before discovery finishes', async () => {
    const { controller, deps, sdk } = setup();
    let resolveDiscovery: (choices: PickupChoice[]) => void = () => undefined;
    deps.discover.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDiscovery = resolve;
        }),
    );
    controller.observe(true);
    await flush();
    await controller.choosePickup();
    await controller.chooseShipping();
    resolveDiscovery([choice]);
    await flush();

    expect(controller.state.intent).toBe('shipping');
    expect(controller.state.status).toBe('ready');
    expect(controller.state.draftMethodId).toBeUndefined();
    expect(sdk.createConsignments).not.toHaveBeenCalled();
    expect(deps.onConfirmed).not.toHaveBeenCalled();
  });

  it('can leave pickup after the last physical item is removed', async () => {
    const { controller, cart, deps } = setup();
    controller.observe(true);
    await flush();
    await controller.choosePickup();
    await controller.confirm();
    cart.lineItems.physicalItems = [];
    controller.observe(false);
    await flush();
    await controller.chooseShipping();
    expect(controller.state.intent).toBe('shipping');
    expect(deps.onShipping).toHaveBeenCalled();
    expect(deps.onConfirmed).toHaveBeenCalledTimes(2);
  });

  it('keeps initial discovery failure out of ordinary shipping and shows active failures with retry', async () => {
    const { controller, deps } = setup();
    deps.discover.mockRejectedValueOnce(new Error('offline'));
    controller.observe(true);
    await flush();
    expect(controller.state.intent).toBe('shipping');
    expect(controller.state.message).toBeUndefined();
    await controller.refresh();
    await controller.choosePickup();
    deps.discover.mockRejectedValueOnce(new Error('offline'));
    await controller.refresh();
    expect(controller.state.intent).toBe('pickup');
    expect(controller.state.message).toBe('availability_error');
    expect(controller.isReady()).toBe(false);
    await controller.refresh();
    expect(controller.state.status).toBe('ready');
  });

  it('requires an explicit choice for multiple methods and reconfirmation after identity or draft changes', async () => {
    const { controller, deps } = setup();
    deps.discover.mockResolvedValue([choice, { ...choice, id: 8 }]);
    controller.observe(true);
    await flush();
    await controller.choosePickup();
    expect(controller.state.draftMethodId).toBeUndefined();
    await controller.confirm();
    expect(deps.onConfirmed).not.toHaveBeenCalled();
    controller.chooseMethod(8);
    await controller.confirm();
    expect(controller.isReady()).toBe(true);
    controller.chooseMethod(7);
    expect(controller.isReady()).toBe(false);
    await controller.confirm();
    controller.invalidate();
    await flush();
    expect(controller.isReady()).toBe(false);
    expect(controller.state.draftMethodId).toBe(7);
    controller.reset();
    expect(controller.state.intent).toBe('shipping');
    controller.dispose();
  });

  it('cleans previous dealer notes and blocks progression if comment persistence fails', async () => {
    const { controller, deps, setMessage, state } = setup();
    const message =
      'Shopper note|FFL#6-04-123-01-5F-03791|Expiration:06/01/2025|EZcheck:https://fflezcheck.atf.gov/FFLEzCheck/fflSearch?licsRegn=6&licsDis=04&licsSeq=03791';
    setMessage(message);
    controller.observe(true);
    await flush();
    await controller.choosePickup();
    expect(state.data.getCheckout()?.customerMessage).toBe('Shopper note');
    deps.updateCheckout.mockRejectedValueOnce(new Error('offline'));
    await controller.confirm('Updated shopper note');
    expect(controller.isReady()).toBe(false);
    expect(deps.onConfirmed).not.toHaveBeenCalled();
    await controller.confirm('Updated shopper note');
    expect(controller.isReady()).toBe(true);
  });

  it('discovers without an address and only selects the sole method after entering pickup', async () => {
    const { controller, sdk } = setup();
    controller.observe(true);
    await flush();
    expect(controller.state.draftMethodId).toBeUndefined();
    expect(controller.state.intent).toBe('shipping');
    await controller.choosePickup();
    expect(controller.state.draftMethodId).toBe(7);
    expect(sdk.createConsignments).not.toHaveBeenCalled();
    await controller.confirm();
    expect(sdk.createConsignments).toHaveBeenCalledWith([
      {
        pickupOption: { pickupMethodId: 7 },
        lineItems: [
          { itemId: 'gun', quantity: 1 },
          { itemId: 'ammo', quantity: 2 },
          { itemId: 'shirt', quantity: 1 },
        ],
      },
    ]);
    expect(controller.isReady()).toBe(true);
  });

  it.each([1, 2])('converts %i shipping consignments through the same operation', async (count) => {
    const { controller, sdk, setConsignments, handoffPublisher } = setup();
    setConsignments(
      Array.from(
        { length: count },
        (_, i) => ({ id: `old-${i}`, lineItemIds: [] } as unknown as Consignment),
      ),
    );
    controller.observe(true);
    await flush();
    await controller.choosePickup();
    await controller.confirm();
    expect(sdk.deleteConsignment).toHaveBeenCalledTimes(count === 1 ? 0 : count);
    expect(sdk.updateConsignment).toHaveBeenCalledTimes(count === 1 ? 1 : 0);
    expect(sdk.createConsignments).toHaveBeenCalledTimes(count === 1 ? 0 : 1);
    expect(handoffPublisher.publish).toHaveBeenCalledWith({ active: false }, expect.anything());
    expect(controller.isReady()).toBe(true);
  });

  it('invalidates a quantity change at payment without automatically repairing the consignment', async () => {
    const { controller, cart, sdk, deps, state } = setup();
    controller.observe(true);
    await flush();
    await controller.choosePickup();
    await controller.confirm();
    cart.lineItems.physicalItems[1].quantity = 3;
    controller.observe(false);
    await flush();
    expect(deps.onRequireDelivery).toHaveBeenCalled();
    expect(controller.isReady()).toBe(false);
    expect(controller.state.draftMethodId).toBe(7);
    expect(sdk.updateConsignment).not.toHaveBeenCalled();
    await expect(controller.preflight(state)).rejects.toThrow('confirm your pickup');
    await controller.confirm();
    expect(sdk.updateConsignment.mock.calls[0][0].lineItems[1].quantity).toBe(3);
    expect(controller.isReady()).toBe(true);
  });

  it('restores native pickup as an unconfirmed draft and republishes inactive handoff', async () => {
    const { controller, state, setConsignments, handoffPublisher } = setup();
    setConsignments([
      {
        id: 'saved',
        selectedPickupOption: { pickupMethodId: 7 },
        lineItemIds: ['gun', 'ammo', 'shirt'],
      } as Consignment,
    ]);
    controller.observe(false);
    await flush();
    expect(controller.state.intent).toBe('pickup');
    expect(controller.state.draftMethodId).toBe(7);
    expect(controller.isReady()).toBe(false);
    expect(handoffPublisher.publish).toHaveBeenCalledWith({ active: false });
    await expect(controller.preflight(state)).rejects.toThrow();
    await controller.confirm();
    await expect(controller.preflight(state)).resolves.toBeUndefined();
  });

  it('clears pickup before returning to shipping and keeps pickup visible if deletion fails', async () => {
    const { controller, sdk, state, deps } = setup();
    controller.observe(true);
    await flush();
    await controller.choosePickup();
    await controller.confirm();
    sdk.deleteConsignment.mockRejectedValueOnce(new Error('offline'));
    await controller.chooseShipping();
    expect(controller.state.intent).toBe('pickup');
    expect(controller.state.message).toBe('switch_error');
    expect(deps.onShipping).not.toHaveBeenCalled();
    await controller.chooseShipping('Keep my notes');
    expect(state.data.getConsignments()).toEqual([]);
    expect(state.data.getCheckout()?.customerMessage).toBe('Keep my notes');
    expect(controller.state.intent).toBe('shipping');
  });

  it('does not confirm when the cart changes during saving', async () => {
    const { controller, sdk, cart, deps, state } = setup();
    sdk.createConsignments.mockImplementationOnce(async () => {
      cart.lineItems.physicalItems[0].quantity = 4;
      return state;
    });
    controller.observe(true);
    await flush();
    await controller.choosePickup();
    await controller.confirm();
    expect(controller.isReady()).toBe(false);
    expect(deps.onConfirmed).not.toHaveBeenCalled();
  });

  it('ignores an old discovery response after a cart change', async () => {
    const { controller, deps, cart } = setup();
    let resolveOld: (choices: PickupChoice[]) => void = () => undefined;
    deps.discover.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    controller.observe(true);
    await flush();
    cart.lineItems.physicalItems[0].quantity = 2;
    deps.discover.mockResolvedValueOnce([]);
    controller.observe(true);
    await flush();
    resolveOld([choice]);
    await flush();
    expect(controller.state.choices).toEqual([]);
    expect(controller.state.signature).toBe(pickupCartSignature(cart));
  });

  it('rejects incomplete item coverage, duplicate assignment, and mixed native fulfilment', () => {
    const { cart, state, setConsignments } = setup();
    const signature = pickupCartSignature(cart);
    for (const ids of [['gun'], ['gun', 'ammo', 'ammo']]) {
      setConsignments([
        { id: 'one', selectedPickupOption: { pickupMethodId: 7 }, lineItemIds: ids } as Consignment,
      ]);
      expect(matchesPickup(state, signature, 7)).toBe(false);
    }
    setConsignments([
      {
        id: 'one',
        selectedPickupOption: { pickupMethodId: 7 },
        selectedShippingOption: { id: 'carrier' },
        lineItemIds: ['gun', 'ammo', 'shirt'],
      } as Consignment,
    ]);
    expect(matchesPickup(state, signature, 7)).toBe(false);
  });

  it('waits for shipping to settle and prevents later dealer writes until shipping resumes', async () => {
    const { controller, deps, coordinator, sdk } = setup();
    let settle: () => void = () => undefined;
    deps.settleShipping.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = () => resolve(undefined);
        }),
    );
    controller.observe(true);
    await flush();
    const choosing = controller.choosePickup();
    await flush();
    expect(controller.state.transitioning).toBe(true);
    const plan = { cartId: 'cart-1', assignments: [], unassignedItemIds: [] };
    await expect(coordinator.reconcile(plan)).resolves.toEqual({ status: 'superseded' });
    await controller.confirm();
    expect(sdk.createConsignments).not.toHaveBeenCalled();
    settle();
    await choosing;
    await controller.chooseShipping();
    await expect(coordinator.reconcile(plan)).resolves.toEqual({
      status: 'fulfilled',
      checkoutState: expect.anything(),
    });
  });
});
