import React, { FunctionComponent } from 'react';

import { Label, TextInput } from '@bigcommerce/checkout/ui';

interface CustomerNameFieldsProps {
  firstName: string;
  firstNameError: boolean;
  lastName: string;
  lastNameError: boolean;
  onChange(value: string, fieldId: string): void;
}

/**
 * Recipient first/last name capture for FFL/dealer-driven consignments and the
 * non-FFL ammo CustomShippingForm. Renders inside a `.checkout-address` flex
 * container so the two fields share a row at small+ breakpoints (matches the
 * native AddressForm layout via packages/core/src/app/address/AddressForm.scss).
 *
 * Uses the native UI primitives (`<Label>`, `<TextInput>`) so styling stays in
 * lock-step with the rest of checkout, but stays controlled (no Formik) since
 * DealerShipping owns the canonical state and the consignment commit is driven
 * by an iframe postMessage rather than a form submit.
 */
const CustomerNameFields: FunctionComponent<CustomerNameFieldsProps> = ({
  firstName,
  firstNameError,
  lastName,
  lastNameError,
  onChange,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onChange(e.target.value, e.target.id);
  };

  return (
    <div className="checkout-address recipient-name-fields">
      <div
        className={
          'dynamic-form-field dynamic-form-field--firstName' +
          (firstNameError ? ' form-field--error' : '')
        }
      >
        <Label htmlFor="firstNameInput" id="firstNameInput-label">
          First Name
        </Label>
        <TextInput
          aria-labelledby="firstNameInput-label firstNameInput-field-error-message"
          autoComplete="given-name"
          id="firstNameInput"
          name="firstName"
          onChange={handleChange}
          value={firstName}
        />
        {firstNameError && (
          <ul className="form-field-errors">
            <li className="form-field-error">
              <label
                aria-live="polite"
                className="form-inlineMessage"
                id="firstNameInput-field-error-message"
                role="alert"
              >
                First Name is required
              </label>
            </li>
          </ul>
        )}
      </div>

      <div
        className={
          'dynamic-form-field dynamic-form-field--lastName' +
          (lastNameError ? ' form-field--error' : '')
        }
      >
        <Label htmlFor="lastNameInput" id="lastNameInput-label">
          Last Name
        </Label>
        <TextInput
          aria-labelledby="lastNameInput-label lastNameInput-field-error-message"
          autoComplete="family-name"
          id="lastNameInput"
          name="lastName"
          onChange={handleChange}
          value={lastName}
        />
        {lastNameError && (
          <ul className="form-field-errors">
            <li className="form-field-error">
              <label
                aria-live="polite"
                className="form-inlineMessage"
                id="lastNameInput-field-error-message"
                role="alert"
              >
                Last Name is required
              </label>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
};

export default CustomerNameFields;
