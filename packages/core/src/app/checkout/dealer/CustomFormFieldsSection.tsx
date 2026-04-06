// @ts-nocheck
import React from 'react';
import { Formik } from 'formik';
import { FormField } from '@bigcommerce/checkout-sdk';

import { DynamicFormField } from '../../ui/form';
import { Form } from '../../ui/form';

interface CustomFormFieldsSectionProps {
    fields: FormField[];
    values: Record<string, string | string[] | number>;
    errors: Record<string, boolean>;
    onChange(fieldId: string, value: string | string[] | number): void;
}

/**
 * Renders required custom form fields using BigCommerce's native DynamicFormField
 * wrapped in a minimal Formik context. This ensures all field types (text, date,
 * dropdown, checkbox, radio, multiline) render identically to the standard checkout.
 */
export default class CustomFormFieldsSection extends React.PureComponent<CustomFormFieldsSectionProps> {
    render() {
        const { fields, values, onChange } = this.props;

        if (fields.length === 0) {
            return null;
        }

        // Build Formik initialValues from current field values
        // Custom fields are stored under a `customFields` key to match the SDK pattern
        const initialValues = {
            customFields: fields.reduce((acc, field) => {
                acc[field.id] = values[field.id] ?? field.default ?? '';
                return acc;
            }, {} as Record<string, any>),
        };

        return (
            <Formik
                initialValues={initialValues}
                onSubmit={() => {}}
            >
                {({ setFieldValue }) => (
                    <Form>
                        <div className="checkout-address custom-form-fields-section">
                            {fields.map((field) => (
                                <DynamicFormField
                                    key={field.id}
                                    field={field}
                                    parentFieldName="customFields"
                                    onChange={(value) => {
                                        setFieldValue(`customFields.${field.id}`, value);
                                        onChange(field.id, value);
                                    }}
                                />
                            ))}
                        </div>
                    </Form>
                )}
            </Formik>
        );
    }
}
