import React from 'react';
import './CustomShippingForm.scss';

interface CustomShippingFormProps {
  values: Record<string, string>;
  errors: Record<string, boolean>;
  fieldRequirements: Record<string, boolean>;
  onChangeCustomShippingField: any;
  countryDropdown?: React.ReactNode;
}

interface FieldConfig {
  sdkName: string;
  inputId: string;
  label: string;
  autoComplete: string;
  type?: string;
}

const FIELD_CONFIGS: FieldConfig[] = [
  { sdkName: 'firstName', inputId: 'firstNameInput', label: 'First Name', autoComplete: 'given-name' },
  { sdkName: 'lastName', inputId: 'lastNameInput', label: 'Last Name', autoComplete: 'family-name' },
  { sdkName: 'company', inputId: 'companyInput', label: 'Company Name', autoComplete: 'organization' },
  { sdkName: 'phone', inputId: 'phoneInput', label: 'Phone Number', autoComplete: 'tel', type: 'tel' },
  { sdkName: 'address1', inputId: 'addressLine1Input', label: 'Address', autoComplete: 'address-line1' },
  { sdkName: 'address2', inputId: 'addressLine2Input', label: 'Apartment/Suite/Building', autoComplete: 'address-line2' },
];

const FIELD_CONFIGS_AFTER_COUNTRY: FieldConfig[] = [
  { sdkName: 'city', inputId: 'cityInput', label: 'City', autoComplete: 'address-level2' },
  { sdkName: 'postalCode', inputId: 'postCodeInput', label: 'Postal Code', autoComplete: 'postal-code' },
];

export default class CustomShippingForm extends React.PureComponent<CustomShippingFormProps> {
  constructor(props: CustomShippingFormProps) {
    super(props);
    this.onChangeField = this.onChangeField.bind(this);
  }

  onChangeField(event: any): void {
    const value = event.target.value;
    const fieldId = event.target.id;
    this.props.onChangeCustomShippingField(value, fieldId);
  }

  private renderField(config: FieldConfig): React.ReactNode {
    const { values, errors, fieldRequirements } = this.props;
    const value = values[config.sdkName] || '';
    const hasError = errors[config.sdkName] || false;
    const isRequired = fieldRequirements[config.sdkName] ?? false;

    return (
      <div
        key={config.inputId}
        className={
          'dynamic-form-field dynamic-form-field--' + config.sdkName + ' ' +
          (hasError ? 'form-field--error' : '')
        }
      >
        <div className="form-field">
          <label id={`${config.inputId}-label`} className="form-label optimizedCheckout-form-label">
            {config.label}{' '}
            {!isRequired && (
              <small className="optimizedCheckout-contentSecondary">(Optional)</small>
            )}
          </label>
          <input
            aria-labelledby={`${config.inputId}-label ${config.inputId}-field-error-message`}
            autoComplete={config.autoComplete}
            id={config.inputId}
            type={config.type || 'text'}
            className="form-input optimizedCheckout-form-input"
            name={config.sdkName}
            value={value}
            onChange={this.onChangeField}
          />
          <ul className={'form-field-errors ' + (hasError ? '' : 'hide')}>
            <li className="form-field-error">
              <label
                aria-live="polite"
                className="form-inlineMessage"
                id={`${config.inputId}-field-error-message`}
                role="alert"
              >
                {config.label} is required
              </label>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="checkout-address">
        {FIELD_CONFIGS.map((config) => this.renderField(config))}

        {/* Render the country dropdown */}
        {this.props.countryDropdown}

        {FIELD_CONFIGS_AFTER_COUNTRY.map((config) => this.renderField(config))}
      </div>
    );
  }
}
