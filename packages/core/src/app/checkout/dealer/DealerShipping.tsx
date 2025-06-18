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

import getShippableLineItems from './getShippableLineItems';
import CountryDropdown from './CountryDropdown';

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
  cartHasChanged: any;
  isMultiShippingMode: any;
  navigateNextStep: any;
  onCreateAccount: any;
  fflConsignmentItems: any;
  ammoConsignmentItems: any;
  onReady: any;
  onSignIn: any;
  onToggleMultiShipping: any;
  onUnhandledError: any;
  isValid?: any;
  addresses: any;
  defaultCountryCode: string;
  customerMessage: string;
  storeHash: string;
}

interface DealerState {
  selectedDealer: any;
  showLocator: any;
  manualFflInput: any;
  isUpdatingShippingData: boolean;
  isLoading: boolean;
  items: any;
  itemAddingAddress: any;
  createCustomerAddressError: any;
  isInitializing?: boolean;
  announcement: any;
  multiShipment: any;
  ammoFFLRequiredStates: any;
  ammoStateFFLRequired: boolean | null;
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
  bypassOption: boolean;
  bypassText: string;
}

// ----------------------
// Main Component
// ----------------------
class DealerShipping extends React.PureComponent<
  DealerProps & WithCheckoutShippingProps,
  DealerState
