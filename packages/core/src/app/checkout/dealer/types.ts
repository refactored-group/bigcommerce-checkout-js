import { Address } from '@bigcommerce/checkout-sdk';

// Customer's firstName/lastName are sourced from BC SDK state (billingAddress → customer)
// at the consignment-build site in DealerShipping.tsx#commitDealerConsignment, NOT from
// the dealer payload — they're overridden whether the iframe sent them or not. The map
// repo (automatic-ffl-map, commit 3757b65) drops these fields from the iframe postMessage
// payload going forward; the `gb/name-fields-compat-shim` branch keeps re-emitting them
// during rollout so the WooCommerce fork (which still reads them from the payload) keeps
// working until it's updated. This fork doesn't need the shim — the Omit below documents
// the intended contract.
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
