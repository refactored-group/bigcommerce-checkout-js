import { CustomerInitializeOptions } from '@bigcommerce/checkout-sdk';
import { noop } from 'lodash';
import React, { FunctionComponent, useCallback } from 'react';

import { navigateToOrderConfirmation } from '../../checkout';
import CheckoutButton, { CheckoutButtonProps } from '../CheckoutButton';

const PayPalCommerceButton: FunctionComponent<CheckoutButtonProps> = ({
    methodId,
    initialize,
    onComplete = navigateToOrderConfirmation,
    onError,
    onClick = noop,
    ...rest
}) => {
    const initializeOptions = useCallback(
        (options: CustomerInitializeOptions) =>
            initialize({
                ...options,
                [methodId]: {
                    container: rest.containerId,
                    onError,
                    onClick: () => onClick(methodId),
                    onComplete,
                },
            }),
        [initialize, methodId, onClick, onComplete, onError, rest.containerId],
    );

    return <CheckoutButton initialize={initializeOptions} methodId={methodId} {...rest} />;
};

export default PayPalCommerceButton;
