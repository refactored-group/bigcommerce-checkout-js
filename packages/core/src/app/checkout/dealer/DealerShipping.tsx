// @ts-nocheck
import {
  Address,
  AddressRequestBody,
  Cart,
  CheckoutRequestBody,
  CheckoutStoreSelector,
  CheckoutSelectors,
  Consignment,
  ConsignmentAssignmentRequestBody,
  ConsignmentUpdateRequestBody,
  Country,
  Customer,
  CustomerRequestOptions,
  FormField,
  ShippingInitializeOptions,
  ShippingRequestOptions,
  RequestOptions,
} from '@bigcommerce/checkout-sdk';
import React, { lazy } from 'react';
import { debounce, noop } from 'lodash';

import { withCheckout, CheckoutContextProps } from '../../checkout';
import getShippingMethodId from '../../shipping/getShippingMethodId';
import getShippableItemsCount from '../../shipping/getShippableItemsCount';
import hasUnassignedLineItems from '../../shipping/hasUnassignedLineItems';
import hasSelectedShippingOptions from '../../shipping/hasSelectedShippingOptions';
import updateShippableItems from '../../shipping/updateShippableItems';
import AddressSelect from '../../address/AddressSelect';
import { AddressType, StaticAddress } from '../../address';
import { TranslatedString } from '@bigcommerce/checkout/locale';
import {
  AssignItemFailedError,
  AssignItemInvalidAddressError,
  UnassignItemError,
} from '../../shipping/errors';
import {
  isValidAddress,
  mapAddressFromFormValues,
  AddressFormModal,
  AddressFormValues,
} from '../../address';
import { retry, EMPTY_ARRAY } from '../../common/utility';
import { Form } from '../../ui/form';
import { SingleShippingFormValues } from '../../shipping/SingleShippingForm';

import getShippableLineItems from './getShippableLineItems';

import './DealerShipping.scss';

const Shipping = lazy(() =>
  retry(
    () =>
      import(
        /* webpackChunkName: "shipping" */
        '../../shipping/Shipping'
      ),
  ),
);

const ItemFFL = lazy(() =>
  retry(
    () =>
      import(
        /* webpackChunkName: "shipping" */
        './ItemFFL'
      ),
  ),
);

const ShippingFormFooter = lazy(() =>
  retry(
    () =>
      import(
        /* webpackChunkName: "shippingFormFooter" */
        './ShippingFormFooter'
      ),
  ),
);

const Locator = lazy(() =>
  retry(
    () =>
      import(
        /* webpackChunkName: "locator" */
        './Locator'
      ),
  ),
);

const StatesDropdown = lazy(() =>
  retry(
    () =>
      import(
        /* webpackChunkName: "statesDropdown" */
        './StatesDropdown'
      ),
  ),
);

const CustomShippingForm = lazy(() =>
  retry(
    () =>
      import(
        /* webpackChunkName: "customShippingForm" */
        './CustomShippingForm'
      ),
  ),
);

const ShippingForm = lazy(() =>
  retry(
    () =>
      import(
        /* webpackChunkName: "shippingForm" */
        '../../shipping/ShippingForm'
      ),
  ),
);

export interface MultiShippingFormValues {
  orderComment: string;
}

export interface WithCheckoutShippingProps {
  billingAddress?: Address;
  cart: Cart;
  consignments: Consignment[];
  countries: Country[];
  countriesWithAutocomplete: string[];
  customer: Customer;
  customerMessage: string;
  googleMapsApiKey: string;
  isGuest: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  isShippingStepPending: boolean;
  methodId?: string;
  shippingAddress?: Address;
  shouldShowAddAddressInCheckout: boolean;
  shouldShowMultiShipping: boolean;
  shouldShowOrderComments: boolean;
  assignItem(consignment: ConsignmentAssignmentRequestBody): Promise<CheckoutSelectors>;
  deinitializeShippingMethod(options: ShippingRequestOptions): Promise<CheckoutSelectors>;
  deleteConsignment(consignmentId: string, options?: RequestOptions): Promise<CheckoutSelectors>;
  updateConsignment(
    consignment: ConsignmentUpdateRequestBody,
    options?: RequestOptions,
  ): Promise<CheckoutSelectors>;
  getFields(countryCode?: string): FormField[];
  initializeShippingMethod(options: ShippingInitializeOptions): Promise<CheckoutSelectors>;
  signOut(options?: CustomerRequestOptions): void;
  unassignItem(consignment: ConsignmentAssignmentRequestBody): Promise<CheckoutSelectors>;
  updateBillingAddress(address: Partial<Address>): Promise<CheckoutSelectors>;
  createCustomerAddress(address: AddressRequestBody): Promise<CheckoutSelectors>;
  updateCheckout(payload: CheckoutRequestBody): Promise<CheckoutSelectors>;
  updateShippingAddress(address: Partial<Address>): Promise<CheckoutSelectors>;
}

