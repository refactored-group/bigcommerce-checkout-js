import { FormField } from '@bigcommerce/checkout-sdk';

/**
 * Filters form fields to return only required custom (user-defined) fields.
 * These are fields configured by the merchant in BC Admin > Settings >
 * Account Sign Up Form > Address Fields where custom === true and required === true.
 */
export default function getRequiredCustomFormFields(formFields: FormField[]): FormField[] {
    return formFields.filter((field) => field.custom && field.required);
}
