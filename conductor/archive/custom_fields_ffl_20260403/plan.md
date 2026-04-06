# Plan: Custom Address Fields in FFL Checkout

## Phase 1: Custom Field Data Layer

- [x] Task: Add custom field state and props to DealerShipping
    - [x] Write tests for filtering required custom fields from SDK `getFields()` response
    - [x] Implement: Add state for custom field values in DealerShipping component
    - [x] Implement: Create helper to filter `getFields()` to only `custom === true` AND `required === true` fields
    - [x] Implement: Pass filtered custom fields and change handler as props to child components

- [x] Task: Merge custom fields into shipping address on assignItem
    - [x] Write tests for address composition (dealer address + customFields, ammo address + customFields)
    - [x] Implement: Update `assignItem()` calls to include `customFields` in the shipping address object
    - [x] Implement: Ensure custom field values are included in both dealer selection and manual ammo form flows

- [x] Task: Conductor - User Manual Verification 'Custom Field Data Layer' (Protocol in workflow.md)

## Phase 2: Custom Field Rendering

- [x] Task: Render custom fields in FFL dealer selection flow
    - [x] Write tests for custom field rendering below dealer selection UI
    - [x] Implement: Add `DynamicFormField` rendering for required custom fields in the dealer selection section of DealerShipping
    - [x] Implement: Wire field change handlers to update custom field state
    - [x] Verify fields are visible from the start of the FFL shipping step (not gated behind dealer selection)

- [x] Task: Render custom fields in manual ammo shipping form
    - [x] Write tests for custom field rendering below CustomShippingForm
    - [x] Implement: Add `DynamicFormField` rendering for required custom fields in the ammo shipping form section
    - [x] Implement: Wire field change handlers to update custom field state

- [x] Task: Conductor - User Manual Verification 'Custom Field Rendering' (Protocol in workflow.md)

## Phase 3: Validation

- [x] Task: Add validation for required custom fields
    - [x] Write tests for validation: empty required fields produce errors, filled fields pass
    - [x] Implement: Integrate `getCustomFormFieldsValidationSchema` or equivalent validation for custom fields
    - [x] Implement: Display inline validation errors on required custom fields
    - [x] Implement: Block shipping step progression when required custom fields are empty

- [x] Task: Add scroll-to-first-error for custom field validation
    - [x] Write tests for scroll-to-error behavior targeting custom fields
    - [x] Implement: Extend existing scroll-to-first-error logic to include custom field validation errors

- [x] Task: Conductor - User Manual Verification 'Validation' (Protocol in workflow.md)

## Phase 4: Integration Testing & Regression

- [x] Task: Verify standard (non-FFL) checkout is unaffected
    - [x] Write tests confirming standard shipping flow does not render extra custom fields or change behavior
    - [x] Verify no regressions in existing shipping form tests

- [x] Task: End-to-end validation of full FFL checkout with custom fields
    - [x] Write integration tests for firearms flow: dealer selected + custom fields filled + address submitted with customFields
    - [x] Write integration tests for ammo flow: manual address + custom fields filled + address submitted with customFields
    - [x] Verify all SDK-supported field types render and validate correctly (text, dropdown, date, checkbox, multiline)

- [x] Task: Conductor - User Manual Verification 'Integration Testing & Regression' (Protocol in workflow.md)
