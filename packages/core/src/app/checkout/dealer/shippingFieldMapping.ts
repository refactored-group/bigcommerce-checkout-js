/**
 * Single source of truth for the mapping between BigCommerce SDK field names
 * and the form input element IDs used in CustomShippingForm.
 *
 * SDK field name → form input ID
 */
export const SDK_FIELD_TO_INPUT_ID: Record<string, string> = {
    firstName: 'firstNameInput',
    lastName: 'lastNameInput',
    company: 'companyInput',
    phone: 'phoneInput',
    address1: 'addressLine1Input',
    address2: 'addressLine2Input',
    city: 'cityInput',
    postalCode: 'postCodeInput',
};

/**
 * Reverse mapping: form input ID → SDK field name
 */
export const INPUT_ID_TO_SDK_FIELD: Record<string, string> = Object.fromEntries(
    Object.entries(SDK_FIELD_TO_INPUT_ID).map(([sdk, input]) => [input, sdk]),
);

/**
 * All SDK field names used in the custom shipping form.
 */
export const SHIPPING_FIELD_NAMES = Object.keys(SDK_FIELD_TO_INPUT_ID);
