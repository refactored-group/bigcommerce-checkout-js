import {
    Address,
    CheckoutSelectors,
    Country,
    FormField,
    ShippingInitializeOptions,
} from '@bigcommerce/checkout-sdk';
import { isEmpty } from 'lodash';
import React, { FunctionComponent, memo } from 'react';

import { localizeAddress } from '@bigcommerce/checkout/locale';
import { CheckoutContextProps } from '@bigcommerce/checkout/payment-integration-api';

import { withCheckout } from '../checkout';

import AddressType from './AddressType';
import isValidAddress from './isValidAddress';

import './StaticAddress.scss';

export interface StaticAddressProps {
    address: Address;
    type?: AddressType;
    /**
     * Skip the `isValidAddress` short-circuit and render whatever the address
     * carries. Used by the FFL dealer flow, which needs to show the dealer's
     * info before the customer has typed their recipient name (i.e. before
     * firstName/lastName are populated). Falls back to `isEmpty` so a fully
     * empty address still renders nothing.
     */
    skipValidation?: boolean;
}

export interface StaticAddressEditableProps extends StaticAddressProps {
    initialize?(options: ShippingInitializeOptions): Promise<CheckoutSelectors>;
}

interface WithCheckoutStaticAddressProps {
    countries?: Country[];
    fields?: FormField[];
}

const StaticAddress: FunctionComponent<
    StaticAddressEditableProps & WithCheckoutStaticAddressProps
> = ({ countries, fields, address: addressWithoutLocalization, skipValidation }) => {
    const address = localizeAddress(addressWithoutLocalization, countries);
    const isValid = skipValidation
        ? !isEmpty(address)
        : !fields
        ? !isEmpty(address)
        : isValidAddress(
              address,
              fields.filter((field) => !field.custom),
          );

    return !isValid ? null : (
        <div className="vcard checkout-address--static" data-test="static-address">
            {(address.firstName || address.lastName) && (
                <p className="fn address-entry">
                    <span className="first-name">{ `${address.firstName} | ` }</span>
                    <span className="family-name">{address.lastName}</span>
                </p>
            )}

            {address.company && (
                <p className="address-entry">
                    <span className="org">{address.company}</span>
                </p>
            )}

            {address.phone && (
                <p className="address-entry">
                    <span className="tel">{address.phone}</span>
                </p>
            )}

            <div className="adr">
                <p className="street-address address-entry">
                    <span className="address-line-1">{`${address.address1} `}</span>
                    {address.address2 && (
                        <span className="address-line-2">{` / ${address.address2}`}</span>
                    )}
                </p>

                <p className="address-entry">
                    {address.city && <span className="locality">{`${address.city}, `}</span>}
                    {address.localizedProvince && (
                        <span className="region">{`${address.localizedProvince}, `}</span>
                    )}
                    {address.postalCode && (
                        <span className="postal-code">{`${address.postalCode} / `}</span>
                    )}
                    {address.localizedCountry && (
                        <span className="country-name">{`${address.localizedCountry} `}</span>
                    )}
                </p>
            </div>
        </div>
    );
};

export function mapToStaticAddressProps(
    context: CheckoutContextProps,
    { address, type }: StaticAddressProps,
): WithCheckoutStaticAddressProps | null {
    const {
        checkoutState: {
            data: { getBillingCountries, getShippingCountries, getBillingAddressFields, getShippingAddressFields },
        },
    } = context;

    return {
        countries: type === AddressType.Billing
            ? getBillingCountries()
            : getShippingCountries(),
        fields:
            type === AddressType.Billing
                ? getBillingAddressFields(address.countryCode)
                : type === AddressType.Shipping
                ? getShippingAddressFields(address.countryCode)
                : undefined,
    };
}

export default withCheckout(mapToStaticAddressProps)(memo(StaticAddress));
