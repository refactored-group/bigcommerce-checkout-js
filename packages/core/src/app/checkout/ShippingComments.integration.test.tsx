import { createCheckoutService } from '@bigcommerce/checkout-sdk';
import { mount } from 'enzyme';
import React, { FunctionComponent, useState } from 'react';
import { act } from 'react-dom/test-utils';

import { ExtensionProvider } from '@bigcommerce/checkout/checkout-extension';
import { createLocaleContext, LocaleContext } from '@bigcommerce/checkout/locale';
import { CheckoutProvider } from '@bigcommerce/checkout/payment-integration-api';

import { getStoreConfig } from '../config/config.mock';
import composeFFLCheckoutNotes from '../order/composeFFLCheckoutNotes';

import ShippingFormFooter from './dealer/ShippingFormFooter';

const dealer = {
  fflID: '6-04-123-01-5F-03791',
  uuid: 'certificate-uuid',
};

const checkoutService = createCheckoutService();

const Harness: FunctionComponent<{
  readonly mode: 'normal' | 'custom';
  save(message: { customerMessage: string }): Promise<void>;
  handoff(mode: 'normal' | 'custom'): void;
}> = ({ mode, save, handoff }) => {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <CheckoutProvider checkoutService={checkoutService}>
      <LocaleContext.Provider value={createLocaleContext(getStoreConfig())}>
        <ExtensionProvider checkoutService={checkoutService}>
          <ShippingFormFooter
            cartHasChanged={false}
            customerMessage=""
            isLoading={false}
            onSubmit={async ({ orderComment }: { orderComment: string }) => {
              try {
                await save({
                  customerMessage: composeFFLCheckoutNotes(orderComment, dealer),
                });
                setConfirmed(true);
              } catch {
                setConfirmed(false);
              }
            }}
            shouldDisableSubmit={false}
            shouldShowOrderComments
            shouldShowShippingOptions={false}
          />
          {confirmed && (
            <button id="stub-payment-handoff" onClick={() => handoff(mode)}>
              Continue to payment
            </button>
          )}
        </ExtensionProvider>
      </LocaleContext.Provider>
    </CheckoutProvider>
  );
};

describe('shipping comment confirmation to payment handoff', () => {
  it.each(['normal', 'custom'] as const)(
    'saves the complete optional-certificate block before the %s handoff',
    async (mode) => {
      let releaseSave: (() => void) | undefined;
      const gate = new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      const save = jest.fn().mockReturnValue(gate);
      const handoff = jest.fn();
      const component = mount(<Harness handoff={handoff} mode={mode} save={save} />);

      await act(async () => {
        component.find('input[name="orderComment"]').simulate('change', {
          target: { name: 'orderComment', value: 'Customer note' },
        });
        await Promise.resolve();
      });
      component.update();
      component.find('#checkout-shipping-continue').last().simulate('click', {
        preventDefault: jest.fn(),
      });
      await act(async () => Promise.resolve());

      expect(save).toHaveBeenCalledWith({
        customerMessage: composeFFLCheckoutNotes('Customer note', dealer),
      });
      expect(save.mock.calls[0][0].customerMessage).toContain(
        '|Certificate:https://certificate.automaticffl.com/certificate-uuid',
      );
      expect(component.find('#stub-payment-handoff')).toHaveLength(0);

      await act(async () => {
        releaseSave?.();
        await gate;
      });
      component.update();
      component.find('#stub-payment-handoff').simulate('click');

      expect(handoff).toHaveBeenCalledWith(mode);
    },
  );

  it('does not expose a payment handoff when confirmation fails', async () => {
    const save = jest.fn().mockRejectedValue(new Error('save failed'));
    const handoff = jest.fn();
    const component = mount(<Harness handoff={handoff} mode="custom" save={save} />);

    component.find('#checkout-shipping-continue').last().simulate('click', {
      preventDefault: jest.fn(),
    });
    await act(async () => Promise.resolve());
    component.update();

    expect(component.find('#stub-payment-handoff')).toHaveLength(0);
    expect(handoff).not.toHaveBeenCalled();
  });
});
