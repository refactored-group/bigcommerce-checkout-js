import { Cart } from '@bigcommerce/checkout-sdk';

export default async function loadCategoryEligibility(
  storeHash: string,
  cart: Cart,
  signal?: AbortSignal,
): Promise<number[] | null> {
  const productIds = Array.from(
    new Set(cart.lineItems.physicalItems.map(({ productId }) => productId)),
  );

  if (!productIds.length) {
    return null;
  }

  if (productIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error('Unable to check pickup category eligibility');
  }

  const response = await fetch(
    `https://${process.env.HOST}/store-front/api/stores/${encodeURIComponent(
      storeHash,
    )}/pickup/category-eligibility`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ product_ids: productIds }),
      signal,
    },
  );
  const body = await response.json();

  if (
    !response.ok ||
    !Number.isInteger(body.policy_revision) ||
    typeof body.restricted !== 'boolean' ||
    !Array.isArray(body.allowed_location_ids) ||
    body.allowed_location_ids.some((id: unknown) => !Number.isInteger(id) || (id as number) <= 0)
  ) {
    throw new Error('Unable to check pickup category eligibility');
  }

  return body.restricted ? body.allowed_location_ids : null;
}
