import { Cart, Consignment } from '@bigcommerce/checkout-sdk';
import React, { FunctionComponent, memo } from 'react';
import { TranslatedString } from '@bigcommerce/checkout/locale';

import { isPayPalFastlaneAddress, PoweredByPayPalFastlaneLabel, usePayPalFastlaneAddress } from '@bigcommerce/checkout/paypal-fastlane-integration';

import { AddressType, StaticAddress } from '../address';

import { StaticShippingOption } from './shippingOption';
import './StaticConsignment.scss';
import StaticConsignmentItemList from './StaticConsignmentItemList';

interface StaticConsignmentProps {
    consignment: Consignment;
    cart: Cart;
    compactView?: boolean;
}

const StaticConsignment: FunctionComponent<StaticConsignmentProps> = ({
    consignment,
    cart,
    compactView,
}) => {
    const { paypalFastlaneAddresses } = usePayPalFastlaneAddress();
    const { shippingAddress: address, selectedShippingOption } = consignment;
    const showPayPalFastlaneAddressLabel = isPayPalFastlaneAddress(address, paypalFastlaneAddresses);

    return (
        <div className="staticConsignment">
            {consignment.selectedPickupOption && <strong><TranslatedString id="pickup.summary_heading" /></strong>}
            <StaticAddress address={address} type={AddressType.Shipping} />

            {showPayPalFastlaneAddressLabel && <PoweredByPayPalFastlaneLabel />}

            {!compactView && <StaticConsignmentItemList cart={cart} consignment={consignment} />}

            {selectedShippingOption && !consignment.selectedPickupOption && (
                <div>
                    <div className="shippingOption shippingOption--alt shippingOption--selected">
                        <StaticShippingOption
                            displayAdditionalInformation={false}
                            method={selectedShippingOption}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(StaticConsignment);
