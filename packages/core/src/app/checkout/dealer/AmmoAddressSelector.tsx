import React from 'react';
import { Address, Country, Customer, Consignment } from '@bigcommerce/checkout-sdk';
import AddressSelect from '../../address/AddressSelect';
import { AddressFormModal, AddressFormValues } from '../../address';

interface AmmoAddressSelectorProps {
  customer: Customer;
  countries: Country[];
  countriesWithAutocomplete: string[];
  defaultCountryCode: string;
  getFields: any;
  googleMapsApiKey: string;
  isLoading: boolean;
  itemAddingAddress: any;
  stateRestrictedConsignmentItems: any[];
  consignments: Consignment[];
  onCloseAddAddressForm: () => void;
  onSaveAddress: (address: AddressFormValues) => void;
  onSelectAddress: (address: Address, itemId: string, itemKey: string) => Promise<void>;
  onUseNewAddress: (address: Address, itemId: string, itemKey: string) => void;
}

export default class AmmoAddressSelector extends React.PureComponent<AmmoAddressSelectorProps> {
  render() {
    const {
      customer,
      countries,
      countriesWithAutocomplete,
      defaultCountryCode,
      getFields,
      googleMapsApiKey,
      isLoading,
      itemAddingAddress,
      stateRestrictedConsignmentItems,
      consignments,
      onCloseAddAddressForm,
      onSaveAddress,
      onSelectAddress,
      onUseNewAddress,
    } = this.props;

    return (
      <div className="ammo-address-selector">
        <legend className="optimizedCheckout-headingSecondary" style={{ marginBottom: '5px' }}>
          Select Shipping Address
        </legend>
        <AddressFormModal
          countries={countries}
          countriesWithAutocomplete={countriesWithAutocomplete}
          defaultCountryCode={defaultCountryCode}
          getFields={getFields}
          googleMapsApiKey={googleMapsApiKey}
          isLoading={isLoading}
          isOpen={!!itemAddingAddress}
          onRequestClose={onCloseAddAddressForm}
          onSaveAddress={onSaveAddress}
        />
        <AddressSelect
          addresses={customer.addresses}
          onSelectAddress={onSelectAddress}
          onUseNewAddress={onUseNewAddress}
          selectedAddress={
            stateRestrictedConsignmentItems.length > 0 &&
            consignments.length > 0 &&
            consignments[0].shippingAddress
          }
        />
      </div>
    );
  }
}
