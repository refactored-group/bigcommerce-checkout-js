import React, { lazy } from 'react';
import { Consignment } from '@bigcommerce/checkout-sdk';
import { AddressType, StaticAddress } from '../../address';
import { TranslatedString } from '@bigcommerce/checkout/locale';
import { Modal } from '@bigcommerce/checkout/ui';
import { retry } from '../../common/utility';

const ItemFFL = lazy(() =>
  retry(() => import(/* webpackChunkName: "shipping" */ './ItemFFL')),
);

const CustomFormFieldsSection = lazy(() =>
  retry(() => import(/* webpackChunkName: "customFormFieldsSection" */ './CustomFormFieldsSection')),
);

interface FFLConsignmentSectionProps {
  groupedItemsWithFFLEntries: [string, any[]][];
  fflConsignment: Consignment | undefined;
  selectedDealer: any;
  manualFflInput: boolean;
  showLocator: boolean;
  bypassFFL: boolean;
  bypassOption: boolean;
  bypassText: string;
  storeHash: string;
  requiredCustomFields: any[];
  customFormFieldValues: Record<string, string | string[] | number>;
  customFormFieldErrors: Record<string, boolean>;
  onSelectDealer: (dealer: any) => void;
  onToggleMapSelector: () => void;
  onHandleCancel: () => void;
  onBypassFFLToggle: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeCustomFormField: (fieldId: string, value: string | string[] | number) => void;
}

function DealerMessageListener({ selectDealer }) {
  React.useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'dealerUpdate') {
        const dealer = event.data.value;
        selectDealer(dealer);
        console.log('Dealer update received in Shipping step:', dealer);
      }
    }

    window.addEventListener('message', handleMessage);
    console.log('Message listener attached for Shipping step');

    return () => {
      window.removeEventListener('message', handleMessage);
      console.log('Message listener removed (left Shipping step)');
    };
  }, []);

  return null;
}

export default class FFLConsignmentSection extends React.PureComponent<FFLConsignmentSectionProps> {
  render() {
    const {
      groupedItemsWithFFLEntries,
      fflConsignment,
      selectedDealer,
      manualFflInput,
      showLocator,
      bypassFFL,
      bypassOption,
      bypassText,
      storeHash,
      requiredCustomFields,
      customFormFieldValues,
      customFormFieldErrors,
      onSelectDealer,
      onToggleMapSelector,
      onHandleCancel,
      onBypassFFLToggle,
      onChangeCustomFormField,
    } = this.props;

    return (
      <div className="ffl-consignment-area">
        {manualFflInput === false &&
          (!selectedDealer || !fflConsignment) &&
          !bypassFFL && (
            <div className="alertBox alertBox--error alertBox--font-color-black">
              {groupedItemsWithFFLEntries.map(([key, items]) => (
                <li key={items[0].key}>
                  <ItemFFL item={items[0]} quantity={items.length} />
                </li>
              ))}
              <div className="alertBox-column alertBox-message">
                <p>
                  You have purchased an item that must be shipped to a Federal Firearms License
                  holder (FFL).
                </p>
                <p>
                  Before making a selection, contact the FFL and verify that they can accept
                  your shipment prior to completing your purchase.
                </p>
              </div>
            </div>
          )}

        {selectedDealer && fflConsignment && (
          <div className="consignment-product-body alertBox--success shipping">
            {groupedItemsWithFFLEntries.map(([key, items]) => (
              <li key={items[0].key}>
                <ItemFFL item={items[0]} quantity={items.length} />
              </li>
            ))}
            <StaticAddress
              address={fflConsignment.shippingAddress}
              type={AddressType.Shipping}
            />
          </div>
        )}

        {!bypassFFL && (
          <div className="form-action">
            <DealerMessageListener selectDealer={onSelectDealer} />
            <Modal
              additionalBodyClassName="modal-iframe-body"
              additionalHeaderClassName="modal-iframe-header"
              additionalModalClassName="modal-iframe"
              isOpen={showLocator}
              onRequestClose={onHandleCancel}
              shouldShowCloseButton={false}
            >
              <iframe
                src={`https://${process.env.STATIC_HOST}/index.html?store_hash=${storeHash}&platform=BigCommerce&maps_api_key=${process.env.GOOGLE_MAPS_KEY}`}
                width="100%"
                height="100%"
                frameBorder="0"
              ></iframe>
            </Modal>
            <button
              type="button"
              className="button button--primary optimizedCheckout-buttonPrimary"
              onClick={onToggleMapSelector}
            >
              {selectedDealer && fflConsignment ? (
                <TranslatedString id="shipping.ffl_change_dealer" />
              ) : (
                <TranslatedString id="shipping.ffl_select_dealer" />
              )}
            </button>
          </div>
        )}

        {bypassOption && (
          <div
            className="bypass-ffl-toggle"
            style={{ marginBottom: '10px', marginTop: '-10px' }}
          >
            <input
              type="checkbox"
              id="bypassFFL"
              checked={bypassFFL}
              onChange={onBypassFFLToggle}
              disabled={bypassFFL}
              style={{ margin: '0 10px 0 0', verticalAlign: 'middle' }}
            />
            <label
              htmlFor="bypassFFL"
              id="bypassFFL-label"
              style={{ margin: 0, verticalAlign: 'middle' }}
            >
              {bypassText}
            </label>
          </div>
        )}

        {!bypassFFL && (
          <CustomFormFieldsSection
            fields={requiredCustomFields}
            values={customFormFieldValues}
            errors={customFormFieldErrors}
            onChange={onChangeCustomFormField}
          />
        )}
      </div>
    );
  }
}
