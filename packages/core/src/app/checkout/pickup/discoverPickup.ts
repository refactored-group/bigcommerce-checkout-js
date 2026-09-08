import { Cart } from '@bigcommerce/checkout-sdk';

import { PickupChoice, PickupLocation } from './pickup';

// Fetch one extra location so the MVP limit is explicit, never a partial list.
const locationsQuery = `query PickupLocations {
    inventory {
        locations(first: 11) {
            pageInfo { hasNextPage }
            edges { node {
                entityId label
                address { address1 address2 city stateOrProvince postalCode countryCode latitude longitude }
            } }
        }
    }
}`;

export default async function discoverPickup(
  cart: Cart,
  log: (error: Error) => void,
  signal?: AbortSignal,
): Promise<PickupChoice[]> {
  const items = new Map<number, number>();

  for (const { variantId, quantity } of cart.lineItems.physicalItems) {
    if (!variantId || quantity <= 0) {
      return [];
    }

    items.set(variantId, (items.get(variantId) || 0) + quantity);
  }

  if (!items.size) {
    return [];
  }

  const token =
    (window as Window & { fflStorefrontToken?: string }).fflStorefrontToken ||
    localStorage.getItem('storefrontApiToken');

  if (!token) {
    throw new Error('Pickup discovery requires a storefront token');
  }

  const locationsResponse = await fetch('/graphql', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: locationsQuery }),
    signal,
  });
  const response = await locationsResponse.json();
  const connection = response.data?.inventory?.locations;

  if (!locationsResponse.ok || response.errors?.length || !Array.isArray(connection?.edges)) {
    throw new Error('Unable to load pickup locations');
  }

  if (connection.pageInfo?.hasNextPage || connection.edges.length > 10) {
    throw new Error('Pickup MVP supports at most 10 visible inventory locations');
  }

  const locations: PickupLocation[] = connection.edges.map(
    ({ node }: { node: PickupLocation }) => node,
  );
  const eligibleLocations = locations.filter(({ entityId, address }) => {
    const valid =
      address &&
      typeof address.latitude === 'number' &&
      typeof address.longitude === 'number' &&
      Number.isFinite(address.latitude) &&
      Number.isFinite(address.longitude);

    if (!valid) {
      log(new Error(`Pickup location ${entityId} is missing coordinates`));
    }

    return valid;
  });
  const responses = await Promise.all(
    eligibleLocations.map(async ({ address }) => {
      const result = await fetch('/api/storefront/pickup-options', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchArea: {
            radius: { value: 2, unit: 'MI' },
            coordinates: { latitude: address.latitude, longitude: address.longitude },
          },
          items: Array.from(items, ([variantId, quantity]) => ({ variantId, quantity })),
        }),
        signal,
      });
      const body = await result.json();

      if (!result.ok || !Array.isArray(body.results)) {
        throw new Error('Unable to check pickup eligibility');
      }

      return body.results;
    }),
  );
  const choices = new Map<number, PickupChoice>();

  for (const result of responses.flat()) {
    if (!Array.isArray(result.pickupOptions)) {
      throw new Error('Invalid pickup eligibility response');
    }

    for (const { pickupMethod, availableItems } of result.pickupOptions) {
      const location = eligibleLocations.find(
        ({ entityId }) => entityId === pickupMethod?.locationId,
      );
      const coversCart =
        Array.isArray(availableItems) &&
        Array.from(items).every(([variantId, quantity]) =>
          availableItems.some(
            (item: { variantId: number; quantity: number }) =>
              item.variantId === variantId && item.quantity >= quantity,
          ),
        );

      if (location && pickupMethod?.id && coversCart) {
        choices.set(pickupMethod.id, { ...pickupMethod, location });
      }
    }
  }

  return Array.from(choices.values()).sort(
    (a, b) => a.location.entityId - b.location.entityId || a.id - b.id,
  );
}
