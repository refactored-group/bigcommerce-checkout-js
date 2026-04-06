import { FormFieldItem } from '@bigcommerce/checkout-sdk';
import { FieldArray, FieldArrayRenderProps, getIn } from 'formik';
import { difference, kebabCase, noop, pick } from 'lodash';
import React, { ChangeEvent, FunctionComponent, memo, ReactNode, useCallback } from 'react';

import DynamicFormFieldType from './DynamicFormFieldType';
import DynamicInput from './DynamicInput';
import FormFieldContainer from './FormFieldContainer';
import FormFieldError from './FormFieldError';
import MultiCheckboxControl from './MultiCheckboxControl';

export interface CheckboxGroupFormFieldProps {
    id: string;
    label: ReactNode;
    name: string;
    options: FormFieldItem[];
    onChange?(values: string[]): void;
}

type MultiCheckboxFormFieldProps = CheckboxGroupFormFieldProps &
    Pick<FieldArrayRenderProps, 'push' | 'remove' | 'pop' | 'form'>;

const MultiCheckboxFormField: FunctionComponent<MultiCheckboxFormFieldProps> = ({
    form: { values, errors },
    id,
    label,
    name,
    onChange = noop,
    options,
    push,
    remove,
}) => {
    const handleSelectAll = useCallback(() => {
        const checkedValues: string[] = getIn(values, name) || [];
        const allOptionValues = options.map(({ value }) => value);
        const missing = difference(allOptionValues, checkedValues);

        missing.forEach((val) => push(val));

        onChange([...checkedValues, ...missing]);
    }, [name, onChange, options, push, values]);

    const handleSelectNone = useCallback(() => {
        const checkedValues: string[] = getIn(values, name) || [];

        checkedValues.forEach(() => remove(0));

        onChange([]);
    }, [name, onChange, remove, values]);

    const handleInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const checkedValues: string[] = getIn(values, name) || [];
            const { value, checked } = event.target;

            if (checked) {
                push(value);
            } else {
                remove(checkedValues.indexOf(value));
            }

            // Compute the new values directly instead of reading stale Formik state,
            // since push/remove haven't updated the values object yet in this render cycle.
            const newValues = checked
                ? [...checkedValues, value]
                : checkedValues.filter((v) => v !== value);

            onChange(newValues);
        },
        [name, onChange, push, remove, values],
    );

    return (
        <FormFieldContainer hasError={getIn(errors, name) && getIn(errors, name).length}>
            {label}

            {options.length > 1 && (
                <MultiCheckboxControl
                    onSelectedAll={handleSelectAll}
                    onSelectedNone={handleSelectNone}
                    testId={id}
                />
            )}

            <DynamicInput
                fieldType={DynamicFormFieldType.checkbox}
                id={id}
                name={name}
                onChange={handleInputChange}
                options={options}
                value={getIn(values, name) || []}
            />

            <FormFieldError
                errorId={`${id ?? name}-field-error-message`}
                name={name}
                testId={`${kebabCase(name)}-field-error-message`}
            />
        </FormFieldContainer>
    );
};

const CheckboxGroupFormField: FunctionComponent<CheckboxGroupFormFieldProps> = ({
    id,
    label,
    name,
    onChange,
    options,
}) => {
    const renderField = useCallback(
        (renderProps: FieldArrayRenderProps) => (
            <MultiCheckboxFormField
                id={id}
                label={label}
                name={name}
                onChange={onChange}
                options={options}
                {...pick(renderProps, ['form', 'pop', 'push', 'remove'])}
            />
        ),
        [id, label, name, onChange, options],
    );

    return <FieldArray name={name} render={renderField} />;
};

export default memo(CheckboxGroupFormField);
