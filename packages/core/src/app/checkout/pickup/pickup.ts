import { Cart, CheckoutSelectors, Consignment } from '@bigcommerce/checkout-sdk';

export interface PickupLocation {
  entityId: number;
  label: string;
  address: {
    address1: string;
    address2?: string;
    city: string;
    stateOrProvince: string;
    postalCode: string;
    countryCode: string;
    latitude: number | null;
    longitude: number | null;
  };
}

export interface PickupChoice {
  id: number;
  location: PickupLocation;
  displayName: string;
  collectionInstructions?: string;
  collectionTimeDescription?: string;
}

export const pickupCartSignature = (cart?: Cart): string =>
  JSON.stringify([
    cart?.id,
    cart?.lineItems.physicalItems
      .map(({ id, variantId, quantity }) => [String(id), variantId, quantity])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ]);

export const hasNativePickup = (consignments: Consignment[] = []): boolean =>
  consignments.some(({ selectedPickupOption }) => Boolean(selectedPickupOption));

export const matchesPickup = (
  state: CheckoutSelectors,
  signature: string,
  methodId?: number,
): boolean => {
  const cart = state.data.getCart();
  const consignments = state.data.getConsignments() || [];
  const ids = cart?.lineItems.physicalItems.map(({ id }) => String(id)) || [];
  const assigned = consignments[0]?.lineItemIds.map(String) || [];

  return Boolean(
    methodId &&
      ids.length &&
      pickupCartSignature(cart) === signature &&
      consignments.length === 1 &&
      consignments[0].selectedPickupOption?.pickupMethodId === methodId &&
      !consignments[0].selectedShippingOption &&
      assigned.length === ids.length &&
      new Set(assigned).size === ids.length &&
      ids.every((id) => assigned.includes(id)),
  );
};

export const pickupAddress = ({ address }: PickupLocation): string =>
  [
    address.address1,
    address.address2,
    address.city,
    address.stateOrProvince,
    address.postalCode,
    address.countryCode,
  ]
    .filter(Boolean)
    .join(', ');
