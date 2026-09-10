import { Formik } from 'formik';
import React, { FunctionComponent } from 'react';

import { TranslatedString } from '@bigcommerce/checkout/locale';

import stripFFLFromCheckoutNotes from '../../order/stripFFLFromCheckoutNotes';
import { OrderComments } from '../../orderComments';
import { Button, ButtonVariant } from '../../ui/button';
import { ChecklistItemInput, Form, Label, Legend, RadioInput, TextInput } from '../../ui/form';

import { pickupAddress } from './pickup';
import { PickupState } from './PickupController';

import './PickupShipping.scss';

export const FulfillmentChoice: FunctionComponent<{
  intent: 'shipping' | 'pickup';
  disabled: boolean;
  onChange(intent: 'shipping' | 'pickup'): void;
}> = ({ intent, disabled, onChange }) => (
  <fieldset className="pickup-choice" disabled={disabled}>
    <Legend>
      <TranslatedString id="pickup.fulfillment_label" />
    </Legend>
    {(['shipping', 'pickup'] as const).map((value) => (
      <div className="form-field pickup-fulfillment-option" key={value}>
        <RadioInput
          checked={intent === value}
          id={`fulfillment-${value}`}
          label={<TranslatedString id={`pickup.${value}_action`} />}
          name="fulfillment"
          onChange={() => onChange(value)}
          value={value}
        />
      </div>
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
  onZipChange(zip: string): void;
  onSearch(): void;
  onRetry(): void;
}

const PickupShipping: FunctionComponent<Props> = ({
  pickup,
  customerMessage,
  showOrderComments,
  onConfirm,
  onShipping,
  onSelect,
  onZipChange,
  onSearch,
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
        <fieldset
          className="pickup-search"
          disabled={pickup.transitioning || pickup.message === 'disabled'}
        >
          <Label htmlFor="pickup-zip">
            <TranslatedString id="pickup.zip_label" />
          </Label>
          <div className="form-prefixPostfix pickup-search-controls">
            <TextInput
              aria-describedby="pickup-search-status"
              aria-invalid={pickup.searchError === 'invalid_zip'}
              autoComplete="off"
              id="pickup-zip"
              inputMode="numeric"
              name="pickupZip"
              onChange={(event) => onZipChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSearch();
                }
              }}
              type="text"
              value={pickup.zip}
            />
            <Button
              className="form-prefixPostfix-button--postfix"
              onClick={onSearch}
              type="button"
              variant={ButtonVariant.Secondary}
            >
              <TranslatedString id="pickup.search_action" />
            </Button>
          </div>
        </fieldset>
        <div aria-live="polite" id="pickup-search-status" role="status">
          {pickup.status === 'loading' && (
            <p>
              <TranslatedString id="pickup.loading_text" />
            </p>
          )}
          {pickup.message && (
            <p>
              <TranslatedString id={`pickup.${pickup.message}`} />
            </p>
          )}
          {pickup.searchError && (
            <p>
              <TranslatedString id={`pickup.${pickup.searchError}`} />
            </p>
          )}
          {pickup.status === 'ready' &&
            pickup.searchedZip &&
            !pickup.choices.length &&
            pickup.message !== 'disabled' && (
              <p>
                <TranslatedString id="pickup.unavailable_text" />
              </p>
            )}
        </div>
        {pickup.status === 'error' && pickup.searchError !== 'invalid_zip' && (
          <Button
            disabled={pickup.transitioning}
            onClick={onRetry}
            type="button"
            variant={ButtonVariant.Secondary}
          >
            <TranslatedString id="pickup.retry_action" />
          </Button>
        )}
        {!!pickup.choices.length && (
          <fieldset
            className="pickup-locations"
            disabled={pickup.transitioning || pickup.status !== 'ready'}
          >
            <Legend>
              <TranslatedString id="pickup.location_label" />
            </Legend>
            <p className="pickup-location-help optimizedCheckout-contentSecondary">
              <TranslatedString id="pickup.whole_order_text" />
            </p>
            <ul className="pickup-location-list">
              {pickup.choices.map((choice) => (
                <li
                  key={choice.id}
                  className="form-checklist optimizedCheckout-form-checklist pickup-location-card"
                >
                  <div
                    className={`form-checklist-item optimizedCheckout-form-checklist-item pickup-location-option${
                      pickup.draftMethodId === choice.id
                        ? ' form-checklist-item--selected optimizedCheckout-form-checklist-item--selected'
                        : ''
                    }`}
                  >
                    <ChecklistItemInput
                      id={`pickup-method-${choice.id}`}
                      isSelected={pickup.draftMethodId === choice.id}
                      name="pickupMethod"
                      onChange={() => onSelect(choice.id)}
                      value={choice.id}
                    >
                      <span className="pickup-location-heading">
                        <span className="pickup-location-name">
                          <strong>{choice.location.label}</strong>
                          {choice.location.label.trim().toLowerCase() !==
                            choice.displayName.trim().toLowerCase() && (
                            <span className="pickup-method-name"> — {choice.displayName}</span>
                          )}
                        </span>
                        {choice.distanceMiles !== undefined && (
                          <span className="pickup-distance optimizedCheckout-contentSecondary">
                            <TranslatedString
                              id="pickup.distance_text"
                              data={{ distance: choice.distanceMiles.toFixed(1) }}
                            />
                          </span>
                        )}
                      </span>
                      <span className="pickup-address">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                            pickupAddress(choice.location),
                          )}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {[
                            choice.location.address.address1,
                            choice.location.address.address2,
                            choice.location.address.city,
                            [
                              choice.location.address.stateOrProvince,
                              choice.location.address.postalCode,
                            ]
                              .filter(Boolean)
                              .join(' '),
                            choice.location.address.countryCode !== 'US' &&
                              choice.location.address.countryCode,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </a>
                      </span>
                      {choice.collectionTimeDescription && (
                        <span className="pickup-collection-time optimizedCheckout-contentSecondary">
                          {choice.collectionTimeDescription}
                        </span>
                      )}
                      {pickup.draftMethodId === choice.id && choice.collectionInstructions && (
                        <span className="pickup-instructions">{choice.collectionInstructions}</span>
                      )}
                    </ChecklistItemInput>
                  </div>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
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