interface DealerProps {
  cartHasChanged: boolean;
  isMultiShippingMode: boolean;
  navigateNextStep: (isBillingSameAsShipping: boolean) => void;
  onCreateAccount: () => void;
  fflConsignmentItems: Array<{
    itemId: string;
    quantity: number;
  }>;
  ammoConsignmentItems: Array<{
    itemId: string;
    quantity: number;
  }>;
  onReady: () => void;
  onSignIn: () => void;
  onToggleMultiShipping: () => void;
  onUnhandledError: (error: Error) => void;
  isValid?: boolean;
  addresses: Address[];
  defaultCountryCode: string;
  customerMessage: string;
  storeHash: string;
  setFFLtoOrderComments: (value: boolean) => void;
  setWithAmmoSubscription: (value: boolean) => void;
  setSelectedFFL: (fflId: string) => void;
}

interface DealerState {
  selectedDealer: {
    fflID: string;
    countryCode: string;
  } | null;
  showLocator: boolean;
  manualFflInput: boolean;
  isUpdatingShippingData: boolean;
  isLoading: boolean;
  items: Array<{
    id: string;
    quantity: number;
    productId: string;
    name: string;
    imageUrl?: string;
    options?: Array<{
      name: string;
      nameId: string;
      value: string;
    }>;
    key: string;
    consignment?: {
      shippingAddress: Address;
    };
  }>;
  itemAddingAddress:
    | {
        key: string;
        itemId: string;
      }
    | undefined;
  createCustomerAddressError: Error | null;
  isInitializing?: boolean;
  announcement: string;
  bypassAnnouncement: string;
  bypassOption: boolean;
  multiShipment: boolean;
  ammoFFLRequiredStates: string[];
  ammoStateFFLRequired: boolean;
  ammoSelectedState: string;
  customFirstNameInput: string;
  customFirstNameInputError: boolean;
  customLastNameInput: string;
  customLastNameInputError: boolean;
  customCompanyInput: string;
  customPhoneInput: string;
  customAddressLine1Input: string;
  customAddressLine1InputError: boolean;
  customAddressLine2Input: string;
  customCityInput: string;
  customCityInputError: boolean;
  customPostCodeInput: string;
  customPostCodeInputError: boolean;
  withAmmoSubscription: boolean;
  bypassFFL: boolean;
}

class DealerShipping extends React.PureComponent<
  DealerProps & WithCheckoutShippingProps,
  DealerState
