// @ts-nocheck
import React, { PureComponent, ReactNode } from 'react';
import { withFormik } from 'formik';

import { withLanguage, TranslatedString, WithLanguageProps } from '@bigcommerce/checkout/locale';
import stripFFLFromCheckoutNotes from '../../order/stripFFLFromCheckoutNotes';
import { OrderComments } from '../../orderComments';
import { Alert, AlertType } from '../../ui/alert';
import { Button, ButtonVariant } from '../../ui/button';
import { Fieldset, Legend } from '../../ui/form';

import { ShippingOptions } from '../../shipping/shippingOption';

export interface ShippingFormFooterProps {
    cartHasChanged: boolean;
    shouldShowOrderComments: boolean;
    shouldShowShippingOptions?: boolean;
    shouldDisableSubmit: boolean;
    isLoading: boolean;
    customerMessage: string;
    onSubmit: any;
    handleSubmit?: any;
    onOrderCommentChange?(value: string): void;
    readonly orderCommentDraft?: string;
    readonly orderCommentErrorLimit?: number;
}

class ShippingFormFooter extends PureComponent<ShippingFormFooterProps> {
    componentDidUpdate(previousProps: ShippingFormFooterProps): void {
        const previousSeed = previousProps.orderCommentDraft ??
            stripFFLFromCheckoutNotes(previousProps.customerMessage);
        const nextSeed = this.props.orderCommentDraft ??
            stripFFLFromCheckoutNotes(this.props.customerMessage);

        if (
            previousSeed !== nextSeed &&
            this.props.values.orderComment === previousSeed
        ) {
            this.props.setFieldValue('orderComment', nextSeed, false);
        }
    }

    render(): ReactNode {
        const {
            cartHasChanged,
            shouldShowOrderComments,
            shouldShowShippingOptions = true,
            shouldDisableSubmit,
            isLoading,
            onOrderCommentChange,
            orderCommentErrorLimit,
        } = this.props;

        return <>
            <Fieldset
                id="checkout-shipping-options"
                legend={
                    <>
                        <Legend>
                            <TranslatedString id="shipping.shipping_method_label" />
                        </Legend>

                        { cartHasChanged &&
                            <Alert type={ AlertType.Error }>
                                <strong>
                                    <TranslatedString id="shipping.cart_change_error" />
                                </strong>
                            </Alert> }
                    </>
                }
            >
                <ShippingOptions
                    isMultiShippingMode={ true }
                    isUpdatingAddress={ isLoading }
                    shouldShowShippingOptions={ shouldShowShippingOptions }
                />
            </Fieldset>

            { shouldShowOrderComments &&
                <OrderComments disabled={isLoading} onChange={onOrderCommentChange} /> }

            { orderCommentErrorLimit !== undefined &&
                <Alert type={ AlertType.Error }>
                    <TranslatedString
                        data={ { count: orderCommentErrorLimit } }
                        id={
                            shouldShowOrderComments && orderCommentErrorLimit > 0
                                ? 'shipping.order_comment_too_long_error'
                                : 'shipping.order_comment_too_long_hidden_error'
                        }
                    />
                </Alert> }

            <div className="form-actions">
                <Button
                    disabled={ shouldDisableSubmit }
                    id="checkout-shipping-continue"
                    isLoading={ isLoading }
                    type="submit"
                    variant={ ButtonVariant.Primary }
                    onClick={ (e) => {
                      e.preventDefault();
                      this.props.handleSubmit(e);
                    }}
                >
                    <TranslatedString id="common.continue_action" />
                </Button>
            </div>
        </>;
    }
}

export interface MultiShippingFormValues {
    orderComment: string;
}

export default withLanguage(withFormik<ShippingFormFooterProps & WithLanguageProps, MultiShippingFormValues>({
    handleSubmit: async (values, { props: { onSubmit } }) => {
        await onSubmit(values);
    },
    mapPropsToValues: ({ customerMessage, orderCommentDraft }) => ({
        orderComment: orderCommentDraft ?? stripFFLFromCheckoutNotes(customerMessage),
    }),
    enableReinitialize: false,
})(ShippingFormFooter));
