import { Consignment } from '@bigcommerce/checkout-sdk';
import { ConsignmentItem } from './types';

interface GetFFLItemsParams {
    fflConsignmentItems: ConsignmentItem[];
    stateRestrictedConsignmentItems: ConsignmentItem[];
    withAmmoSubscription: boolean;
    ammoStateFFLRequired: boolean | null;
    bypassFFL: boolean;
}

/**
 * Determines which cart items require FFL shipping.
 */
export function getFFLItems(params: GetFFLItemsParams): ConsignmentItem[] {
    const {
        fflConsignmentItems,
        stateRestrictedConsignmentItems,
        withAmmoSubscription,
        ammoStateFFLRequired,
        bypassFFL,
    } = params;

    if (bypassFFL) {
        return [];
    }

    // If there are firearms and ammo in the cart with an ammo subscription,
    // mark ammo as FFL required without state checks
    if (withAmmoSubscription && fflConsignmentItems.length > 0 && stateRestrictedConsignmentItems.length > 0) {
        return fflConsignmentItems.concat(stateRestrictedConsignmentItems);
    }

    // Ammo subscription active and state requires FFL
    if (withAmmoSubscription && ammoStateFFLRequired) {
        return fflConsignmentItems.concat(stateRestrictedConsignmentItems);
    }

    return fflConsignmentItems;
}

/**
 * Returns the consignment that contains any FFL items.
 */
export function getFFLConsignment(
    consignments: Consignment[],
    fflItems: ConsignmentItem[],
): Consignment | undefined {
    return consignments.find((consignment) =>
        fflItems.some((fflItem) => consignment.lineItemIds.includes(fflItem.itemId)),
    );
}

/**
 * Checks if the cart contains any firearm items.
 */
export function hasFirearms(fflConsignmentItems: ConsignmentItem[]): boolean {
    return fflConsignmentItems.length > 0;
}

/**
 * Checks if the cart contains any ammunition items.
 */
export function hasAmmunition(stateRestrictedConsignmentItems: ConsignmentItem[]): boolean {
    return stateRestrictedConsignmentItems.length > 0;
}

/**
 * Checks if the cart contains only ammunition (no firearms).
 */
export function hasOnlyAmmunition(
    fflConsignmentItems: ConsignmentItem[],
    stateRestrictedConsignmentItems: ConsignmentItem[],
): boolean {
    return fflConsignmentItems.length === 0 && stateRestrictedConsignmentItems.length > 0;
}

/**
 * Checks if the cart contains any FFL items.
 */
export function hasAnyFflItems(fflItems: ConsignmentItem[]): boolean {
    return fflItems.length > 0;
}

interface IsStateFFLRequiredParams {
    stateCode: string;
    fflRestrictedStates: string[];
    fflConsignmentItems: ConsignmentItem[];
    stateRestrictedConsignmentItems: ConsignmentItem[];
    withAmmoSubscription: boolean;
}

/**
 * Determines if a given state requires FFL for ammo shipments.
 */
export function isStateFFLRequired(params: IsStateFFLRequiredParams): boolean {
    const {
        stateCode,
        fflRestrictedStates,
        fflConsignmentItems,
        stateRestrictedConsignmentItems,
        withAmmoSubscription,
    } = params;

    // Skip state validation if there are firearms and ammo with an ammo subscription
    const skipStateValidation =
        withAmmoSubscription && fflConsignmentItems.length > 0 && stateRestrictedConsignmentItems.length > 0;

    return skipStateValidation || fflRestrictedStates.includes(stateCode);
}