> {
  static getDerivedStateFromProps(
    {
      cart,
      consignments,
      fflConsignmentItems,
      ammoConsignmentItems,
    }: DealerProps & WithCheckoutShippingProps,
    state: DealerState,
  ) {
    if (!state || !state.items || getShippableItemsCount(cart) !== state.items.length) {
      return {
        ...state,
        items: getShippableLineItems(cart, consignments),
      };
    }

    return null;
  }

  private debouncedAssignShippingAddress: () => Promise<void>;

  constructor(props: DealerProps & WithCheckoutShippingProps) {
    super(props);

    this.state = {
      ammoFFLRequiredStates: [],
      ammoSelectedState: '',
      ammoStateFFLRequired: null,
      announcement: '',
      bypassAnnouncement: 'Bypass FFL checks. I will send my FFL documents.',
      bypassOption: false,
      bypassFFL: false,
      createCustomerAddressError: null,
      customAddressLine1Input: '',
      customAddressLine1InputError: false,
      customAddressLine2Input: '',
      customCityInput: '',
      customCityInputError: false,
      customCompanyInput: '',
      customFirstNameInput: '',
      customFirstNameInputError: false,
      customLastNameInput: '',
      customLastNameInputError: false,
      customPhoneInput: '',
      customPostCodeInput: '',
      customPostCodeInputError: false,
      isLoading: true,
      isUpdatingShippingData: false,
      itemAddingAddress: null,
      items: [],
      manualFflInput: false,
      multiShipment: false,
      selectedDealer: null,
      showLocator: false,
      withAmmoSubscription: false,
    };

    this.debouncedAssignShippingAddress = debounce(async () => {
      const { assignItem } = this.props;
      const address = {
        firstName: this.state.customFirstNameInput,
        lastName: this.state.customLastNameInput,
        phone: this.state.customPhoneInput,
        company: this.state.customCompanyInput,
        address1: this.state.customAddressLine1Input,
        address2: this.state.customAddressLine2Input,
        city: this.state.customCityInput,
        stateOrProvinceCode: this.state.ammoSelectedState,
        shouldSaveAddress: false,
        postalCode: this.state.customPostCodeInput,
        localizedCountry: 'United States',
        countryCode: 'US',
      };

      // When bypassing FFL, assign address to all items
      const lineItems = this.state.bypassFFL
        ? this.props.cart.lineItems.physicalItems.map((item) => ({
            itemId: item.id,
            quantity: item.quantity,
          }))
        : this.props.cart.lineItems.physicalItems
            .filter((item) => !this.getFFLItems().some((fflItem) => fflItem.itemId === item.id))
            .map((item) => ({
              itemId: item.id,
              quantity: item.quantity,
            }));

      await assignItem({
        address,
        lineItems,
      });
    }, 500);
  }

  async componentDidMount(): Promise<void> {
    const { onReady = noop, onUnhandledError, storeHash } = this.props;

    try {
      // Fetch FFL store data
      const response = await fetch(`https://${process.env.HOST}/store-front/api/${storeHash}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const merchantStates = data.merchant.merchant_states.filter(
        (merchantState) => merchantState.enabled,
      );

      this.props.setFFLtoOrderComments(data.ffl_to_order_comments);
      this.props.setWithAmmoSubscription(data.with_ammo_subscription);

      this.setState({
        announcement: data.announcement,
        bypassAnnouncement:
          data.bypass_announcement || 'Bypass FFL checks. I will send my FFL documents.',
        bypassOption: data.bypass_option,
        multiShipment: data.multi_shipment,
        isLoading: false,
        ammoFFLRequiredStates: merchantStates.map((ms) => ms.state.code),
        withAmmoSubscription: data.with_ammo_subscription,
      });

      onReady();
    } catch (error) {
      console.error('Error fetching FFL store data:', error);
      this.setState({ isLoading: false });
      onUnhandledError(error);
    }
  }

  handleManualFFLInput: () => void = () => {
    const { manualFflInput } = this.state;

    this.setState({
      manualFflInput: !manualFflInput,
      selectedDealer: null,
    });
  };

  toggleMapSelector: () => void = () => {
    this.setState({
      manualFflInput: false,
      showLocator: true,
    });
  };

  selectDealer = async (dealer: {
    fflID: string;
    countryCode: string;
    [key: string]: any; // Allow additional properties since dealer object may have more fields
  }): Promise<void> => {
    this.setState({
      selectedDealer: dealer,
      showLocator: false,
    });

    const { assignItem, getFields, onUnhandledError } = this.props;

    const allCartItems = this.state.items.map((item) => {
      let container = {};
      container.itemId = item.id;
      container.quantity = item.quantity;
      return container;
    });

    const fflItems = this.getFFLItems();
    const consignment = {
      lineItems: this.state.multiShipment ? allCartItems : fflItems,
      shippingAddress: dealer,
    };

    if (!isValidAddress(dealer, getFields(dealer.countryCode))) {
      return onUnhandledError(new AssignItemInvalidAddressError());
    }

    try {
      this.props.setSelectedFFL(dealer.fflID);
      await assignItem(consignment);
    } catch (e) {
      onUnhandledError(new AssignItemFailedError(e as any));
    }
  };

  handleCancel: () => void = () => {
    this.setState({
      showLocator: false,
    });
  };

  onChangeCustomShippingField = (value: string, stateKey: keyof DealerState): void => {
    const fieldIdToStateMap = {
      firstNameInput: 'customFirstNameInput',
      lastNameInput: 'customLastNameInput',
      companyInput: 'customCompanyInput',
      phoneInput: 'customPhoneInput',
      addressLine1Input: 'customAddressLine1Input',
      addressLine2Input: 'customAddressLine2Input',
      cityInput: 'customCityInput',
      postCodeInput: 'customPostCodeInput',
    };

    const stateKey = fieldIdToStateMap[fieldId];
    const stateKeyError = `${stateKey}Error`;

    this.setState(
      {
        [stateKey]: value,
        [stateKeyError]: false,
      },
      () => {
        if (
          this.state.customFirstNameInput != '' &&
          this.state.customLastNameInput != '' &&
          this.state.customAddressLine1Input != '' &&
          this.state.customCityInput != '' &&
          this.state.customPostCodeInput != ''
        ) {
          this.debouncedAssignShippingAddress();
        }
      },
    );
  };

  validateSelectedState = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    const { deleteConsignment, onUnhandledError } = this.props;
    const fflRequired = this.state.ammoFFLRequiredStates.includes(event.target.value);

    // deletes consignments, this will unassign previously selected addresses for each line item
    if (this.props.consignments.length > 0) {
      let lineItems = this.props.consignments.map((item) => {
        let container = {};
        container.shippingAddress = item.address;
        container.itemId = item.id;
        return container;
      });
      lineItems.forEach((item) => {
        try {
          deleteConsignment(item.itemId);
        } catch (e) {
          onUnhandledError(new UnassignItemError(e as any));
        }
      });
    }

    if (event.target.value == '') {
      this.setState({ ammoStateFFLRequired: null, ammoSelectedState: event.target.value });
    } else {
      this.setState({ ammoStateFFLRequired: fflRequired, ammoSelectedState: event.target.value });
    }
  };

  private shouldDisableSubmit: () => boolean = () => {
    const { isLoading, consignments, isValid } = this.props;

    const { isUpdatingShippingData, bypassFFL } = this.state;

    if (!isValid) {
      return false;
    }

    // If bypassing FFL, only check if shipping address is valid
    if (bypassFFL) {
      return isLoading || isUpdatingShippingData || !this.validateCustomShippingFields();
    }

    return isLoading || isUpdatingShippingData || !hasSelectedShippingOptions(consignments);
  };

  // group ffl items with ammo items only if the customer has ammo subscription
  private getFFLItems() {
    const { ammoConsignmentItems, fflConsignmentItems } = this.props;
    const { withAmmoSubscription } = this.state;

    return withAmmoSubscription
      ? fflConsignmentItems.concat(ammoConsignmentItems)
      : fflConsignmentItems;
  }

  render() {
    const {
      ammoConsignmentItems,
      cart,
      cartHasChanged,
      consignments,
      countries,
      countriesWithAutocomplete,
      customer,
      customerMessage,
      defaultCountryCode,
      getFields,
      googleMapsApiKey,
      fflConsignmentItems,
      isLoading,
      shouldShowOrderComments,
    } = this.props;

    const items = getShippableLineItems(cart, consignments);
    const fflItems = this.getFFLItems();
    const itemsWithoutFFL = items.filter(
      (item) => !fflItems.some((fflItem: any) => item.id === fflItem.itemId),
    );

    const groupedItemsWithoutFFL = _.groupBy(itemsWithoutFFL, (item) => item.productId);

    const groupedItemsWithoutFFLEntries = Object.entries(groupedItemsWithoutFFL);

    const itemsWithFFL = items.filter((item) =>
      fflItems.some((fflItem: any) => item.id === fflItem.itemId),
    );

    const groupeditemsWithFFL = _.groupBy(itemsWithFFL, (item) => item.productId);

    const groupedItemsWithFFLEntries = Object.entries(groupeditemsWithFFL);

    const fflConsignment = consignments.filter((item) =>
      fflItems.some((fflItem: any) => item.lineItemIds.includes(fflItem.itemId)),
    )[0];

    const { itemAddingAddress } = this.state;

    return (
      <section className="ffl-section checkout-form">
        {this.state.bypassOption &&
          (fflConsignmentItems.length > 0 ||
            (ammoConsignmentItems.length > 0 && this.state.withAmmoSubscription)) && (
            <div className="bypass-ffl-option">
              <label
                className="form-label"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <input
                  type="checkbox"
                  style={{ margin: 0 }}
                  checked={this.state.bypassFFL}
                  onChange={() => this.setState({ bypassFFL: !this.state.bypassFFL })}
                />
                <span>{this.state.bypassAnnouncement}</span>
              </label>
            </div>
          )}

        {!this.state.bypassFFL &&
          fflConsignmentItems.length == 0 &&
          ammoConsignmentItems.length > 0 &&
          this.state.withAmmoSubscription && (
            <StatesDropdown validateSelectedState={this.validateSelectedState} />
          )}

        {!this.state.bypassFFL &&
          (this.state.ammoStateFFLRequired || fflConsignmentItems.length > 0) && (
            <div>
              {this.state.manualFflInput === false &&
                (this.state.selectedDealer == null || !fflConsignment) && (
                  <div className="alertBox alertBox--error alertBox--font-color-black">
                    <div className="alertBox-column alertBox-icon">
                      <div className="icon"></div>
                    </div>
                    {groupedItemsWithFFLEntries.map(([key, items]) => (
                      <li key={items[0].key}>
                        <ItemFFL item={items[0]} quantity={items.length} />
                      </li>
                    ))}
                    <div className="alertBox-column alertBox-message">
                      <p>
                        You have purchased an item that must be shipped to a Federal Firearms
                        License holder (FFL).
                      </p>
                      <p>
                        Before making a selection, contact the FFL and verify that they can accept
                        your shipment prior to completing your purchase.
                      </p>
                    </div>
                  </div>
                )}

              {this.state.selectedDealer != null && fflConsignment && (
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

              <div className="form-action">
                <button
                  type="button"
                  className="button button--primary optimizedCheckout-buttonPrimary"
                  onClick={this.toggleMapSelector}
                >
                  {this.state.selectedDealer != null && fflConsignment && (
                    <TranslatedString id="shipping.ffl_change_dealer" />
                  )}
                  {(this.state.selectedDealer == null || !fflConsignment) && (
                    <TranslatedString id="shipping.ffl_select_dealer" />
                  )}
                </button>
              </div>

              {!this.state.isLoading && (
                <div>
                  {
                    <AddressFormModal
                      countries={countries}
                      countriesWithAutocomplete={countriesWithAutocomplete}
                      defaultCountryCode={defaultCountryCode}
                      getFields={getFields}
                      googleMapsApiKey={googleMapsApiKey}
                      isLoading={isLoading}
                      isOpen={!!itemAddingAddress}
                      onRequestClose={this.handleCloseAddAddressForm}
                      onSaveAddress={this.handleSaveAddress}
                    />
                  }

                  <Form>
                    <ul className="consignmentList">
                      {this.state.multiShipment ? (
                        <div className="multiShip-text">
                          {itemsWithoutFFL.length > 0 &&
                            'Other items in cart will also ship to FFL'}
                          {itemsWithoutFFL.map((item) => (
                            <div className="consignment">
                              <figure className="consignment-product-figure">
                                {item.imageUrl && <img alt={item.name} src={item.imageUrl} />}
                              </figure>
                              <div className="consignment-product-body">
                                <h4 className="optimizedCheckout-contentPrimary">{`${item.quantity} x ${item.name}`}</h4>
                                {(item.options || []).map(({ name: optionName, value, nameId }) => (
                                  <ul
                                    className="product-options optimizedCheckout-contentSecondary"
                                    data-test="consigment-item-product-options"
                                    key={nameId}
                                  >
                                    <li className="product-option">{`${optionName} ${value}`}</li>
                                  </ul>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        groupedItemsWithoutFFLEntries.map(([key, items], index) => (
                          <div>
                            <div className="consignment">
                              <figure className="consignment-product-figure">
                                {items[0].imageUrl && (
                                  <img alt={items[0].imageUrl} src={items[0].imageUrl} />
                                )}
                              </figure>
                              <div className="consignment-product-body">
                                <h5 className="optimizedCheckout-contentPrimary">
                                  {`${items.length} x ${items[0].name}`}
                                </h5>
                              </div>
                            </div>
                            {index + 1 == groupedItemsWithoutFFLEntries.length && (
                              <AddressSelect
                                addresses={customer.addresses}
                                onSelectAddress={this.handleSelectAddress}
                                onUseNewAddress={this.handleUseNewAddress}
                                selectedAddress={
                                  items[0].consignment && items[0].consignment.shippingAddress
                                }
                              />
                            )}
                          </div>
                        ))
                      )}
                    </ul>
                  </Form>
                </div>
              )}
            </div>
          )}

        {/* Show custom shipping form when bypassing FFL or when ammoStateFFLRequired is false */}
        {(this.state.bypassFFL || this.state.ammoStateFFLRequired === false) && (
          <div className="custom-shipping-section">
            {this.state.bypassFFL && (
              <div className="alertBox alertBox--info">
                <div className="alertBox-column alertBox-message">
                  <p>
                    You have chosen to bypass FFL product checks. Please enter your shipping address
                    below. All items will be shipped to this address.
                  </p>
                </div>
              </div>
            )}
            {this.state.bypassFFL ? (
              <ShippingForm
                {...this.props}
                addresses={customer.addresses}
                deinitialize={this.props.deinitializeShippingMethod}
                initialize={this.props.initializeShippingMethod}
                isBillingSameAsShipping={true}
                isFloatingLabelEnabled={false}
                isGuest={this.props.isGuest}
                isInitialValueLoaded={true}
                isMultiShippingMode={false}
                onMultiShippingSubmit={this.handleMultiShippingSubmit}
                onSingleShippingSubmit={this.handleSingleShippingSubmit}
                onUseNewAddress={this.handleUseNewAddress}
                shouldShowSaveAddress={!this.props.isGuest}
                updateAddress={this.props.updateShippingAddress}
              />
            ) : (
              <CustomShippingForm
                onChangeCustomShippingField={this.onChangeCustomShippingField}
                customShippingFirstNameError={this.state.customShippingFirstNameError}
                customShippingLastNameError={this.state.customShippingLastNameError}
                customShippingAddressError={this.state.customShippingAddressError}
                customShippingCityError={this.state.customShippingCityError}
                customShippingPostalError={this.state.customShippingPostalError}
                customShippingFirstName={this.state.customShippingFirstName}
                customShippingLastName={this.state.customShippingLastName}
                customShippingAddress={this.state.customShippingAddress}
                customShippingApartment={this.state.customShippingApartment}
                customShippingCity={this.state.customShippingCity}
                customShippingCompany={this.state.customShippingCompany}
                customShippingPhone={this.state.customShippingPhone}
                customShippingPostal={this.state.customShippingPostal}
              />
            )}
          </div>
        )}

        {this.state.ammoStateFFLRequired == false && (
          <CustomShippingForm
            onChangeCustomShippingField={this.onChangeCustomShippingField}
            firstNameInput={this.state.customFirstNameInput}
            firstNameInputError={this.state.customFirstNameInputError}
            lastNameInput={this.state.customLastNameInput}
            lastNameInputError={this.state.customLastNameInputError}
            companyInput={this.state.customCompanyInput}
            phoneInput={this.state.customPhoneInput}
            addressLine1Input={this.state.customAddressLine1Input}
            addressLine1InputError={this.state.customAddressLine1InputError}
            addressLine2Input={this.state.customAddressLine2Input}
            cityInput={this.state.customCityInput}
            cityInputError={this.state.customCityInputError}
            postCodeInput={this.state.customPostCodeInput}
            postCodeInputError={this.state.customPostCodeInputError}
          />
        )}

        {/* Only show ShippingFormFooter when not bypassing FFL */}
        {!this.state.bypassFFL && (
          <ShippingFormFooter
            cartHasChanged={cartHasChanged}
            isLoading={isLoading}
            customerMessage={customerMessage}
            onSubmit={this.handleMultiShippingSubmit}
            shouldDisableSubmit={this.shouldDisableSubmit()}
            shouldShowOrderComments={shouldShowOrderComments}
            shouldShowShippingOptions={!hasUnassignedLineItems(consignments, cart.lineItems)}
          />
        )}

        {this.state.manualFflInput === true && (
          <Shipping
            cartHasChanged={this.props.cartHasChanged}
            isMultiShippingMode={this.props.isMultiShippingMode}
            navigateNextStep={this.props.navigateNextStep}
            onCreateAccount={this.props.onCreateAccount}
            onReady={this.props.onReady}
            onSignIn={this.props.onSignIn}
            onToggleMultiShipping={this.props.onToggleMultiShipping}
            onUnhandledError={this.props.onUnhandledError}
          />
        )}

        {this.props.storeHash != '' && (
          <Locator
            storeHash={this.props.storeHash}
            showLocator={this.state.showLocator}
            handleCancel={this.handleCancel}
            selectDealer={this.selectDealer}
            announcement={this.state.announcement}
          />
        )}
      </section>
    );
  }

  private handleCloseAddAddressForm: () => void = () => {
    this.setState({
      itemAddingAddress: undefined,
    });
  };

  private handleUseNewAddress: (address: Address, itemId: string, itemKey: string) => void = (
    address,
    itemId,
    itemKey,
  ) => {
    this.setState({
      itemAddingAddress: {
        key: itemKey,
        itemId,
      },
    });
  };

  private onUseNewAddress: (address: Address, itemId: string) => void = async (address, itemId) => {
    const { unassignItem, onUnhandledError } = this.props;

    try {
      await unassignItem({
        shippingAddress: address,
        lineItems: [
          {
            quantity: 1,
            itemId,
          },
        ],
      });

      location.href = '/account.php?action=add_shipping_address&from=checkout';
    } catch (e) {
      onUnhandledError(new UnassignItemError(e as any));
    }
  };

  private handleSelectAddress: (
    address: Address,
    itemId: string,
    itemKey: string,
  ) => Promise<void> = async (address, itemId, itemKey) => {
    const { assignItem, onUnhandledError, getFields } = this.props;
    const fflItems = this.getFFLItems();
    const fflItemsIds = fflItems.map((item) => {
      return item.itemId;
    });
    const cartLineItems = this.props.cart.lineItems.physicalItems;

    // do not include line items with parentID, BigCommerce will automatically assign the address selected from the parent item
    const nonFFLItems = cartLineItems.filter(
      (item) => !fflItemsIds.includes(item.id) && item.parentId == null,
    );

    const nonFFLItemsMap = nonFFLItems.map((item) => {
      let container = {};
      container.itemId = item.id;
      container.quantity = item.quantity;
      return container;
    });

    if (!isValidAddress(address, getFields(address.countryCode))) {
      return onUnhandledError(new AssignItemInvalidAddressError());
    }

    try {
      const { data } = await assignItem({
        address,
        lineItems: nonFFLItemsMap,
      });
    } catch (error) {
      if (error instanceof Error) {
        onUnhandledError(new AssignItemFailedError(error));
      }
    }
  };

  private handleSaveAddress: (address: AddressFormValues) => void = async (address) => {
    const { createCustomerAddress } = this.props;
    const { itemAddingAddress } = this.state;

    if (!itemAddingAddress) {
      return;
    }

    const shippingAddress = mapAddressFromFormValues(address);

    await this.handleSelectAddress(
      shippingAddress,
      itemAddingAddress.itemId,
      itemAddingAddress.key,
    );

    try {
      await createCustomerAddress(shippingAddress);
    } catch (e) {
      this.setState({ createCustomerAddressError: e });
    }

    this.setState({
      itemAddingAddress: undefined,
    });
  };

  private handleMultiShippingSubmit = async (values: MultiShippingFormValues): Promise<void> => {
    const { navigateNextStep, onUnhandledError } = this.props;

    try {
      if (customerMessage !== orderComment) {
        await updateCheckout({ customerMessage: orderComment });
      }

      navigateNextStep(false);
    } catch (error) {
      onUnhandledError(error);
    }
  };

  private validateCustomShippingFields = () => {
    let isValid = true;
    const fields = [
      'customFirstNameInput',
      'customLastNameInput',
      'customAddressLine1Input',
      'customCityInput',
      'customPostCodeInput',
    ];

    for (let stateKey of fields) {
      if (this.state[stateKey] == '') {
        this.setState({ [`${stateKey}Error`]: true });
        isValid = false;
      }
    }

    return isValid;
  };

  private syncItems = (key: string, address: Address, data: CheckoutStoreSelector): void => {
    const { items: currentItems } = this.state;

    const items = updateShippableItems(
      currentItems,
      {
        updatedItemIndex: currentItems.findIndex((item) => item.key === key),
        address,
      },
      {
        cart: data.getCart(),
        consignments: data.getConsignments(),
      },
    );

    if (items) {
      this.setState({ items });
    }
  };

  private handleSingleShippingSubmit = async (values: SingleShippingFormValues) => {
    const { navigateNextStep, onUnhandledError, updateShippingAddress } = this.props;

    try {
      await updateShippingAddress(values.shippingAddress);
      navigateNextStep(values.billingSameAsShipping);
    } catch (error) {
      onUnhandledError(error);
    }
  };
}

export function mapToDealerShippingProps({
  checkoutService,
  checkoutState,
}: CheckoutContextProps): WithCheckoutShippingProps | null {
  const {
    data: {
      getCart,
      getCheckout,
      getConfig,
      getCustomer,
      getConsignments,
      getShippingAddress,
      getBillingAddress,
      getShippingAddressFields,
      getShippingCountries,
    },
    statuses: {
      isShippingStepPending,
      isSelectingShippingOption,
      isLoadingShippingOptions,
      isUpdatingConsignment,
      isCreatingConsignments,
      isCreatingCustomerAddress,
      isLoadingShippingCountries,
      isUpdatingBillingAddress,
      isUpdatingCheckout,
    },
  } = checkoutState;

  const checkout = getCheckout();
  const config = getConfig();
  const consignments = getConsignments() || [];
  const customer = getCustomer();
  const cart = getCart();

  if (!checkout || !config || !customer || !cart) {
    return null;
  }

  const {
    checkoutSettings: { enableOrderComments, features, hasMultiShippingEnabled, googleMapsApiKey },
  } = config;

  const methodId = getShippingMethodId(checkout, config);
  const shippableItemsCount = getShippableItemsCount(cart);
  const isLoading =
    isLoadingShippingOptions() ||
    isSelectingShippingOption() ||
    isUpdatingConsignment() ||
    isCreatingConsignments() ||
    isUpdatingBillingAddress() ||
    isUpdatingCheckout() ||
    isCreatingCustomerAddress();
  const shouldShowMultiShipping =
    hasMultiShippingEnabled && !methodId && shippableItemsCount > 1 && shippableItemsCount < 50;
  const countriesWithAutocomplete = ['US', 'CA', 'AU', 'NZ'];

  if (features['CHECKOUT-4183.checkout_google_address_autocomplete_uk']) {
    countriesWithAutocomplete.push('GB');
  }

  const shippingAddress =
    !shouldShowMultiShipping && consignments.length > 1 ? undefined : getShippingAddress();

  return {
    assignItem: checkoutService.assignItemsToAddress,
    billingAddress: getBillingAddress(),
    cart,
    consignments,
    countries: getShippingCountries() || EMPTY_ARRAY,
    countriesWithAutocomplete,
    customer,
    customerMessage: checkout.customerMessage,
    deinitializeShippingMethod: checkoutService.deinitializeShipping,
    deleteConsignment: checkoutService.deleteConsignment,
    updateConsignment: checkoutService.updateConsignment,
    getFields: getShippingAddressFields,
    googleMapsApiKey,
    initializeShippingMethod: checkoutService.initializeShipping,
    isGuest: customer.isGuest,
    isInitializing: isLoadingShippingCountries() || isLoadingShippingOptions(),
    isLoading,
    isShippingStepPending: isShippingStepPending(),
    methodId,
    shippingAddress,
    shouldShowMultiShipping,
    shouldShowAddAddressInCheckout: features['CHECKOUT-4726.add_address_in_multishipping_checkout'],
    shouldShowOrderComments: enableOrderComments,
    signOut: checkoutService.signOutCustomer,
    unassignItem: checkoutService.unassignItemsToAddress,
    updateBillingAddress: checkoutService.updateBillingAddress,
    createCustomerAddress: checkoutService.createCustomerAddress,
    updateCheckout: checkoutService.updateCheckout,
    updateShippingAddress: checkoutService.updateShippingAddress,
  };
}

export default withCheckout(mapToDealerShippingProps)(DealerShipping);
