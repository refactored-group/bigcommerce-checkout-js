import { Address, CheckoutSelectors, Consignment } from '@bigcommerce/checkout-sdk';

import {
  CheckoutHandoffClient,
  CheckoutHandoffHttpError,
  createCheckoutHandoffClient,
  createCheckoutHandoffPublisher,
  isSameCheckoutHandoffDestination,
} from './checkoutHandoff';

const dealerAddress = {
  address1: '200 Dealer Road',
  address2: '',
  city: 'Denver',
  company: 'Example FFL',
  country: 'United States',
  countryCode: 'US',
  customFields: [],
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '5555550100',
  postalCode: '80202',
  stateOrProvince: 'Colorado',
  stateOrProvinceCode: 'CO',
} as Address;

const otherAddress = {
  ...dealerAddress,
  address1: '300 Other Road',
  company: 'Other FFL',
} as Address;

const makeCheckoutState = (shippingAddress?: Address): CheckoutSelectors =>
  ({
    data: {
      getCart: () => ({
        id: 'cart-1',
        lineItems: { physicalItems: [{ id: 'gun-1' }] },
      }),
      getConsignments: () =>
        shippingAddress
          ? ([
              {
                id: 'dealer-consignment',
                lineItemIds: ['gun-1'],
                shippingAddress,
              } as Consignment,
            ] as Consignment[])
          : [],
    },
  } as CheckoutSelectors);

const flushPromises = async (turns = 20): Promise<void> => {
  for (let turn = 0; turn < turns; turn += 1) {
    await Promise.resolve();
  }
};

const makeStorage = (): Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> => {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

describe('checkout handoff client', () => {
  it('uses the public BigCommerce handoff endpoint and store-hash boundary', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        headers: { get: jest.fn().mockReturnValue(null) },
        json: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 3 }),
        ok: true,
      })
      .mockResolvedValueOnce({
        headers: { get: jest.fn().mockReturnValue(null) },
        json: jest.fn().mockResolvedValue({
          active: true,
          consumed: false,
          dealer_id: 42,
          revision: 4,
        }),
        ok: true,
      })
      .mockResolvedValueOnce({
        headers: { get: jest.fn().mockReturnValue(null) },
        json: jest.fn().mockResolvedValue({
          active: true,
          consumed: false,
          dealer_id: 42,
          revision: 4,
        }),
        ok: true,
      }) as jest.Mock;
    const client = createCheckoutHandoffClient('https://api.example.test/');
    const context = { cartId: 'cart/id', storeHash: 'store-hash' };

    await expect(client.load(context)).resolves.toEqual({
      active: false,
      consumed: false,
      dealerId: undefined,
      revision: 3,
    });
    await expect(
      client.update(context, {
        active: true,
        dealerId: 42,
        expectedRevision: 3,
        operationId: 'operation-1',
      }),
    ).resolves.toEqual({ active: true, consumed: false, dealerId: '42', revision: 4 });
    await expect(
      client.confirm(context, { dealerId: 42, expectedRevision: 4, orderId: 700 }),
    ).resolves.toEqual({ active: true, consumed: false, dealerId: '42', revision: 4 });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/big_commerce/api/checkouts/cart%2Fid/handoff',
      {
        headers: {
          'Content-Type': 'application/json',
          'store-hash': 'store-hash',
        },
        method: 'GET',
      },
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/big_commerce/api/checkouts/cart%2Fid/handoff',
      expect.objectContaining({
        body: JSON.stringify({
          active: true,
          dealer_id: 42,
          expected_revision: 3,
          operation_id: 'operation-1',
        }),
        keepalive: true,
        method: 'PUT',
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'https://api.example.test/big_commerce/api/checkouts/cart%2Fid/handoff/confirmation',
      expect.objectContaining({
        body: JSON.stringify({ dealer_id: 42, expected_revision: 4, order_id: '700' }),
        keepalive: true,
        method: 'POST',
      }),
    );
  });

  it('preserves server state and retry timing on an unsuccessful response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      headers: { get: jest.fn().mockReturnValue('2') },
      json: jest.fn().mockResolvedValue({
        active: true,
        consumed: false,
        dealer_id: 41,
        error: 'stale_revision',
        revision: 7,
      }),
      ok: false,
      status: 429,
    }) as jest.Mock;
    const client = createCheckoutHandoffClient('https://api.example.test');

    await expect(
      client.update(
        { cartId: 'cart-1', storeHash: 'store-hash' },
        {
          active: true,
          dealerId: 42,
          expectedRevision: 6,
          operationId: 'operation-1',
        },
      ),
    ).rejects.toMatchObject({
      message: 'stale_revision',
      retryAfterMilliseconds: 2_000,
      state: { active: true, consumed: false, dealerId: '41', revision: 7 },
      status: 429,
    });
  });

  it('rejects an invalid successful response instead of inventing revision state', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      headers: { get: jest.fn().mockReturnValue(null) },
      json: jest.fn().mockRejectedValue(new SyntaxError('invalid JSON')),
      ok: true,
      status: 200,
    }) as jest.Mock;
    const client = createCheckoutHandoffClient('https://api.example.test');

    await expect(client.load({ cartId: 'cart-1', storeHash: 'store-hash' })).rejects.toThrow(
      'Automatic FFL received an invalid checkout handoff response',
    );
  });
});

