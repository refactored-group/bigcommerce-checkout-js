import { Formik } from 'formik';
import React, { FunctionComponent } from 'react';

import { TranslatedString } from '@bigcommerce/checkout/locale';

import stripFFLFromCheckoutNotes from '../../order/stripFFLFromCheckoutNotes';
import { OrderComments } from '../../orderComments';
import { Button, ButtonVariant } from '../../ui/button';
import { Form } from '../../ui/form';

import { pickupAddress } from './pickup';
import { PickupState } from './PickupController';

import './PickupShipping.scss';

export const FulfillmentChoice: FunctionComponent<{
  intent: 'shipping' | 'pickup';
  disabled: boolean;
  onChange(intent: 'shipping' | 'pickup'): void;
}> = ({ intent, disabled, onChange }) => (
  <fieldset className="pickup-choice" disabled={disabled}>
    <legend className="form-legend">
      <TranslatedString id="pickup.fulfillment_label" />
    </legend>
    {(['shipping', 'pickup'] as const).map((value) => (
      <label className="pickup-radio" key={value}>
        <input
          checked={intent === value}
          name="fulfillment"
          onChange={() => onChange(value)}
          type="radio"
          value={value}
        />
        <span>
          <TranslatedString id={`pickup.${value}_action`} />
        </span>
      </label>
    ))}
  </fieldset>
);

interface Props {
  pickup: PickupState;
  customerMessage?: string;
  showOrderComments: boolean;
  onConfirm(message: string): Promise<void>;
  onShipping(message: string): Promise<void>;
  onSelect(id: number): void;
  onRetry(): void;
}

const PickupShipping: FunctionComponent<Props> = ({
  pickup,
  customerMessage,
  showOrderComments,
  onConfirm,
  onShipping,
  onSelect,
  onRetry,
}) => (
  <Formik
    enableReinitialize
    initialValues={{ orderComment: stripFFLFromCheckoutNotes(customerMessage) }}
    onSubmit={({ orderComment }) => onConfirm(orderComment)}
  >
    {({ values }) => (
      <Form testId="pickup-shipping-form">
        <FulfillmentChoice
          disabled={pickup.transitioning}
          intent="pickup"
          onChange={(intent) => {
            if (intent === 'shipping') {
              void onShipping(values.orderComment);
            }
          }}
        />
        <p>
          <TranslatedString id="pickup.whole_order_text" />
        </p>
        <div aria-live="polite" role="status">
          {(pickup.status === 'idle' || pickup.status === 'loading') && (
            <p>
              <TranslatedString id="pickup.loading_text" />
            </p>
          )}
          {pickup.message && (
            <p>
              <TranslatedString id={`pickup.${pickup.message}`} />
            </p>
          )}
          {pickup.status === 'ready' && !pickup.choices.length && (
            <p>
              <TranslatedString id="pickup.unavailable_text" />
            </p>
          )}
        </div>
        {pickup.status === 'error' && (
          <Button onClick={onRetry} type="button">
            <TranslatedString id="pickup.retry_action" />
          </Button>
        )}
        <fieldset
          className="pickup-locations"
          disabled={pickup.transitioning || pickup.status !== 'ready'}
        >
          <legend className="form-legend">
            <TranslatedString id="pickup.location_label" />
          </legend>
          {pickup.choices.map((choice) => (
            <div className="pickup-location" key={choice.id}>
              <label className="pickup-radio">
                <input
                  checked={pickup.draftMethodId === choice.id}
                  name="pickupMethod"
                  onChange={() => onSelect(choice.id)}
                  type="radio"
                  value={choice.id}
                />
                <span>
                  <strong>
                    {choice.location.label} — {choice.displayName}
                  </strong>
                  <span className="pickup-detail">{pickupAddress(choice.location)}</span>
                  {choice.collectionTimeDescription && (
                    <span className="pickup-detail">{choice.collectionTimeDescription}</span>
                  )}
                  {choice.collectionInstructions && (
                    <span className="pickup-detail">{choice.collectionInstructions}</span>
                  )}
                </span>
              </label>
              <a
                className="pickup-directions"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  pickupAddress(choice.location),
                )}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <TranslatedString id="pickup.directions_action" />
              </a>
            </div>
          ))}
        </fieldset>
        {showOrderComments && <OrderComments />}
        {!pickup.confirmedSignature && (
          <p>
            <TranslatedString id="pickup.totals_text" />
          </p>
        )}
        <div className="form-actions">
          <Button
            disabled={!pickup.draftMethodId || pickup.status !== 'ready' || pickup.transitioning}
            id="checkout-pickup-continue"
            isLoading={pickup.transitioning}
            type="submit"
            variant={ButtonVariant.Primary}
          >
            <TranslatedString id="common.continue_action" />
          </Button>
        </div>
      </Form>
    )}
  </Formik>
);

export default PickupShipping;
