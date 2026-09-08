import { Cart } from '@bigcommerce/checkout-sdk';

import discoverPickup from './discoverPickup';

const cart = {
  id: 'cart',
  lineItems: {
    physicalItems: [
      { id: 'a', variantId: 10, quantity: 2 },
      { id: 'b', variantId: 10, quantity: 1 },
      { id: 'c', variantId: 20, quantity: 1 },
    ],
  },
} as Cart;
const location = (id: number) => ({
  entityId: id,
  label: `Store ${id}`,
  address: { latitude: 0, longitude: 0, address1: '1 Main', city: 'Austin' },
});
const option = (id: number, locationId: number, quantity = 3) => ({
  pickupMethod: {
    id,
    locationId,
    displayName: 'Pickup',
    collectionInstructions: 'Bring order number',
  },
  availableItems: [
    { variantId: 10, quantity },
    { variantId: 20, quantity: 1 },
  ],
});
const response = (body: unknown) => ({ ok: true, json: async () => body });
const locationsResponse = (nodes: unknown[], hasNextPage = false) =>
  response({
    data: {
      inventory: {
        locations: { edges: nodes.map((node) => ({ node })), pageInfo: { hasNextPage } },
      },
    },
  });

beforeEach(() => {
  localStorage.setItem('storefrontApiToken', 'test-token');
});
afterEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

it('aggregates variants, deduplicates overlapping searches, and excludes partial carts', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(locationsResponse([location(2), location(1)]))
    .mockResolvedValueOnce(
      response({ results: [{ pickupOptions: [option(7, 2), option(8, 1), option(9, 1, 2)] }] }),
    )
    .mockResolvedValueOnce(
      response({ results: [{ pickupOptions: [option(8, 1), option(7, 2), option(10, 999)] }] }),
    );
  const choices = await discoverPickup(cart, jest.fn());
  expect(choices.map(({ id }) => id)).toEqual([8, 7]);
  expect(choices[0].collectionInstructions).toBe('Bring order number');
  const payload = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
  expect(payload.items).toEqual([
    { variantId: 10, quantity: 3 },
    { variantId: 20, quantity: 1 },
  ]);
  expect(payload.searchArea.coordinates).toEqual({ latitude: 0, longitude: 0 });
  expect(payload).not.toHaveProperty('shippingAddress');
});

it('returns no choices for a store with no locations or no configured eligible pickup methods', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(locationsResponse([]));
  await expect(discoverPickup(cart, jest.fn())).resolves.toEqual([]);
  expect(global.fetch).toHaveBeenCalledTimes(1);

  (global.fetch as jest.Mock).mockReset();
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce(locationsResponse([location(1)]))
    .mockResolvedValueOnce(response({ results: [{ pickupOptions: [] }] }));
  await expect(discoverPickup(cart, jest.fn())).resolves.toEqual([]);
});

it('rejects partial discovery and location counts beyond the MVP limit', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(locationsResponse([location(1)], true));
  await expect(discoverPickup(cart, jest.fn())).rejects.toThrow('at most 10');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  (global.fetch as jest.Mock).mockReset();
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce(locationsResponse([location(1), location(2)]))
    .mockResolvedValueOnce(response({ results: [{ pickupOptions: [option(7, 1)] }] }))
    .mockRejectedValueOnce(new Error('offline'));
  await expect(discoverPickup(cart, jest.fn())).rejects.toThrow('offline');
});

it('skips missing coordinates with a diagnostic and fails on GraphQL errors', async () => {
  const log = jest.fn();
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(
      locationsResponse([{ ...location(1), address: { latitude: null, longitude: null } }]),
    );
  await expect(discoverPickup(cart, log)).resolves.toEqual([]);
  expect(log).toHaveBeenCalledWith(expect.any(Error));
  (global.fetch as jest.Mock).mockResolvedValueOnce(
    response({ errors: [{ message: 'unauthorized' }] }),
  );
  await expect(discoverPickup(cart, log)).rejects.toThrow('load pickup locations');
});