describe('checkout handoff destination matching', () => {
  it('matches the same dealer after BigCommerce normalizes address and recipient fields', () => {
    expect(
      isSameCheckoutHandoffDestination(dealerAddress, {
        ...dealerAddress,
        address1: '  200 dealer-road. ',
        company: 'Appended merchant text',
        country: 'USA',
        countryCode: '',
        customFields: [{ fieldId: 'field-1', fieldValue: 'ignored' }],
        firstName: 'Different',
        lastName: 'Recipient',
        phone: '9999999999',
        postalCode: '80202-1234',
        stateOrProvince: 'Colorado',
        stateOrProvinceCode: '',
      }),
    ).toBe(true);
  });

  it('does not match a different dealer destination', () => {
    expect(isSameCheckoutHandoffDestination(dealerAddress, otherAddress)).toBe(false);
  });

  it('preserves Unicode letters exactly like the backend canonical matcher', () => {
    const accentedAddress = { ...dealerAddress, city: 'Can\u0303on City' };

    expect(
      isSameCheckoutHandoffDestination(accentedAddress, {
        ...accentedAddress,
        city: 'Ca\u00f1on City',
      }),
    ).toBe(true);
    expect(
      isSameCheckoutHandoffDestination(accentedAddress, {
        ...accentedAddress,
        city: 'Canon City',
      }),
    ).toBe(false);
  });
});

