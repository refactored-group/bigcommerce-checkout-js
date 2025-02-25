import React from 'react';
import { DynamicFormField } from '../../ui/form';
import { FormField, FormFieldFieldType } from '@bigcommerce/checkout-sdk';
import './CustomShippingForm.scss';

interface CustomShippingFormProps {
  customShippingFirstName?: string;
  customShippingFirstNameError: boolean;
  customShippingLastName?: string;
  customShippingLastNameError: boolean;
  customShippingCompany?: string;
  customShippingPhone?: string;
  customShippingAddress?: string;
  customShippingAddressError: boolean;
  customShippingApartment?: string;
  customShippingCity?: string;
  customShippingCityError: boolean;
  customShippingPostal?: string;
  customShippingPostalError: boolean;
  onChangeCustomShippingField: (value: string, fieldId: string) => void;
}

const CustomShippingForm: React.FC<CustomShippingFormProps> = (props) => {
  // Create FormField objects for each field
  const firstNameField: FormField = {
    id: 'firstNameInput',
    name: 'firstName',
    type: 'string',
    label: 'First Name',
    required: true,
    custom: false,
    fieldType: 'text' as FormFieldFieldType,
  };

  const lastNameField: FormField = {
    id: 'lastNameInput',
    name: 'lastName',
    type: 'string',
    label: 'Last Name',
    required: true,
    custom: false,
    fieldType: 'text' as FormFieldFieldType,
  };

  const companyField: FormField = {
    id: 'companyInput',
    name: 'company',
    type: 'string',
    label: 'Company Name',
    required: false,
    custom: false,
    fieldType: 'text' as FormFieldFieldType,
  };

  const phoneField: FormField = {
    id: 'phoneInput',
    name: 'phone',
    type: 'string',
    label: 'Phone Number',
    required: false,
    custom: false,
    fieldType: 'text' as FormFieldFieldType,
  };

  const addressField: FormField = {
    id: 'addressLine1Input',
    name: 'address1',
    type: 'string',
    label: 'Address',
    required: true,
    custom: false,
    fieldType: 'text' as FormFieldFieldType,
  };

  const apartmentField: FormField = {
    id: 'addressLine2Input',
    name: 'address2',
    type: 'string',
    label: 'Apartment/Suite/Building',
    required: false,
    custom: false,
    fieldType: 'text' as FormFieldFieldType,
  };

  const cityField: FormField = {
    id: 'cityInput',
    name: 'city',
    type: 'string',
    label: 'City',
    required: true,
    custom: false,
    fieldType: 'text' as FormFieldFieldType,
  };

  const postalCodeField: FormField = {
    id: 'postCodeInput',
    name: 'postalCode',
    type: 'string',
    label: 'Postal Code',
    required: true,
    custom: false,
    fieldType: 'text' as FormFieldFieldType,
  };

  // Handle field changes
  const handleFieldChange = (value: string | string[], fieldId: string) => {
    // Ensure we're passing a string to onChangeCustomShippingField
    const stringValue = typeof value === 'string' ? value : value[0] || '';
    props.onChangeCustomShippingField(stringValue, fieldId);
  };

  return (
    <div className="checkout-address">
      <div
        className={`dynamic-form-field ${
          props.customShippingFirstNameError ? 'form-field--error' : ''
        }`}
      >
        <DynamicFormField
          field={firstNameField}
          onChange={(value) => handleFieldChange(value, firstNameField.id)}
          extraClass={props.customShippingFirstNameError ? 'form-field--error' : ''}
        />
        {props.customShippingFirstNameError && (
          <div className="form-field-error">First Name is required</div>
        )}
      </div>

      <div
        className={`dynamic-form-field ${
          props.customShippingLastNameError ? 'form-field--error' : ''
        }`}
      >
        <DynamicFormField
          field={lastNameField}
          onChange={(value) => handleFieldChange(value, lastNameField.id)}
          extraClass={props.customShippingLastNameError ? 'form-field--error' : ''}
        />
        {props.customShippingLastNameError && (
          <div className="form-field-error">Last Name is required</div>
        )}
      </div>

      <div className="dynamic-form-field">
        <DynamicFormField
          field={companyField}
          onChange={(value) => handleFieldChange(value, companyField.id)}
        />
      </div>

      <div className="dynamic-form-field">
        <DynamicFormField
          field={phoneField}
          onChange={(value) => handleFieldChange(value, phoneField.id)}
        />
      </div>

      <div
        className={`dynamic-form-field ${
          props.customShippingAddressError ? 'form-field--error' : ''
        }`}
      >
        <DynamicFormField
          field={addressField}
          onChange={(value) => handleFieldChange(value, addressField.id)}
          extraClass={props.customShippingAddressError ? 'form-field--error' : ''}
        />
        {props.customShippingAddressError && (
          <div className="form-field-error">Address is required</div>
        )}
      </div>

      <div className="dynamic-form-field">
        <DynamicFormField
          field={apartmentField}
          onChange={(value) => handleFieldChange(value, apartmentField.id)}
        />
      </div>

      <div
        className={`dynamic-form-field ${props.customShippingCityError ? 'form-field--error' : ''}`}
      >
        <DynamicFormField
          field={cityField}
          onChange={(value) => handleFieldChange(value, cityField.id)}
          extraClass={props.customShippingCityError ? 'form-field--error' : ''}
        />
        {props.customShippingCityError && <div className="form-field-error">City is required</div>}
      </div>

      <div
        className={`dynamic-form-field ${
          props.customShippingPostalError ? 'form-field--error' : ''
        }`}
      >
        <DynamicFormField
          field={postalCodeField}
          onChange={(value) => handleFieldChange(value, postalCodeField.id)}
          extraClass={props.customShippingPostalError ? 'form-field--error' : ''}
        />
        {props.customShippingPostalError && (
          <div className="form-field-error">Postal Code is required</div>
        )}
      </div>
    </div>
  );
};

export default CustomShippingForm;
