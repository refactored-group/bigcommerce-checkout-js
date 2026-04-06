# Spec: Custom Address Fields in FFL Checkout

## Overview
Support merchant-configured required custom address fields (from BC Admin > Settings > Account Sign Up Form > Address Fields) in the FFL-required checkout flow. Required custom fields will appear in both the FFL dealer selection (firearms) and manual ammo shipping form contexts, allowing the shipping address to combine FFL dealer/ammo address data with customer-provided custom field values.

## Functional Requirements

### 1. Custom Field Display
- Fetch custom address fields from the BigCommerce SDK via `getFields(countryCode)`.
- Filter to only fields where `custom === true` AND `required === true`.
- Render these fields below the FFL dealer selection UI (for firearms) and below the manual ammo address form (for ammunition).
- Fields are always visible in the FFL shipping step, regardless of whether a dealer has been selected.
- Support all field types: text, dropdown, date, checkbox, multiline, radio.

### 2. Field Rendering
- Reuse the existing `DynamicFormField` component for rendering custom fields.
- Use the field's `label` property from the SDK for display (no translation lookup needed for custom fields).
- Respect field configuration: `fieldType`, `type`, `maxLength`, `min`, `max`, `options`, etc.

### 3. Validation
- Leverage the existing `getCustomFormFieldsValidationSchema` for validation logic.
- Required custom fields must be validated before the shipping step can proceed.
- Display inline validation errors on empty/invalid required fields.
- Scroll to the first validation error if the customer attempts to proceed without completing required fields.

### 4. Address Composition
- When submitting the shipping address, merge custom field values into the address object under `customFields`.
- For FFL dealer selection: the shipping address = dealer address fields + custom field values.
- For manual ammo form: the shipping address = manually entered address fields + custom field values.
- The `customFields` data must be included in the `assignItem()` SDK call.

## Non-Functional Requirements
- No changes to the FFL dealer map iframe or `automatic-ffl-map` codebase.
- Must not affect the standard (non-FFL) checkout flow.
- Follow existing code patterns in `DealerShipping.tsx` and `CustomShippingForm.tsx`.

## Acceptance Criteria
1. When a merchant has required custom address fields configured, they appear in the FFL checkout below the dealer selection and below the ammo shipping form.
2. All SDK-supported field types render correctly (text, dropdown, date, checkbox, multiline).
3. Required field validation prevents proceeding if fields are empty, with inline error messages.
4. Scroll-to-first-error behavior works for custom field validation errors.
5. The submitted shipping address includes `customFields` with the customer's input values.
6. The standard (non-FFL) checkout flow is unaffected.
7. Custom fields are visible from the start of the FFL shipping step (not gated behind dealer selection).

## Out of Scope
- Showing optional custom fields.
- Changes to the `automatic-ffl-map` iframe or dealer data structure.
- Custom field support outside the shipping address context (e.g., billing).
- Creating new UI components — reuse existing `DynamicFormField`.
