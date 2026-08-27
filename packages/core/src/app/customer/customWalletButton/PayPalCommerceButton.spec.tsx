import { mount } from 'enzyme';
import { noop } from 'lodash';
import React, { FunctionComponent } from 'react';

import { createLocaleContext, LocaleContext, LocaleContextType } from '@bigcommerce/checkout/locale';

import { getStoreConfig } from '../../config/config.mock';
import CheckoutButton from '../CheckoutButton';

import PayPalCommerceButton from './PayPalCommerceButton';

describe('PayPalCommerceButton', () => {
    let localeContext: LocaleContextType;
    let ButtonTest: FunctionComponent;
    const initialize = jest.fn();
    const complete = jest.fn();
    const error = jest.fn();

    beforeEach(() => {
        localeContext = createLocaleContext(getStoreConfig());
        ButtonTest = () => (
            <LocaleContext.Provider value={localeContext}>
                <PayPalCommerceButton
                    containerId="paypalcommerceId"
                    deinitialize={noop}
                    initialize={initialize}
                    methodId="paypalcommerce"
                    onClick={jest.fn()}
                    onComplete={complete}
                    onError={error}
                />
            </LocaleContext.Provider>
        );
    });

    it('renders as CheckoutButton', () => {
        const container = mount(<ButtonTest />);

        expect(container.find(CheckoutButton)).toHaveLength(1);
    });

    it('initializes the button correctly', () => {
        mount(<ButtonTest />);

        expect(initialize).toHaveBeenCalledWith({
            methodId: 'paypalcommerce',
            paypalcommerce: {
                container: 'paypalcommerceId',
                onComplete: complete,
                onClick: expect.any(Function),
                onError: error,
            },
        });

        const options = initialize.mock.calls[0][0];

        options.paypalcommerce.onComplete();

        expect(complete).toHaveBeenCalledTimes(1);
    });
});
