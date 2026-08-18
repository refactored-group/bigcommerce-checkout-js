import {
    CheckoutSelectors,
    CheckoutService,
    createCheckoutService,
    CustomError,
} from '@bigcommerce/checkout-sdk';

import { CheckoutContextProps } from '@bigcommerce/checkout/payment-integration-api';

import mapToCheckoutProps from './mapToCheckoutProps';

describe('mapToCheckoutProps()', () => {
    let checkoutService: CheckoutService;
    let checkoutState: CheckoutSelectors;
    let contextProps: CheckoutContextProps;

    beforeEach(() => {
        checkoutService = createCheckoutService();
        checkoutState = checkoutService.getState();

        contextProps = {
            checkoutService,
            checkoutState,
        };
    });

    it('returns true if unable to submit order because cart has changed', () => {
        jest.spyOn(checkoutState.errors, 'getSubmitOrderError').mockReturnValue({
            type: 'cart_changed',
        } as CustomError);

        const { hasCartChanged } = mapToCheckoutProps(contextProps);

        expect(hasCartChanged).toBe(true);
    });

    it('returns false if unable to submit order because of other causes', () => {
        jest.spyOn(checkoutState.errors, 'getSubmitOrderError').mockReturnValue({
            type: 'unknown',
        } as CustomError);

        const { hasCartChanged } = mapToCheckoutProps(contextProps);

        expect(hasCartChanged).toBe(false);
    });

    it('subscribes to customer identity rather than address-book object changes', () => {
        let stateSelector: ((state: CheckoutSelectors) => unknown) | undefined;
        jest.spyOn(checkoutService, 'subscribe').mockImplementation((_subscriber, selector) => {
            stateSelector = selector as (state: CheckoutSelectors) => unknown;

            return jest.fn();
        });
        jest.spyOn(checkoutState.data, 'getCustomer').mockReturnValue({
            addresses: [],
            id: 4,
            isGuest: false,
        } as any);

        const { subscribeToLogin } = mapToCheckoutProps(contextProps);
        subscribeToLogin(jest.fn());

        expect(stateSelector?.(checkoutState)).toBe('customer:4');

        jest.spyOn(checkoutState.data, 'getCustomer').mockReturnValue({
            addresses: [{ id: 10 }],
            id: 4,
            isGuest: false,
        } as any);

        expect(stateSelector?.(checkoutState)).toBe('customer:4');
    });
});
