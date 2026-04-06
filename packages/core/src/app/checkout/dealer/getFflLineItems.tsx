import { Cart, LineItem } from '@bigcommerce/checkout-sdk';
import { FFLProduct } from './types';

type FFLProductOrFirearm = FFLProduct | { id: number };

export default async function getFflLineItems(
  storeHash: string,
  cart: Cart,
): Promise<[FFLProductOrFirearm[], LineItem[], LineItem[]]> {
  const firearmProductIds: number[] = [];
  const ammoProductIds: number[] = [];

  const data: FFLProductOrFirearm[] = await loadProductsWithCustomFields(storeHash, cart);

  data.forEach((item) => {
    if ('conditions' in item) {
      ammoProductIds.push(item.id);
    } else {
      firearmProductIds.push(item.id);
    }
  });

  return [
    data,
    cart.lineItems.physicalItems.filter((item) => firearmProductIds.includes(item.productId)),
    cart.lineItems.physicalItems.filter((item) => ammoProductIds.includes(item.productId)),
  ];
}

function loadProductsWithCustomFields(storeHash: string, cart: Cart): Promise<FFLProductOrFirearm[]> {
  const queryString = cart.lineItems.physicalItems
    .map((item) => `product_ids[]=${item.productId}`)
    .join('&');

  return fetch(
    `https://${process.env.HOST}/store-front/api/stores/${storeHash}/products/restrictions?${queryString}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  ).then((res) => res.json());
}
