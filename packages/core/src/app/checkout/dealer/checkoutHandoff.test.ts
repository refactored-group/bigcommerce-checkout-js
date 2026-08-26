import { Address, CheckoutSelectors, Consignment } from '@bigcommerce/checkout-sdk';

import {
  CheckoutHandoffClient,
  CheckoutHandoffHttpError,
  createCheckoutHandoffClient,
  createCheckoutHandoffPublisher,
} from './checkoutHandoff';
import { isSameConsignmentDestination } from './fflConsignmentCoordinator';

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
        method: 'PUT',
      }),
    );
  });
});

describe('checkout handoff publisher', () => {
  const context = { cartId: 'cart-1', storeHash: 'store-hash' };

  const makePublisher = (
    client: CheckoutHandoffClient,
    options: {
      checkoutState?: CheckoutSelectors;
      onError?: jest.Mock;
      refreshCheckout?: jest.Mock;
    } = {},
  ) => {
    const checkoutState = options.checkoutState || makeCheckoutState(dealerAddress);

    return createCheckoutHandoffPublisher({
      client,
      createOperationId: jest.fn().mockReturnValue('stable-operation-id'),
      getCheckoutState: () => checkoutState,
      matchesDestination: isSameConsignmentDestination,
      onError: options.onError,
      refreshCheckout: options.refreshCheckout || jest.fn().mockResolvedValue(checkoutState),
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
    const publisher = makePublisher(client);

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

  it('refreshes checkout and retries a stale selection only while that dealer is still applied', async () => {
    const staleState = { active: true, consumed: false, dealerId: '41', revision: 4 };
    const client = {
      load: jest.fn().mockResolvedValue({ active: false, consumed: false, revision: 1 }),
      update: jest
        .fn()
        .mockRejectedValueOnce(new CheckoutHandoffHttpError(409, staleState))
        .mockResolvedValue({ active: true, consumed: false, dealerId: '42', revision: 5 }),
    };
    const refreshCheckout = jest.fn().mockResolvedValue(makeCheckoutState(dealerAddress));
    const publisher = makePublisher(client, { refreshCheckout });

    publisher.configure(context);
    publisher.publish({
      active: true,
      dealerId: 42,
      destination: dealerAddress,
      itemIds: ['gun-1'],
    });
    await flushPromises();

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
});