describe('checkout handoff publisher', () => {
  const context = { cartId: 'cart-1', storeHash: 'store-hash' };

  const makePublisher = (
    client: Partial<CheckoutHandoffClient>,
    options: {
      checkoutState?: CheckoutSelectors;
      getCheckoutState?: () => CheckoutSelectors;
      onError?: jest.Mock;
      refreshCheckout?: jest.Mock;
      storage?: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
    } = {},
  ) => {
    const checkoutState = options.checkoutState || makeCheckoutState(dealerAddress);

    const completeClient = {
      confirm: jest.fn().mockResolvedValue({
        active: true,
        consumed: false,
        dealerId: '42',
        revision: 3,
      }),
      ...client,
    } as CheckoutHandoffClient;

    return createCheckoutHandoffPublisher({
      client: completeClient,
      createOperationId: jest.fn().mockReturnValue('stable-operation-id'),
      getCheckoutState: options.getCheckoutState || (() => checkoutState),
      matchesDestination: isSameCheckoutHandoffDestination,
      onError: options.onError,
      refreshCheckout: options.refreshCheckout || jest.fn().mockResolvedValue(checkoutState),
      storage: options.storage,
      wait: jest.fn().mockResolvedValue(undefined),
    });
  };

  it('retries transient writes with one stable operation ID', async () => {
    const client = {
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 2 }),
      update: jest
        .fn()
        .mockRejectedValueOnce(new TypeError('network unavailable'))
        .mockResolvedValue({ active: true, consumed: false, dealerId: '42', revision: 3 }),
    };
    const publisher = makePublisher(client, { onError: jest.fn() });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();

    expect(client.update).toHaveBeenCalledTimes(2);
    expect(client.update.mock.calls.map(([, update]) => update)).toEqual([
      {
        active: true,
        dealerId: 42,
        expectedRevision: 2,
        operationId: 'stable-operation-id',
      },
      {
        active: true,
        dealerId: 42,
        expectedRevision: 2,
        operationId: 'stable-operation-id',
      },
    ]);
  });

  it('confirms the order only against the latest successfully published dealer revision', async () => {
    const client = {
      confirm: jest.fn().mockResolvedValue({
        active: true,
        consumed: false,
        dealerId: '42',
        revision: 3,
      }),
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 2 }),
      update: jest
        .fn()
        .mockResolvedValue({ active: true, consumed: false, dealerId: '42', revision: 3 }),
    };
    const publisher = makePublisher(client, { onError: jest.fn() });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await publisher.confirmOrder(700);

    expect(client.confirm).toHaveBeenCalledWith(context, {
      dealerId: '42',
      expectedRevision: 3,
      orderId: 700,
    });
  });

  it('restores verified confirmation state after a hosted-payment round trip', async () => {
    const storage = makeStorage();
    const client = {
      confirm: jest.fn().mockResolvedValue({
        active: true,
        consumed: false,
        dealerId: '42',
        revision: 3,
      }),
      load: jest
        .fn()
        .mockResolvedValueOnce({ active: false, consumed: false, revision: 2 })
        .mockResolvedValueOnce({ active: true, consumed: false, dealerId: '42', revision: 3 }),
      update: jest
        .fn()
        .mockResolvedValue({ active: true, consumed: false, dealerId: '42', revision: 3 }),
    };
    const beforeRedirect = makePublisher(client, { onError: jest.fn(), storage });

    beforeRedirect.configure(context);
    beforeRedirect.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();

    const stored = storage.getItem('automatic-ffl:bigcommerce:handoff:store-hash:cart-1') as string;

    expect(stored).toContain('"dealerId":"42"');
    expect(stored).not.toContain('Jane');
    expect(stored).not.toContain('5555550100');

    beforeRedirect.dispose();

    const afterRedirect = makePublisher(client, { onError: jest.fn(), storage });
    afterRedirect.configure(context);
    const confirmation = afterRedirect.confirmOrder(700);

    // The keepalive request must begin in the same call stack so checkout can
    // navigate immediately without sacrificing hosted-payment attribution.
    expect(client.confirm).toHaveBeenCalledWith(context, {
      dealerId: '42',
      expectedRevision: 3,
      orderId: 700,
    });
    await confirmation;
    expect(storage.getItem('automatic-ffl:bigcommerce:handoff:store-hash:cart-1')).toBeNull();
  });

  it('deletes a hosted-payment receipt when confirmation rejects a stale revision', async () => {
    const storage = makeStorage();
    const key = 'automatic-ffl:bigcommerce:handoff:store-hash:cart-1';

    storage.setItem(
      key,
      JSON.stringify({
        dealerId: '42',
        destination: dealerAddress,
        itemIds: ['gun-1'],
        revision: 2,
      }),
    );

    const client = {
      confirm: jest
        .fn()
        .mockRejectedValue(
          new CheckoutHandoffHttpError(409, undefined, undefined, 'stale_revision'),
        ),
      load: jest
        .fn()
        .mockResolvedValue({ active: true, consumed: false, dealerId: '42', revision: 3 }),
      update: jest.fn(),
    };
    const publisher = makePublisher(client, { onError: jest.fn(), storage });

    publisher.configure(context);
    await publisher.confirmOrder(700);

    expect(client.confirm).toHaveBeenCalledWith(context, {
      dealerId: '42',
      expectedRevision: 2,
      orderId: 700,
    });
    expect(storage.getItem(key)).toBeNull();
  });

  it('does not confirm an old dealer when the newest handoff publication fails', async () => {
    const client = {
      confirm: jest.fn(),
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 1 }),
      update: jest
        .fn()
        .mockResolvedValueOnce({ active: true, consumed: false, dealerId: '42', revision: 2 })
        .mockRejectedValueOnce(
          new CheckoutHandoffHttpError(422, undefined, undefined, 'dealer_not_selectable'),
        ),
    };
    const publisher = makePublisher(client, { onError: jest.fn() });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();
    publisher.publish({
      active: true,
      dealerId: 43,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();
    await publisher.confirmOrder(700);

    expect(client.confirm).not.toHaveBeenCalled();
  });

  it('does not confirm a dealer after every routed FFL item leaves the cart', async () => {
    let checkoutState = makeCheckoutState(dealerAddress);
    const client = {
      confirm: jest.fn(),
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 2 }),
      update: jest
        .fn()
        .mockResolvedValue({ active: true, consumed: false, dealerId: '42', revision: 3 }),
    };
    const publisher = makePublisher(client, {
      getCheckoutState: () => checkoutState,
      onError: jest.fn(),
    });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();

    checkoutState = {
      data: {
        getCart: () => ({
          id: 'cart-1',
          lineItems: { physicalItems: [] },
        }),
        getConsignments: () => [],
      },
    } as unknown as CheckoutSelectors;

    await publisher.confirmOrder(700);

    checkoutState = makeCheckoutState(dealerAddress);
    await publisher.confirmOrder(700);

    expect(client.confirm).not.toHaveBeenCalled();
  });

  it('does not create a tombstone when the server is already inactive', async () => {
    const client = {
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 0 }),
      update: jest.fn(),
    };
    const publisher = makePublisher(client, { checkoutState: makeCheckoutState() });

    publisher.configure(context);
    publisher.publish({ active: false });
    await flushPromises();

    expect(client.update).not.toHaveBeenCalled();
  });

  it('does not publish an active candidate unless the confirmed item owner still matches', async () => {
    const client = {
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 2 }),
      update: jest.fn(),
    };
    const publisher = makePublisher(client, {
      checkoutState: makeCheckoutState(otherAddress),
    });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();

    expect(client.update).not.toHaveBeenCalled();
  });

  it('refreshes checkout and retries a stale selection only while that dealer is still applied', async () => {
    const staleState = { active: true, consumed: false, dealerId: '41', revision: 4 };
    const client = {
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 1 }),
      update: jest
        .fn()
        .mockRejectedValueOnce(new CheckoutHandoffHttpError(409, staleState))
        .mockResolvedValue({ active: true, consumed: false, dealerId: '42', revision: 5 }),
    };
    const refreshCheckout = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('checkout refresh unavailable'))
      .mockResolvedValue(
        makeCheckoutState({
          ...dealerAddress,
          address1: '200 dealer-road.',
          company: 'Normalized company text',
          firstName: 'Different',
          lastName: 'Recipient',
          phone: '9999999999',
          postalCode: '80202-1234',
        } as Address),
      );
    const publisher = makePublisher(client, { refreshCheckout });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();

    expect(refreshCheckout).toHaveBeenCalledTimes(2);
    expect(refreshCheckout).toHaveBeenCalledWith('cart-1');
    expect(client.update).toHaveBeenNthCalledWith(
      2,
      context,
      expect.objectContaining({
        expectedRevision: 4,
        operationId: 'stable-operation-id',
      }),
    );
  });

  it('accepts that a newer tab won when refreshed consignments no longer match the dealer', async () => {
    const client = {
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 1 }),
      update: jest.fn().mockRejectedValue(
        new CheckoutHandoffHttpError(409, {
          active: true,
          consumed: false,
          dealerId: '41',
          revision: 4,
        }),
      ),
    };
    const refreshCheckout = jest.fn().mockResolvedValue(makeCheckoutState(otherAddress));
    const publisher = makePublisher(client, { refreshCheckout });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();

    expect(client.update).toHaveBeenCalledTimes(1);
  });

  it('retries a stale tombstone only for the dealer that was actually removed', async () => {
    const client = {
      load: jest
        .fn()
        .mockResolvedValue({ active: true, consumed: false, dealerId: '42', revision: 2 }),
      update: jest
        .fn()
        .mockRejectedValueOnce(
          new CheckoutHandoffHttpError(409, {
            active: true,
            consumed: false,
            dealerId: '42',
            revision: 3,
          }),
        )
        .mockResolvedValue({ active: false, consumed: false, revision: 4 }),
    };
    const publisher = makePublisher(client, {
      checkoutState: makeCheckoutState(),
      refreshCheckout: jest.fn().mockResolvedValue(makeCheckoutState()),
    });

    publisher.configure(context);
    publisher.publish({
      active: false,
      previousDealerId: 42,
      previousDestination: dealerAddress,
    });
    await flushPromises();

    expect(client.update).toHaveBeenCalledTimes(2);
    expect(client.update).toHaveBeenLastCalledWith(
      context,
      expect.objectContaining({ active: false, expectedRevision: 3 }),
    );
  });

  it('serializes an in-flight selection before its newer removal', async () => {
    let releaseSelection: (state: any) => void = () => undefined;
    let markSelectionStarted: () => void = () => undefined;
    const selectionStarted = new Promise<void>((resolve) => {
      markSelectionStarted = resolve;
    });
    const selectionPending = new Promise<any>((resolve) => {
      releaseSelection = resolve;
    });
    const client = {
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 0 }),
      update: jest
        .fn()
        .mockImplementationOnce(() => {
          markSelectionStarted();
          return selectionPending;
        })
        .mockResolvedValueOnce({ active: false, consumed: false, revision: 2 }),
    };
    const publisher = makePublisher(client);

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await selectionStarted;
    publisher.publish({
      active: false,
      previousDealerId: 42,
      previousDestination: dealerAddress,
    });
    releaseSelection({ active: true, consumed: false, dealerId: '42', revision: 1 });
    await flushPromises();

    expect(client.update).toHaveBeenCalledTimes(2);
    expect(client.update).toHaveBeenLastCalledWith(
      context,
      expect.objectContaining({ active: false, expectedRevision: 1 }),
    );
  });

  it('stops publishing after the backend reports that the handoff was consumed', async () => {
    const onError = jest.fn();
    const client = {
      load: jest.fn().mockResolvedValue({ active: true, consumed: false, revision: 2 }),
      update: jest
        .fn()
        .mockRejectedValue(
          new CheckoutHandoffHttpError(409, undefined, undefined, 'handoff_consumed'),
        ),
    };
    const publisher = makePublisher(client, { onError });

    publisher.configure(context);
    publisher.publish({ active: false });
    await flushPromises();
    publisher.publish({ active: false });
    await flushPromises();

    expect(client.update).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports an exhausted terminal write without turning it into a shopper error', async () => {
    const error = new CheckoutHandoffHttpError(422, undefined, undefined, 'dealer_not_selectable');
    const onError = jest.fn();
    const client = {
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 2 }),
      update: jest.fn().mockRejectedValue(error),
    };
    const publisher = makePublisher(client, { onError });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('reports an exhausted stale-checkout refresh instead of swallowing it', async () => {
    const refreshError = new TypeError('checkout refresh unavailable');
    const onError = jest.fn();
    const client = {
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 2 }),
      update: jest.fn().mockRejectedValue(
        new CheckoutHandoffHttpError(409, {
          active: true,
          consumed: false,
          dealerId: '41',
          revision: 3,
        }),
      ),
    };
    const refreshCheckout = jest.fn().mockRejectedValue(refreshError);
    const publisher = makePublisher(client, { onError, refreshCheckout });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises(50);

    expect(refreshCheckout).toHaveBeenCalledTimes(4);
    expect(client.update).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(refreshError);
  });

  it('reports repeated stale conflicts after the bounded retry limit', async () => {
    const staleError = new CheckoutHandoffHttpError(409, {
      active: true,
      consumed: false,
      dealerId: '41',
      revision: 3,
    });
    const onError = jest.fn();
    const client = {
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 2 }),
      update: jest.fn().mockRejectedValue(staleError),
    };
    const refreshCheckout = jest.fn().mockResolvedValue(makeCheckoutState(dealerAddress));
    const publisher = makePublisher(client, { onError, refreshCheckout });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises(50);

    expect(client.update).toHaveBeenCalledTimes(3);
    expect(refreshCheckout).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(staleError);
  });

  it('reports a shared initialization failure only once for the active publication', async () => {
    const loadError = new CheckoutHandoffHttpError(422, undefined, undefined, 'invalid_store');
    const onError = jest.fn();
    const client = {
      load: jest.fn().mockRejectedValue(loadError),
      update: jest.fn(),
    };
    const publisher = makePublisher(client, { onError });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();

    expect(client.load).toHaveBeenCalledTimes(1);
    expect(client.update).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(loadError);
  });

  it('does not let a late stale response poison a newer configuration', async () => {
    let releaseOldUpdate: (error: unknown) => void = () => undefined;
    let markOldUpdateStarted: () => void = () => undefined;
    const oldUpdateStarted = new Promise<void>((resolve) => {
      markOldUpdateStarted = resolve;
    });
    const oldUpdatePending = new Promise((_resolve, reject) => {
      releaseOldUpdate = reject;
    });
    const newerContext = { ...context, storeHash: 'new-store-hash' };
    const client = {
      load: jest
        .fn()
        .mockResolvedValueOnce({ active: false, consumed: false, revision: 1 })
        .mockResolvedValueOnce({ active: false, consumed: false, revision: 7 }),
      update: jest
        .fn()
        .mockImplementationOnce(() => {
          markOldUpdateStarted();
          return oldUpdatePending;
        })
        .mockResolvedValueOnce({ active: true, consumed: false, dealerId: '42', revision: 8 }),
    };
    const publisher = makePublisher(client);

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 41,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await oldUpdateStarted;

    publisher.configure(newerContext);
    await flushPromises();
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    releaseOldUpdate(
      new CheckoutHandoffHttpError(409, {
        active: true,
        consumed: false,
        dealerId: '41',
        revision: 99,
      }),
    );
    await flushPromises();

    expect(client.update).toHaveBeenCalledTimes(2);
    expect(client.update).toHaveBeenLastCalledWith(
      newerContext,
      expect.objectContaining({ dealerId: 42, expectedRevision: 7 }),
    );
  });
});
