import { Address } from '@bigcommerce/checkout-sdk';

export interface DealerSelectionData extends Omit<Address, 'id'> {
  firstName: string;
  lastName: string;
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
}
