import React from 'react';
import { Address, Country, Customer } from '@bigcommerce/checkout-sdk';
import AddressSelect from '../../address/AddressSelect';
import { AddressFormModal, AddressFormValues } from '../../address';
import { Form } from '../../ui/form';

interface NonFFLConsignmentSectionProps {
  groupedItemsWithoutFFLEntries: [string, any[]][];
  itemsWithoutFFL: any[];
  multiShipment: boolean;
  isLoading: boolean;
  isComponentLoading: boolean;
  customer: Customer;
  countries: Country[];
  countriesWithAutocomplete: string[];
  defaultCountryCode: string;
  getFields: any;
  googleMapsApiKey: string;
  itemAddingAddress: any;
  hasOnlyAmmunition: boolean;
  onCloseAddAddressForm: () => void;
  onSaveAddress: (address: AddressFormValues) => void;
  onSelectAddress: (address: Address, itemId: string, itemKey: string) => Promise<void>;
  onUseNewAddress: (address: Address, itemId: string, itemKey: string) => void;
}

export default class NonFFLConsignmentSection extends React.PureComponent<NonFFLConsignmentSectionProps> {
  render() {
    const {
      groupedItemsWithoutFFLEntries,
      itemsWithoutFFL,
      multiShipment,
      isLoading,
      isComponentLoading,
      customer,
      countries,
      countriesWithAutocomplete,
      defaultCountryCode,
      getFields,
      googleMapsApiKey,
      itemAddingAddress,
      hasOnlyAmmunition,
      onCloseAddAddressForm,
      onSaveAddress,
      onSelectAddress,
      onUseNewAddress,
    } = this.props;

    return (
      <div className="non-ffl-consignment-area" style={{ marginTop: '10px' }}>
        {!isComponentLoading && (
          <>
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
            <Form>
              <ul className="consignmentList">
                {multiShipment ? (
                  <div className="multiShip-text">
                    {itemsWithoutFFL.length > 0 && 'Other items in cart will also ship to FFL'}
                    {itemsWithoutFFL.map((item) => (
                      <div className="consignment" key={item.key}>
                        <figure className="consignment-product-figure">
                          {item.imageUrl && <img alt={item.name} src={item.imageUrl} />}
                        </figure>
                        <div className="consignment-product-body">
                          <h4 className="optimizedCheckout-contentPrimary">
                            {`${item.quantity} x ${item.name}`}
                          </h4>
                          {(item.options || []).map(({ name: optionName, value, nameId }) => (
                            <ul
                              className="product-options optimizedCheckout-contentSecondary"
                              key={nameId}
                            >
                              <li className="product-option">{`${optionName} ${value}`}</li>
                            </ul>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  groupedItemsWithoutFFLEntries.map(([key, items], index) => (
                    <div key={key}>
                      <div className="consignment">
                        <figure className="consignment-product-figure">
                          {items[0].imageUrl && (
                            <img alt={items[0].imageUrl} src={items[0].imageUrl} />
                          )}
                        </figure>
                        <div className="consignment-product-body">
                          <h5 className="optimizedCheckout-contentPrimary">
                            {`${items.length} x ${items[0].name}`}
                          </h5>
                        </div>
                      </div>
                      {index + 1 === groupedItemsWithoutFFLEntries.length &&
                        !(customer.isGuest === false && hasOnlyAmmunition) && (
                          <AddressSelect
                            addresses={customer.addresses}
                            onSelectAddress={onSelectAddress}
                            onUseNewAddress={onUseNewAddress}
                            selectedAddress={
                              items[0].consignment && items[0].consignment.shippingAddress
                            }
                          />
                        )}
                    </div>
                  ))
                )}
              </ul>
            </Form>
          </>
        )}
      </div>
    );
  }
}
