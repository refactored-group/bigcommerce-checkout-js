import { Cart } from '@bigcommerce/checkout-sdk';

import discoverPickup from './discoverPickup';

const cart = {
  id: 'cart',
  lineItems: {
    physicalItems: [
      { variantId: 10, quantity: 2 },
      { variantId: 10, quantity: 1 },
      { variantId: 20, quantity: 1 },
    ],
  },
} as Cart;
const center = { latitude: 30, longitude: -97 };
const location = (id: number, latitude = 30 + id / 100) => ({
  entityId: id,
  label: `Store ${id}`,
  address: { latitude, longitude: -97 },
});
const option = (locationId: number, id = locationId, complete = true) => ({
  pickupMethod: { id, locationId, displayName: `Method ${id}` },
  availableItems: [
    { variantId: 10, quantity: complete ? 3 : 2 },
    { variantId: 20, quantity: 1 },
  ],
});
const response = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: async () => body } as Response);
const metadata = (nodes: unknown[], next: string | null = null) =>
  response({
    data: {
      inventory: {
        locations: {
          edges: nodes.map((node) => ({ node })),
          pageInfo: { hasNextPage: !!next, endCursor: next },
        },
      },
    },
  });
const native = (options: unknown[]) => response({ results: [{ pickupOptions: options }] });
const originalFetch = global.fetch;
let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
  localStorage.setItem('storefrontApiToken', 'token');
});
afterEach(() => {
  global.fetch = originalFetch;
  localStorage.clear();
});

it('uses one 200-mile whole-cart search and returns five nearest distinct stores from eleven', async () => {
  const ids = Array.from({ length: 11 }, (_, i) => 11 - i);
  fetchMock
    .mockImplementationOnce(() => native(ids.map((id) => option(id))))
    .mockImplementationOnce(() => metadata(ids.map((id) => location(id))));
  const choices = await discoverPickup(cart, center, jest.fn());
  expect(choices.map(({ location }) => location.entityId)).toEqual([1, 2, 3, 4, 5]);
  expect(choices[0].distanceMiles).toBeCloseTo(0.691, 2);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    searchArea: { radius: { value: 200, unit: 'MI' }, coordinates: center },
    items: [
      { variantId: 10, quantity: 3 },
      { variantId: 20, quantity: 1 },
    ],
  });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).variables.ids).toEqual(ids);
});

it('retains multiple methods at the same store, deduplicates methods, and excludes partial carts', async () => {
  fetchMock
    .mockImplementationOnce(() =>
      native([
        option(1),
        option(1),
        option(1, 21),
        option(2, 22, false),
        ...[2, 3, 4, 5, 6].map((id) => option(id)),
      ]),
    )
    .mockImplementationOnce(() => metadata([1, 2, 3, 4, 5, 6].map((id) => location(id))));
  const choices = await discoverPickup(cart, center, jest.fn());
  expect(choices.map(({ id }) => id)).toEqual([1, 21, 2, 3, 4, 5]);
});

it('reads subsequent metadata pages rather than failing on more than ten stores', async () => {
  fetchMock
    .mockImplementationOnce(() => native([option(1), option(2)]))
    .mockImplementationOnce(() => metadata([location(1)], 'page-2'))
    .mockImplementationOnce(() => metadata([location(2)]));
  const signal = new AbortController().signal;
  expect(await discoverPickup(cart, center, jest.fn(), signal)).toHaveLength(2);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).variables.after).toBe('page-2');
  for (const [, request] of fetchMock.mock.calls) {
    expect(request.signal).toBe(signal);
  }
});

it('batches metadata for more than fifty eligible stores', async () => {
  const ids = Array.from({ length: 51 }, (_, i) => i + 1);
  fetchMock
    .mockImplementationOnce(() => native(ids.map((id) => option(id))))
    .mockImplementationOnce(() => metadata(ids.slice(0, 50).map((id) => location(id))))
    .mockImplementationOnce(() => metadata([location(51)]));
  expect(await discoverPickup(cart, center, jest.fn())).toHaveLength(5);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).variables).toEqual({ ids: [51], after: null });
});

it('does not widen an empty search or fetch location metadata for no eligible methods', async () => {
  fetchMock.mockImplementationOnce(() => native([]));
  expect(await discoverPickup(cart, center, jest.fn())).toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('excludes stores outside 200 miles and locations with unusable coordinates', async () => {
  fetchMock
    .mockImplementationOnce(() => native([option(1), option(2), option(3)]))
    .mockImplementationOnce(() =>
      metadata([location(1, 40), location(2, null as any), location(3)]),
    );
  const log = jest.fn();
  expect((await discoverPickup(cart, center, log)).map(({ id }) => id)).toEqual([3]);
  expect(log).toHaveBeenCalledTimes(1);
});

it.each([() => response({}, false), () => response({ results: [{}] })])(
  'rejects failed or malformed eligibility responses',
  async (failure) => {
    fetchMock.mockImplementationOnce(failure);
    await expect(discoverPickup(cart, center, jest.fn())).rejects.toThrow();
  },
);

it.each([
  () => response({ errors: [{ message: 'denied' }] }),
  () => metadata([]),
  () =>
    response({
      data: { inventory: { locations: { edges: [], pageInfo: { hasNextPage: true } } } },
    }),
])(
  'does not show misleading partial results when metadata fails or is incomplete',
  async (failure) => {
    fetchMock.mockImplementationOnce(() => native([option(1)])).mockImplementationOnce(failure);
    await expect(discoverPickup(cart, center, jest.fn())).rejects.toThrow();
  },
);

it('does not discover digital-only carts', async () => {
  expect(
    await discoverPickup(
      { ...cart, lineItems: { physicalItems: [] } } as unknown as Cart,
      center,
      jest.fn(),
    ),
  ).toEqual([]);
  expect(fetchMock).not.toHaveBeenCalled();
});
