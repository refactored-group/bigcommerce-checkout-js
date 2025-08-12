// @ts-nocheck
import { Cart, LineItem } from '@bigcommerce/checkout-sdk';

export default async function getFflLineItems(storeHash: string, cart: Cart): Promise<LineItem[]> {
  const data = await loadProductsWithCustomFields(storeHash, cart);
  return data;
}

function loadProductsWithCustomFields(storeHash: string, cart: Cart): Promise<any> {
  const queryString = cart.lineItems.physicalItems.map(item => `product_ids[]=${item.productId}`).join('&');

  return fetch(`https://${process.env.HOST}/store-front/api/stores/${storeHash}/products/restrictions?${queryString}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((res) => {
    return res.json();
  });
}
