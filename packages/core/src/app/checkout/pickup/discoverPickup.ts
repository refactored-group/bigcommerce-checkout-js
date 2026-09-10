import { Cart } from '@bigcommerce/checkout-sdk';

import { PickupChoice, PickupCoordinates, PickupLocation } from './pickup';

const locationsQuery = `query PickupLocations($ids: [Int!]!, $after: String) {
    inventory {
        locations(first: 50, after: $after, entityIds: $ids) {
            pageInfo { hasNextPage endCursor }
            edges { node {
                entityId label
                address { address1 address2 city stateOrProvince postalCode countryCode latitude longitude }
            } }
        }
    }
}`;

const distanceMiles = (center: PickupCoordinates, latitude: number, longitude: number): number => {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(radians(latitude - center.latitude) / 2) ** 2 +
    Math.cos(radians(center.latitude)) *
      Math.cos(radians(latitude)) *
      Math.sin(radians(longitude - center.longitude) / 2) ** 2;

  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
};

export default async function discoverPickup(
  cart: Cart,
  coordinates: PickupCoordinates,
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

  const result = await fetch('/api/storefront/pickup-options', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      searchArea: { radius: { value: 200, unit: 'MI' }, coordinates },
      items: Array.from(items, ([variantId, quantity]) => ({ variantId, quantity })),
    }),
    signal,
  });
  const body = await result.json();

  if (!result.ok || !Array.isArray(body.results)) {
    throw new Error('Unable to check pickup eligibility');
  }

  const methods = new Map<number, Omit<PickupChoice, 'location'> & { locationId: number }>();

  for (const result of body.results) {
    if (!Array.isArray(result.pickupOptions)) {
      throw new Error('Invalid pickup eligibility response');
    }

    for (const { pickupMethod, availableItems } of result.pickupOptions) {
      const coversCart =
        Array.isArray(availableItems) &&
        Array.from(items).every(([variantId, quantity]) =>
          availableItems.some(
            (item: { variantId: number; quantity: number }) =>
              item.variantId === variantId && item.quantity >= quantity,
          ),
        );

      if (
        Number.isInteger(pickupMethod?.id) &&
        pickupMethod.id > 0 &&
        Number.isInteger(pickupMethod.locationId) &&
        pickupMethod.locationId > 0 &&
        coversCart
      ) {
        methods.set(pickupMethod.id, pickupMethod);
      }
    }
  }

  if (!methods.size) {
    return [];
  }

  const token =
    (window as Window & { fflStorefrontToken?: string }).fflStorefrontToken ||
    localStorage.getItem('storefrontApiToken');

  if (!token) {
    throw new Error('Pickup discovery requires a storefront token');
  }

  // Only fetch metadata for eligible stores. Page and batch without imposing a
  // store-count limit, including when native discovery returns more than ten.
  const ids = Array.from(new Set(Array.from(methods.values(), ({ locationId }) => locationId)));
  const locations = new Map<number, PickupLocation>();

  for (let offset = 0; offset < ids.length; offset += 50) {
    let after: string | null = null;
    const cursors = new Set<string>();

    do {
      const response: Response = await fetch('/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query: locationsQuery,
          variables: { ids: ids.slice(offset, offset + 50), after },
        }),
        signal,
      });
      const body = await response.json();
      const connection = body.data?.inventory?.locations;

      if (
        !response.ok ||
        body.errors?.length ||
        !Array.isArray(connection?.edges) ||
        typeof connection.pageInfo?.hasNextPage !== 'boolean'
      ) {
        throw new Error('Unable to load pickup locations');
      }

      for (const { node } of connection.edges as Array<{ node: PickupLocation }>) {
        locations.set(node.entityId, node);
      }

      after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;

      if (connection.pageInfo.hasNextPage && (!after || cursors.has(after))) {
        throw new Error('Unable to load the next pickup locations page');
      }

      if (after) {
        cursors.add(after);
      }
    } while (after);
  }

  const choices: PickupChoice[] = [];

  for (const method of Array.from(methods.values())) {
    const location = locations.get(method.locationId);

    if (!location) {
      throw new Error('Missing eligible pickup location');
    }

    const { latitude, longitude } = location.address || {};

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      log(new Error(`Pickup location ${location.entityId} is missing valid coordinates`));
      continue;
    }

    const distance = distanceMiles(coordinates, latitude, longitude);

    if (distance <= 200) {
      choices.push({ ...method, location, distanceMiles: distance });
    }
  }

  choices.sort(
    (a, b) =>
      a.distanceMiles! - b.distanceMiles! ||
      a.location.entityId - b.location.entityId ||
      a.id - b.id,
  );
  const nearest = new Set<number>();

  return choices.filter(({ location }) => {
    if (nearest.size < 5) {
      nearest.add(location.entityId);
    }

    return nearest.has(location.entityId);
  });
}
