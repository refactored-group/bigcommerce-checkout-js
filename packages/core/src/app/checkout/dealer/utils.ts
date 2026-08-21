import { Address } from '@bigcommerce/checkout-sdk';

import { DealerData, DealerSelectionData } from './types';
import formatPhoneNumber from './PhoneNumberFormatter';

interface FormatDealerOptions {
  shouldSaveAddress?: boolean;
}

interface ResolveFflRecipientNameOptions {
  customerFirstName?: string;
  customerLastName?: string;
  resolvedFirstName?: string;
  resolvedLastName?: string;
  useGenericRecipientName?: boolean;
}

export interface FflRecipientName {
  firstName: string;
  lastName: string;
}

export const isAmmunitionOnlyCart = (
  cartItemIds: string[],
  ammunitionItemIds: string[],
): boolean => {
  if (cartItemIds.length === 0 || ammunitionItemIds.length === 0) {
    return false;
  }

  const ammunitionIds = new Set(ammunitionItemIds);

  return cartItemIds.every((itemId) => ammunitionIds.has(itemId));
};

export const resolveFflRecipientName = ({
  customerFirstName = '',
  customerLastName = '',
  resolvedFirstName = '',
  resolvedLastName = '',
  useGenericRecipientName = false,
}: ResolveFflRecipientNameOptions): FflRecipientName =>
  useGenericRecipientName
    ? { firstName: resolvedFirstName.trim(), lastName: resolvedLastName.trim() }
    : { firstName: customerFirstName.trim(), lastName: customerLastName.trim() };

interface ShouldShowCustomerRecipientNameFieldsOptions {
  ammoStateFflRequired: boolean | null;
  hasFflItems: boolean;
  hasOnlyAmmunition: boolean;
  isGuest: boolean;
  useGenericRecipientName: boolean;
}

interface FflStateCondition {
  states?: string[];
  type?: string;
}

export interface FflProductRestriction {
  conditions?: FflStateCondition[];
}

export type AmmoRoutingDecision = 'ffl' | 'pending' | 'standard';

interface ResolveAmmoRoutingOptions {
  applyAmmoStateRulesInMixedCarts: boolean;
  fflProducts: FflProductRestriction[];
  hasAmmunition: boolean;
  hasFirearms: boolean;
  multiShipment: boolean;
  stateCode: string;
  withAmmoSubscription: boolean;
}

export interface ConfirmedAmmoRoutingSession {
  cartId: string;
  confirmedCustomerAddress?: Address;
  customerIdentityKey: string;
  stateCode: string;
}

interface ShouldDisableFflShippingSubmitOptions {
  hasAmmoRoutingError: boolean;
  hasSelectedShippingOptions: boolean;
  hasUnassignedLineItems: boolean;
  isAmmoStateSelectionPending: boolean;
  isLoading: boolean;
  isUpdatingShippingData: boolean;
  requiresAmmoRoutingReconciliation: boolean;
}

interface ShouldShowAmmoAddressSelectorOptions {
  ammoStateFflRequired: boolean | null;
  hasAmmunitionOnlyCart: boolean;
  hasAmmoWithoutFirearms: boolean;
  isBypassEnabled: boolean;
  isGuest: boolean;
}

export const shouldShowCustomerRecipientNameFields = ({
  ammoStateFflRequired,
  hasFflItems,
  hasOnlyAmmunition,
  isGuest,
  useGenericRecipientName,
}: ShouldShowCustomerRecipientNameFieldsOptions): boolean => {
  if (!isGuest && hasOnlyAmmunition && ammoStateFflRequired !== true) {
    return false;
  }

  if (hasOnlyAmmunition && ammoStateFflRequired === null) {
    return false;
  }

  return !useGenericRecipientName || !hasFflItems;
};

