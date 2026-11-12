import { createCheckoutService } from '@bigcommerce/checkout-sdk';
import { mount, ReactWrapper } from 'enzyme';
import React from 'react';

import { ExtensionProvider } from '@bigcommerce/checkout/checkout-extension';
import { createLocaleContext, LocaleContext } from '@bigcommerce/checkout/locale';
import { CheckoutProvider } from '@bigcommerce/checkout/payment-integration-api';

import { getStoreConfig } from '../../config/config.mock';
import composeFFLCheckoutNotes from '../../order/composeFFLCheckoutNotes';

import ShippingFormFooter, { ShippingFormFooterProps } from './ShippingFormFooter';

const dealer = { fflID: '6-04-123-01-5F-03791', uuid: 'certificate-uuid' };

describe('dealer ShippingFormFooter comments', () => {
  const checkoutService = createCheckoutService();
  const defaultProps: ShippingFormFooterProps = {
    cartHasChanged: false,
    customerMessage: composeFFLCheckoutNotes('Customer note', dealer),
    isLoading: false,
    onSubmit: jest.fn().mockResolvedValue(undefined),
    shouldDisableSubmit: false,
    shouldShowOrderComments: true,
    shouldShowShippingOptions: false,
  };

  const mountSubject = (props: Partial<ShippingFormFooterProps> = {}): ReactWrapper =>
    mount(
      <CheckoutProvider checkoutService={checkoutService}>
        <LocaleContext.Provider value={createLocaleContext(getStoreConfig())}>
          <ExtensionProvider checkoutService={checkoutService}>
            <ShippingFormFooter {...defaultProps} {...props} />
          </ExtensionProvider>
        </LocaleContext.Provider>
      </CheckoutProvider>,
    );

  it('shows only customer text and honors an intentional empty draft', () => {
    const fromSavedValue = mountSubject();
    const fromDraft = mountSubject({ orderCommentDraft: '' });

    expect(fromSavedValue.find('input[name="orderComment"]').prop('value')).toBe('Customer note');
    expect(fromDraft.find('input[name="orderComment"]').prop('value')).toBe('');
  });

  it('freezes the field while saving and reports hidden-input overflow', () => {
    const saving = mountSubject({ isLoading: true });
    const hidden = mountSubject({
      orderCommentErrorLimit: 1850,
      shouldShowOrderComments: false,
    });

    expect(saving.find('input[name="orderComment"]').prop('disabled')).toBe(true);
    expect(hidden.find('input[name="orderComment"]')).toHaveLength(0);
    expect(hidden.text()).toContain(
      'We could not save the shipping details for this order. Please contact the store before continuing.',
    );
  });
});
