// @ts-nocheck
import { Cart, LineItem } from '@bigcommerce/checkout-sdk';

export default async function getFflLineItems(storeHash: string, cart: Cart): Promise<LineItem[]> {
  let firearmProductIds = [];
  let ammoProductIds = [];

  const data = await loadProductsWithCustomFields(storeHash, cart);

  data.forEach(item => {
    // currently, only ammo items has a conditions key
    if ('conditions' in item) {
      ammoProductIds.push(item.id);
    } else {
      firearmProductIds.push(item.id);
    }
  });

  return [
    cart.lineItems.physicalItems.filter((item) => firearmProductIds.includes(item.productId)),
    cart.lineItems.physicalItems.filter((item) => ammoProductIds.includes(item.productId))
  ]
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