> {
  static getDerivedStateFromProps(
    { cart, consignments }: DealerProps & WithCheckoutShippingProps,
    state: DealerState,
  ) {
    // Whenever cart items change, recalculate items
    if (!state || !state.items || getShippableItemsCount(cart) !== state.items.length) {
      return {
        ...state,
        items: getShippableLineItems(cart, consignments),
      };
    }
    return null;
  }

  private debouncedAssignAddress: any;

  constructor(props: any) {
    super(props);

    this.state = {
      ammoFFLRequiredStates: [],
      ammoSelectedState: '',
      ammoStateFFLRequired: null,
      announcement: '',
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
      bypassFFL: false,
      bypassOption: false,
      bypassText: '',
    };

    this.debouncedAssignCustomShippingAddress = debounce(async () => {
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
        countryCode: 'US',
        localizedCountry: 'United States',
      };
      const lineItems = this.props.cart.lineItems.physicalItems.map((item) => ({
        itemId: item.id,
        quantity: item.quantity,
      }));

      await assignItem({
        address,
        lineItems,
      });
    }, 500);

    fetch(`https://${process.env.HOST}/store-front/api/stores/${this.props.storeHash}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.json())
      .then((data) => {
        const merchantStates = data.merchant.merchant_states.filter(
          (merchantState) => merchantState.enabled,
        );

        this.props.setFFLtoOrderComments(data.ffl_to_order_comments);
        this.props.setWithAmmoSubscription(data.with_ammo_subscription);
        this.setState({
          announcement: data.announcement,
          multiShipment: data.multi_shipment,
          isLoading: false,
          ammoFFLRequiredStates: merchantStates.map((ms) => ms.state.code),
          withAmmoSubscription: data.with_ammo_subscription,
          bypassOption: data.bypass_option,
          bypassText: data.bypass_text,
        });
      })
      .catch(console.log);
  }

  async componentDidMount(): Promise<void> {
    const { onReady = noop, onUnhandledError } = this.props;

    try {
      onReady();
    } catch (error) {
      onUnhandledError(error);
    } finally {
      this.setState({ isInitializing: false });
    }
  }

  // ----------------------
  // FFL Logic
  // ----------------------

  private getFFLItems() {
    if (this.state.bypassFFL) {
      return [];
    }

    const { ammoConsignmentItems, fflConsignmentItems } = this.props;
    const { withAmmoSubscription, ammoStateFFLRequired } = this.state;

    // If there are firearms and ammo in the cart with an ammo subscription,
    // mark ammo as FFL required without state checks
    if (withAmmoSubscription && fflConsignmentItems.length > 0 && ammoConsignmentItems.length > 0) {
      return fflConsignmentItems.concat(ammoConsignmentItems);
    }

    // Original logic for other cases
    if (withAmmoSubscription && ammoStateFFLRequired) {
      return fflConsignmentItems.concat(ammoConsignmentItems);
    }
    return fflConsignmentItems;
  }

  /**
   * Returns the consignment that contains any items flagged as FFL.
   */
  private getFFLConsignment(): Consignment | undefined {
    const { consignments } = this.props;
    const fflItems = this.getFFLItems();

    return consignments.find((consignment) =>
      fflItems.some((fflItem) => consignment.lineItemIds.includes(fflItem.itemId)),
    );
  }

  /**
   * Checks if the cart contains any firearm items
   */
  private hasFirearms(): boolean {
    const { fflConsignmentItems } = this.props;
    return fflConsignmentItems.length > 0;
  }

  /**
   * Checks if the cart contains any ammunition items
   */
  private hasAmmunition(): boolean {
    const { ammoConsignmentItems } = this.props;
    return ammoConsignmentItems.length > 0;
  }

  /**
   * Checks if the cart contains only ammunition (no firearms)
   */
  private hasOnlyAmmunition(): boolean {
    const { fflConsignmentItems, ammoConsignmentItems } = this.props;
    return fflConsignmentItems.length === 0 && ammoConsignmentItems.length > 0;
  }

  /**
   * Checks if the cart contains any FFL items (firearms, ammunition in FFL-required states,
   * or ammunition when there are firearms in the cart with an ammo subscription)
   */
  private hasAnyFflItems(): boolean {
    const fflItems = this.getFFLItems();
    return fflItems.length > 0;
  }

  // ----------------------
  // Event Handlers
  // ----------------------

  /**
   * When the user toggles the bypass checkbox, we clear all consignments
   * and set the bypassFFL flag to true. Once bypassed, the customer cannot revert.
   */
  private handleBypassFFLToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const { consignments, deleteConsignment, onUnhandledError } = this.props;
      try {
        // First, delete all existing consignments
        await Promise.all(
          consignments.map((consignment) =>
            deleteConsignment(consignment.id).catch((error) =>
              onUnhandledError(new UnassignItemError(error as any)),
            ),
          ),
        );

        // Set state to enable bypass mode and disable multi-shipment
        this.setState({
          bypassFFL: true,
          multiShipment: false,
        });
      } catch (error) {
        onUnhandledError(new UnassignItemError(error as any));
      }
    }
  };

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

  selectDealer: (dealer: any) => void = async (dealer: any) => {
    // API call to track dealer selection for analytics purposes
    fetch(
      `https://${process.env.HOST}/store-front/api/${this.props.storeHash}/dealers/${dealer.dealerId}/select`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    ).catch((error) => {
      console.log('Error logging dealer selection:', error);
    });

    this.setState({
      selectedDealer: dealer,
      showLocator: false,
    });

    const { assignItem, getFields, onUnhandledError } = this.props;

    const allCartItems = this.state.items.map((item: any) => ({
      itemId: item.id,
      quantity: item.quantity,
    }));

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

  onChangeCustomShippingField: () => void = (value, fieldId) => {
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
          this.state.customFirstNameInput &&
          this.state.customLastNameInput &&
          this.state.customAddressLine1Input &&
          this.state.customCityInput &&
          this.state.customPostCodeInput
        ) {
          this.debouncedAssignCustomShippingAddress();
        }
      },
    );
  };

  private validateAndUnassignState = async (stateCode: string): Promise<void> => {
    const {
      deleteConsignment,
      onUnhandledError,
      consignments,
      fflConsignmentItems,
      ammoConsignmentItems,
    } = this.props;
    const { withAmmoSubscription } = this.state;

    // Skip state validation if there are firearms and ammo with an ammo subscription
    const skipStateValidation =
      withAmmoSubscription && fflConsignmentItems.length > 0 && ammoConsignmentItems.length > 0;

    const fflRequired = skipStateValidation || this.state.ammoFFLRequiredStates.includes(stateCode);

    // Check if we're transitioning from FFL required to non-FFL required
    const wasFFLRequired = this.state.ammoStateFFLRequired;

    if (consignments.length > 0) {
      const deletePromises = consignments.map((consignment) =>
        deleteConsignment(consignment.id).catch((error) =>
          onUnhandledError(new UnassignItemError(error as any)),
        ),
      );
      await Promise.all(deletePromises);
    }

    // Wrap setState in a promise so you can await it
    return new Promise((resolve) => {
      const newState: Partial<DealerState> = {
        ammoStateFFLRequired: stateCode === '' ? null : fflRequired,
        ammoSelectedState: stateCode,
      };

      // If transitioning from FFL required to non-FFL required, clear the shipping form
      if (wasFFLRequired === true && !fflRequired) {
        Object.assign(newState, this.getClearedCustomShippingFields());
      }

      this.setState(newState as DealerState, resolve);
    });
  };

  /**
   * Helper function to get an object with all custom shipping fields cleared
   * Can be reused anywhere we need to reset the shipping form
   */
  private getClearedCustomShippingFields = (): Partial<DealerState> => {
    return {
      customFirstNameInput: '',
      customFirstNameInputError: false,
      customLastNameInput: '',
      customLastNameInputError: false,
      customCompanyInput: '',
      customPhoneInput: '',
      customAddressLine1Input: '',
      customAddressLine1InputError: false,
      customAddressLine2Input: '',
      customCityInput: '',
      customCityInputError: false,
      customPostCodeInput: '',
      customPostCodeInputError: false,
    };
  };

  validateSelectedState: (event: any) => void = async (event) => {
    const stateCode = event.target.value;
    await this.validateAndUnassignState(stateCode);
  };

  /**
   * Callback for when a user selects a saved address for a non-FFL item
   * or tries to assign items that might be FFL if in a certain state.
   */
  private handleSelectAddress: (
    address: Address,
    itemId: string,
    itemKey: string,
  ) => Promise<void> = async (address, itemId, itemKey) => {
    const { assignItem, onUnhandledError, getFields, ammoConsignmentItems, customer } = this.props;

    if (!isValidAddress(address, getFields(address.countryCode))) {
      return onUnhandledError(new AssignItemInvalidAddressError());
    }

    const isLoggedIn = !customer.isGuest;
    if (isLoggedIn && ammoConsignmentItems.length > 0 && !this.hasFirearms()) {
      await this.validateAndUnassignState(address.stateOrProvinceCode);
    }

    // Get FFL items AFTER validating the state, as the validation may update ammoStateFFLRequired
    const fflItems = this.getFFLItems();
    const fflItemsIds = fflItems.map((item) => item.itemId);
    const cartLineItems = this.props.cart.lineItems.physicalItems;

    // Define nonFFLItems first
    const nonFFLItems = cartLineItems.filter(
      (item) => !fflItemsIds.includes(item.id) && item.parentId == null,
    );

    // If there are no non-FFL items to assign, return early
    if (nonFFLItems.length === 0) {
      return;
    }

    const nonFFLItemsMap = nonFFLItems.map((item) => ({
      itemId: item.id,
      quantity: item.quantity,
    }));

    try {
      await assignItem({
        address,
        lineItems: nonFFLItemsMap,
      });
    } catch (error) {
      onUnhandledError(new AssignItemFailedError(error as any));
    }
  };

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

    // All shippable items
    const allItems = getShippableLineItems(cart, consignments);

    // Determine which items are FFL (including ammo if ammoStateFFLRequired)
    const fflItems = this.getFFLItems();
    const itemsWithFFL = allItems.filter((item) =>
      fflItems.some((fflItem: any) => item.id === fflItem.itemId),
    );
    const groupedItemsWithFFLEntries = Object.entries(
      _.groupBy(itemsWithFFL, (item) => item.productId),
    );

    // Non-FFL items (including ammo if ammoStateFFLRequired is false)
    const itemsWithoutFFL = allItems.filter(
      (item) => !fflItems.some((fflItem: any) => item.id === fflItem.itemId),
    );
    const groupedItemsWithoutFFLEntries = Object.entries(
      _.groupBy(itemsWithoutFFL, (item) => item.productId),
    );

    // Grab the consignment that contains FFL items (if any)
    const fflConsignment = this.getFFLConsignment();
    const { itemAddingAddress } = this.state;

    return (
      <section className="ffl-section checkout-form">
        {/* If there's no firearm but we have ammo items, show the state dropdown if subscription is active */}
        {this.hasOnlyAmmunition() &&
          this.state.withAmmoSubscription &&
          customer.isGuest &&
          !this.state.bypassFFL && (
            <StatesDropdown validateSelectedState={this.validateSelectedState} />
          )}

        {/* ========== FFL Consignment Area ========== */}
        {this.hasFirearms() || (this.hasOnlyAmmunition() && this.state.ammoStateFFLRequired) ? (
          <div className="ffl-consignment-area">
            {this.state.manualFflInput === false &&
              (!this.state.selectedDealer || !fflConsignment) &&
              !this.state.bypassFFL && (
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

            {this.state.selectedDealer && fflConsignment && (
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

            {/* Only show the Select Dealer button if bypass is not enabled */}
            {!this.state.bypassFFL && (
              <div className="form-action">
                <button
                  type="button"
                  className="button button--primary optimizedCheckout-buttonPrimary"
                  onClick={this.toggleMapSelector}
                >
                  {this.state.selectedDealer && fflConsignment ? (
                    <TranslatedString id="shipping.ffl_change_dealer" />
                  ) : (
                    <TranslatedString id="shipping.ffl_select_dealer" />
                  )}
                </button>
              </div>
            )}

            {/* Bypass checkbox appears below the Select Dealer button if bypassOption is true */}
            {this.state.bypassOption && (
              <div className="bypass-ffl-toggle" style={{ marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  id="bypassFFL"
                  checked={this.state.bypassFFL}
                  onChange={this.handleBypassFFLToggle}
                  disabled={this.state.bypassFFL}
                  style={{ margin: '0 10px 0 0', verticalAlign: 'middle' }}
                />
                <label
                  htmlFor="bypassFFL"
                  id="bypassFFL-label"
                  style={{ margin: 0, verticalAlign: 'middle' }}
                >
                  {this.state.bypassText}
                </label>
              </div>
            )}
          </div>
        ) : null}

        {/* ========== Non-FFL Consignment Area ========== */}
        {groupedItemsWithoutFFLEntries.length > 0 && this.hasAnyFflItems() && (
          <div className="non-ffl-consignment-area">
            {!this.state.isLoading && (
              <>
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
                <Form>
                  <ul className="consignmentList">
                    {this.state.multiShipment ? (
                      <div className="multiShip-text">
                        {itemsWithoutFFL.length > 0 && 'Other items in cart will also ship to FFL'}
                        {itemsWithoutFFL.map((item) => (
                          <div className="consignment" key={item.key}>
                            <figure className="consignment-product-figure">
                              {item.imageUrl && <img alt={item.name} src={item.imageUrl} />}
                            </figure>
                            <div className="consignment-product-body">
                              <h4 className="optimizedCheckout-contentPrimary">
                                {`${item.quantity} x ${item.name}`}
                              </h4>
                              {(item.options || []).map(({ name: optionName, value, nameId }) => (
                                <ul
                                  className="product-options optimizedCheckout-contentSecondary"
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
                        <div key={key}>
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
                          {index + 1 === groupedItemsWithoutFFLEntries.length &&
                            !(!customer.isGuest && this.hasOnlyAmmunition()) && (
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
              </>
            )}
          </div>
        )}

        {/* ========== Address Selector for Logged-in Users with Ammo ========== */}
        {!customer.isGuest && this.hasOnlyAmmunition() && !this.state.bypassFFL && (
          <div className="ammo-address-selector">
            <legend className="optimizedCheckout-headingSecondary" style={{ marginBottom: '5px' }}>
              Select Shipping Address
            </legend>
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
            <AddressSelect
              addresses={customer.addresses}
              onSelectAddress={this.handleSelectAddress}
              onUseNewAddress={this.handleUseNewAddress}
              selectedAddress={
                ammoConsignmentItems.length > 0 &&
                consignments.length > 0 &&
                consignments[0].shippingAddress
              }
            />
          </div>
        )}

        {/* ========== Custom Shipping Form (non-FFL) ========== */}
        {this.state.ammoStateFFLRequired === false &&
          !(!customer.isGuest && this.hasOnlyAmmunition()) && (
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
              countryDropdown={
                <CountryDropdown
                  countries={countries}
                  selectedCountry="US" // Default to US
                />
              }
            />
          )}

        {!this.state.manualFflInput && !this.state.bypassFFL && (
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

        {/* Show Shipping component if either manual FFL input is enabled or bypassFFL is true */}
        {(this.state.manualFflInput || this.state.bypassFFL) && (
          <Shipping
            cartHasChanged={this.props.cartHasChanged}
            isMultiShippingMode={this.state.bypassFFL ? false : this.props.isMultiShippingMode}
            navigateNextStep={this.props.navigateNextStep}
            onCreateAccount={this.props.onCreateAccount}
            onReady={this.props.onReady}
            onSignIn={this.props.onSignIn}
            onToggleMultiShipping={this.props.onToggleMultiShipping}
            onUnhandledError={this.props.onUnhandledError}
          />
        )}

        {this.props.storeHash !== '' && (
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

  private handleMultiShippingSubmit: (values: MultiShippingFormValues) => void = async ({
    orderComment,
  }) => {
    const { customerMessage, updateCheckout, navigateNextStep, onUnhandledError, customer } =
      this.props;

    // Only validate custom shipping fields if:
    // 1. Ammunition doesn't require FFL shipping (ammoStateFFLRequired is false)
    // 2. We're not in the case of a logged-in user with only ammunition in cart
    // (In those cases, we use saved addresses or FFL dealers instead of the custom form)
    if (
      this.state.ammoStateFFLRequired === false &&
      !(customer.isGuest === false && this.hasOnlyAmmunition())
    ) {
      if (!this.validateCustomShippingFields()) {
        return;
      }
    }

    try {
      if (customerMessage !== orderComment) {
        await updateCheckout({ customerMessage: orderComment });
      }

      navigateNextStep(false);
    } catch (error) {
      onUnhandledError(error);
    }
  };

  private validateCustomShippingFields: () => boolean = () => {
    let isValid = true;
    const fields = [
      'customFirstNameInput',
      'customLastNameInput',
      'customAddressLine1Input',
      'customCityInput',
      'customPostCodeInput',
    ];

    for (const stateKey of fields) {
      if (!this.state[stateKey]) {
        this.setState({ [`${stateKey}Error`]: true });
        isValid = false;
      }
    }

    return isValid;
  };

  private syncItems: (key: string, address: Address, data: CheckoutStoreSelector) => void = (
    key,
    address,
    data,
  ) => {
    const { items: currentItems } = this.state;

    const items = updateShippableItems(
      currentItems,
      {
        updatedItemIndex: currentItems.findIndex((item: any) => item.key === key),
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

  private shouldDisableSubmit: () => boolean = () => {
    const { isLoading, consignments, isValid } = this.props;
    const { isUpdatingShippingData } = this.state;

    if (isValid === false) {
      return false;
    }

    return isLoading || isUpdatingShippingData || !hasSelectedShippingOptions(consignments);
  };

  isFFLRequiredState = (stateCode: string): boolean => {
    return this.state.ammoFFLRequiredStates.includes(stateCode);
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
