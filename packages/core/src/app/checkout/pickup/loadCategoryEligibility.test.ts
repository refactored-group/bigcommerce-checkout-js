import { Cart } from '@bigcommerce/checkout-sdk';

import loadCategoryEligibility from './loadCategoryEligibility';

const cart = {
  lineItems: {
    physicalItems: [
      { productId: 42 },
      { productId: 42 },
      { productId: 43 },
    ],
  },
} as Cart;

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

it('sends distinct physical product IDs and applies a restricted response', async () => {
  const fetchMock = jest.fn(async (_url: string, _options: RequestInit) => ({
    ok: true,
    json: async () => ({
      policy_revision: 3,
      restricted: true,
      allowed_location_ids: [7, 9],
    }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;

  expect(await loadCategoryEligibility('store-hash', cart)).toEqual([7, 9]);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ product_ids: [42, 43] });
  expect(fetchMock.mock.calls[0][1].cache).toBe('no-store');
});

it('fails closed for malformed or failed eligibility responses', async () => {
  global.fetch = jest.fn(async () => ({
    ok: false,
    json: async () => ({ restricted: false }),
  })) as unknown as typeof fetch;

  await expect(loadCategoryEligibility('store-hash', cart)).rejects.toThrow();
});
