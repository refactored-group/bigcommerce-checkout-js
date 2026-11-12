import { FieldProps } from 'formik';
import React, { FunctionComponent, useCallback, useMemo } from 'react';

import { TranslatedString } from '@bigcommerce/checkout/locale';

import { Fieldset, FormField, Label, Legend, TextInput } from '../ui/form';

export interface OrderCommentsProps {
    readonly disabled?: boolean;
    onChange?(value: string): void;
}

const OrderComments: FunctionComponent<OrderCommentsProps> = ({ disabled, onChange }) => {
    const renderLabel = useCallback(
        (name) => (
            <Label hidden htmlFor={name}>
                <TranslatedString id="shipping.order_comment_label" />
            </Label>
        ),
        [],
    );

    const renderInput = useCallback(
        ({ field }: FieldProps) => (
            <TextInput
                {...field}
                autoComplete="off"
                disabled={disabled}
                maxLength={2000}
            />
        ),
        [disabled],
    );

    const legend = useMemo(
        () => (
            <Legend>
                <TranslatedString id="shipping.order_comment_label" />
            </Legend>
        ),
        [],
    );

    return (
        <Fieldset legend={legend} testId="checkout-shipping-comments">
            <FormField
                id="orderComment"
                input={renderInput}
                label={renderLabel}
                name="orderComment"
                onChange={onChange}
            />
        </Fieldset>
    );
};

export default OrderComments;