export const shouldShowAmmoAddressSelector = ({
  ammoStateFflRequired,
  hasAmmunitionOnlyCart,
  hasAmmoWithoutFirearms,
  isBypassEnabled,
  isGuest,
}: ShouldShowAmmoAddressSelectorOptions): boolean =>
  !isGuest &&
  hasAmmoWithoutFirearms &&
  !isBypassEnabled &&
  !(hasAmmunitionOnlyCart && ammoStateFflRequired === true);

export const canCommitDealerConsignment = (
  hasSelectedDealer: boolean,
  fflItemCount: number,
): boolean => hasSelectedDealer && fflItemCount > 0;

export const isAmmoFflRequiredState = (
  stateCode: string,
  fflProducts: FflProductRestriction[],
): boolean =>
  stateCode !== '' &&
  fflProducts.some((product) =>
    product.conditions?.some(
      (condition) => condition.type === 'ship_state' && condition.states?.includes(stateCode),
    ),
  );

export const resolveAmmoRouting = ({
  applyAmmoStateRulesInMixedCarts,
  fflProducts,
  hasAmmunition,
  hasFirearms,
  multiShipment,
  stateCode,
  withAmmoSubscription,
}: ResolveAmmoRoutingOptions): AmmoRoutingDecision => {
  if (!hasAmmunition || !withAmmoSubscription) {
    return 'standard';
  }

  if (hasFirearms && (multiShipment || !applyAmmoStateRulesInMixedCarts)) {
    return 'ffl';
  }

  const normalizedStateCode = stateCode.trim().toUpperCase();

  if (!normalizedStateCode) {
    return 'pending';
  }

  return isAmmoFflRequiredState(normalizedStateCode, fflProducts) ? 'ffl' : 'standard';
};

export const resolveConfirmedAmmoRoutingSession = (
  cartId: string,
  customerIdentityKey: string,
  sessionState?: ConfirmedAmmoRoutingSession,
): ConfirmedAmmoRoutingSession | undefined =>
  sessionState?.cartId === cartId && sessionState.customerIdentityKey === customerIdentityKey
    ? sessionState
    : undefined;

export const shouldDisableFflShippingSubmit = ({
  hasAmmoRoutingError,
  hasSelectedShippingOptions,
  hasUnassignedLineItems,
  isAmmoStateSelectionPending,
  isLoading,
  isUpdatingShippingData,
  requiresAmmoRoutingReconciliation,
}: ShouldDisableFflShippingSubmitOptions): boolean =>
  isLoading ||
  isUpdatingShippingData ||
  hasAmmoRoutingError ||
  requiresAmmoRoutingReconciliation ||
  isAmmoStateSelectionPending ||
  hasUnassignedLineItems ||
  !hasSelectedShippingOptions;

/**
 * Formats dealer data consistently for selection across different components.
 *
 * AutoFFL may include a resolved recipient name on the dealer payload. This
 * formatter transports those values without deciding what the recipient should be.
 *
 * @param dealer The dealer data object
 * @param options Optional configuration for dealer selection
 * @returns Formatted dealer selection data for checkout
 */
export const formatDealerForSelection = (
  dealer: DealerData,
  options: FormatDealerOptions = {},
): DealerSelectionData => {
  const { shouldSaveAddress = false } = options;
  const formattedPhoneNumber = formatPhoneNumber({ phoneNumber: dealer.phone_number });
  const shippingRecipient =
    dealer.shipping_recipient_first_name && dealer.shipping_recipient_last_name
      ? {
          firstName: dealer.shipping_recipient_first_name,
          lastName: dealer.shipping_recipient_last_name,
        }
      : {};

  return {
    phone: formattedPhoneNumber,
    company: dealer.business_name,
    address1: dealer.premise_street,
    address2: '',
    city: dealer.premise_city,
    stateOrProvinceCode: dealer.premise_state,
    stateOrProvince: dealer.premise_state,
    shouldSaveAddress,
    postalCode: dealer.premise_zip,
    country: 'United States',
    localizedCountry: 'United States',
    countryCode: 'US',
    fflID: dealer.license,
    dealerId: dealer.id,
    customFields: [],
    uuid: dealer.uuid,
    ...shippingRecipient,
  };
};
