import { Address } from '@bigcommerce/checkout-sdk';

// firstName/lastName are supplied at the consignment-build site in DealerShipping,
// using either the customer name from BC SDK state or the merchant-configured generic
// FFL recipient name. They are not part of the dealer iframe payload.
export interface DealerSelectionData extends Omit<Address, 'id' | 'firstName' | 'lastName'> {
  phone: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  stateOrProvinceCode: string;
  shouldSaveAddress: boolean;
  postalCode: string;
  localizedCountry: string;
  countryCode: string;
  fflID: string;
  dealerId: string;
  uuid?: string;
}

export interface DealerData {
  id: string;
  business_name: string;
  license: string;
  phone_number: string;
  premise_street: string;
  premise_city: string;
  premise_state: string;
  premise_zip: string;
  lat: number;
  lng: number;
  fees: any[];
  schedules: any[];
  preferred?: boolean;
  uuid?: string;
}
