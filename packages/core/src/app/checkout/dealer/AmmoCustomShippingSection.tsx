import React, { lazy } from 'react';
import { Country, FormField } from '@bigcommerce/checkout-sdk';
import { retry } from '../../common/utility';

const CustomShippingForm = lazy(() =>
  retry(() => import(/* webpackChunkName: "customShippingForm" */ './CustomShippingForm')),
);

const CustomFormFieldsSection = lazy(() =>
  retry(() => import(/* webpackChunkName: "customFormFieldsSection" */ './CustomFormFieldsSection')),
);

const CountryDropdown = lazy(() =>
  retry(() => import(/* webpackChunkName: "countryDropdown" */ './CountryDropdown')),
);

interface AmmoCustomShippingSectionProps {
  countries: Country[];
  customShippingValues: Record<string, string>;
  customShippingErrors: Record<string, boolean>;
  fieldRequirements: Record<string, boolean>;
  requiredCustomFields: FormField[];
  customFormFieldValues: Record<string, string | string[] | number>;
  customFormFieldErrors: Record<string, boolean>;
  onChangeCustomShippingField: (value: string, fieldId: string) => void;
  onChangeCustomFormField: (fieldId: string, value: string | string[] | number) => void;
}

export default class AmmoCustomShippingSection extends React.PureComponent<AmmoCustomShippingSectionProps> {
  render() {
    const {
      countries,
      customShippingValues,
      customShippingErrors,
      fieldRequirements,
      requiredCustomFields,
      customFormFieldValues,
      customFormFieldErrors,
      onChangeCustomShippingField,
      onChangeCustomFormField,
    } = this.props;

    return (
      <>
        <CustomShippingForm
          onChangeCustomShippingField={onChangeCustomShippingField}
          values={customShippingValues}
          errors={customShippingErrors}
          fieldRequirements={fieldRequirements}
          countryDropdown={
            <CountryDropdown
              countries={countries}
              selectedCountry="US"
            />
          }
        />
        <CustomFormFieldsSection
          fields={requiredCustomFields}
          values={customFormFieldValues}
          errors={customFormFieldErrors}
          onChange={onChangeCustomFormField}
        />
      </>
    );
  }
}
