// @ts-nocheck
import {
  Address,
  AddressRequestBody,
  Cart,
  CheckoutRequestBody,
  CheckoutStoreSelector,
  CheckoutSelectors,
  Consignment,
  Country,
  Customer,
  CustomerRequestOptions,
  FormField,
  ShippingInitializeOptions,
  ShippingRequestOptions,
} from '@bigcommerce/checkout-sdk';
import React, { lazy, useEffect } from 'react';
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
import { Button, ButtonSize, Modal, ModalHeader } from '@bigcommerce/checkout/ui';

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
import CustomerNameFields from './CustomerNameFields';
import { CheckoutHandoffIntent } from './checkoutHandoff';
import {
  FflConsignmentCoordinator,
  FflCoordinatorResult,
  isSameConsignmentDestination,
} from './fflConsignmentCoordinator';
import {
  AmmoRoutingDecision,
  ConfirmedAmmoRoutingSession,
  canCommitDealerConsignment,
  isAmmunitionOnlyCart,
  resolveConfirmedAmmoRoutingSession,
  resolveAmmoRouting,
  resolveFflRecipientName,
  shouldDisableFflShippingSubmit,
  shouldShowAmmoAddressSelector,
  shouldShowCustomerRecipientNameFields,
} from './utils';

import './DealerShipping.scss';

const SDK_FIELD_TO_STATE_KEY: Record<string, string> = {
  firstName: 'customFirstNameInput',
  lastName: 'customLastNameInput',
  company: 'customCompanyInput',
  phone: 'customPhoneInput',
  address1: 'customAddressLine1Input',
  address2: 'customAddressLine2Input',
  city: 'customCityInput',
  postalCode: 'customPostCodeInput',
};

const getCustomerIdentityKey = (customer: Customer): string =>
  `${customer.isGuest ? 'guest' : 'customer'}:${customer.id}`;

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
  deinitializeShippingMethod(options: ShippingRequestOptions): Promise<CheckoutSelectors>;
  getFields(countryCode?: string): FormField[];
  getBillingFields(countryCode?: string): FormField[];
  initializeShippingMethod(options: ShippingInitializeOptions): Promise<CheckoutSelectors>;
  loadShippingAddressFields(): Promise<CheckoutSelectors>;
  loadBillingAddressFields(): Promise<CheckoutSelectors>;
  loadShippingOptions(): Promise<CheckoutSelectors>;
  signOut(options?: CustomerRequestOptions): void;
  updateBillingAddress(address: Partial<Address>): Promise<CheckoutSelectors>;
  createCustomerAddress(address: AddressRequestBody): Promise<CheckoutSelectors>;
  getCheckoutState(): CheckoutSelectors;
  updateCheckout(payload: CheckoutRequestBody): Promise<CheckoutSelectors>;
  updateShippingAddress(address: Partial<Address>): Promise<CheckoutSelectors>;
}

interface DealerProps {
  cartHasChanged: any;
  isMultiShippingMode: any;
  navigateNextStep: any;
  onCreateAccount: any;
  fflConsignmentItems: any;
  stateRestrictedConsignmentItems: any;
  onReady: any;
  onSignIn: any;
  onToggleMultiShipping: any;
  onHandoffError(error: Error): void;
  onUnhandledError: any;
  isValid?: any;
  addresses: any;
  defaultCountryCode: string;
  customerMessage: string;
  storeHash: string;
  customerAddressSelection?: Address;
  confirmedAmmoRoutingSession?: ConfirmedAmmoRoutingSession;
  fflConsignmentCoordinator: FflConsignmentCoordinator;
  clearConfirmedAmmoRoutingSession(): void;
  confirmAmmoRoutingSession(session: ConfirmedAmmoRoutingSession): void;
  setCustomerAddressSelection(address?: Address): void;
}

interface DealerState {
  applyAmmoStateRulesInMixedCarts: boolean;
  ammoRoutingError: boolean;
  requiresAmmoRoutingReconciliation: boolean;
  showAmmoFflNotice: boolean;
  ammoFflNoticeState: string;
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
  ammoStateFFLRequired: boolean | null;
  ammoSelectedState: string;
  customFirstNameInput: string;
  customFirstNameInputError: boolean;
  customLastNameInput: string;
  customLastNameInputError: boolean;
  customCompanyInput: string;
  customCompanyInputError: boolean;
  customPhoneInput: string;
  customPhoneInputError: boolean;
  customAddressLine1Input: string;
  customAddressLine1InputError: boolean;
  customAddressLine2Input: string;
  customAddressLine2InputError: boolean;
  customCityInput: string;
  customCityInputError: boolean;
  customPostCodeInput: string;
  customerAddressSelection?: Address;
  customPostCodeInputError: boolean;
  withAmmoSubscription: boolean;
  bypassFFL: boolean;
  bypassOption: boolean;
  bypassText: string;
  useGenericFflRecipientName: boolean;
}

function DealerMessageListener({ selectDealer }) {
  useEffect(() => {
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

// ----------------------
// Main Component
// ----------------------
export class DealerShipping extends React.PureComponent<
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
  private isUnmounted = false;

  constructor(props: any) {
    super(props);

    // A guest can only inherit names from an address confirmed during this page
    // lifetime. Persisted billing data might belong to the previously signed-in
    // customer and must not prefill the guest shipping flow.
    const currentPageAddress = props.customerAddressSelection;
    const initialFirstName = props.customer?.isGuest
      ? currentPageAddress?.firstName || ''
      : props.billingAddress?.firstName || props.customer?.firstName || '';
    const initialLastName = props.customer?.isGuest
      ? currentPageAddress?.lastName || ''
      : props.billingAddress?.lastName || props.customer?.lastName || '';
    const restoredAmmoState = resolveConfirmedAmmoRoutingSession(
      props.cart.id,
      getCustomerIdentityKey(props.customer),
      props.confirmedAmmoRoutingSession,
    );

    this.state = {
      applyAmmoStateRulesInMixedCarts: false,
      ammoRoutingError: false,
      requiresAmmoRoutingReconciliation: false,
      ammoSelectedState: restoredAmmoState?.stateCode ?? '',
      ammoStateFFLRequired: null,
      ammoFflNoticeState: '',
      announcement: '',
      createCustomerAddressError: null,
      customAddressLine1Input: '',
      customAddressLine1InputError: false,
      customAddressLine2Input: '',
      customAddressLine2InputError: false,
      customCityInput: '',
      customCityInputError: false,
      customCompanyInput: '',
      customCompanyInputError: false,
      customFirstNameInput: initialFirstName,
      customFirstNameInputError: false,
      customLastNameInput: initialLastName,
      customLastNameInputError: false,
      customPhoneInput: '',
      customPhoneInputError: false,
      customPostCodeInput: '',
      customPostCodeInputError: false,
      customerAddressSelection: currentPageAddress,
      isLoading: true,
      isUpdatingShippingData: false,
      itemAddingAddress: null,
      items: [],
      manualFflInput: false,
      multiShipment: false,
      // The parent only retains a dealer for the lifetime of this checkout page.
      // A browser refresh creates a new Checkout with selectedFFL=null, so a
      // persisted BigCommerce consignment can never become the selected dealer.
      selectedDealer: props.selectedFFL || null,
      showAmmoFflNotice: false,
      showLocator: false,
      withAmmoSubscription: false,
      bypassFFL: false,
      bypassOption: false,
      bypassText: '',
      useGenericFflRecipientName: false,
    };

    this.debouncedAssignCustomShippingAddress = debounce(async () => {
      const stateOrProvinceCode = this.state.ammoSelectedState;
      const stateOrProvince =
        this.props.countries
          .find(({ code }) => code === 'US')
          ?.subdivisions.find(({ code }) => code === stateOrProvinceCode)?.name ||
        stateOrProvinceCode;
      const address: AddressRequestBody = {
        firstName: this.state.customFirstNameInput,
        lastName: this.state.customLastNameInput,
        phone: this.state.customPhoneInput,
        company: this.state.customCompanyInput,
        address1: this.state.customAddressLine1Input,
        address2: this.state.customAddressLine2Input,
        city: this.state.customCityInput,
        stateOrProvince,
        stateOrProvinceCode,
        shouldSaveAddress: false,
        postalCode: this.state.customPostCodeInput,
        countryCode: 'US',
        customFields: [],
      };

      await this.assignCustomerItemsToAddress(address, true, true);
    }, 500);

    // Re-fired by onChangeCustomShippingField when the customer types into the
    // top-of-page name inputs AFTER they've already picked a dealer. The 500ms
    // debounce avoids spamming assignItem on every keystroke. Commits silently
    // when names are blank (the dealer stays remembered until names arrive).
    this.debouncedCommitDealerConsignment = debounce(() => {
      this.startDealerConsignmentCommit();
    }, 500);

    fetch(`https://${process.env.HOST}/store-front/api/stores/${this.props.storeHash}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Store settings request failed with status ${res.status}`);
        }

        return res.json();
      })
      .then((data) => {
        if (this.isUnmounted) {
          return;
        }

        const useGenericFflRecipientName = data.use_generic_ffl_recipient_name === true;
        const applyAmmoStateRulesInMixedCarts = data.apply_ammo_state_rules_in_mixed_carts === true;

        this.props.setFFLtoOrderComments(data.ffl_to_order_comments);
        this.props.setWithAmmoSubscription(data.with_ammo_subscription);
        this.setState(
          {
            applyAmmoStateRulesInMixedCarts,
            announcement: data.announcement,
            multiShipment: data.multi_shipment,
            withAmmoSubscription: data.with_ammo_subscription,
            bypassOption: data.bypass_option,
            bypassText: data.bypass_text,
            useGenericFflRecipientName,
          },
          async () => {
            let reconciledInitialState = false;

            if (restoredAmmoState && this.hasAmmunition()) {
              reconciledInitialState = await this.restoreConfirmedAmmoRoutingSession(
                restoredAmmoState,
              );
            }

            if (this.isUnmounted) {
              return;
            }

            this.setState({ isLoading: false }, () => {
              if (
                !reconciledInitialState &&
                useGenericFflRecipientName &&
                this.state.selectedDealer
              ) {
                this.startDealerConsignmentCommit();
              }
            });
          },
        );
      })
      .catch((error) => {
        if (this.isUnmounted) {
          return;
        }

        const settingsError = new Error(
          'Automatic FFL could not load the store shipping settings. Refresh checkout and try again.',
        );
        (settingsError as any).cause = error;
        this.setState({
          ammoRoutingError: true,
          requiresAmmoRoutingReconciliation: true,
        });
        this.props.onUnhandledError(settingsError);
      });
  }

  async componentDidMount(): Promise<void> {
    const {
      loadShippingAddressFields,
      loadBillingAddressFields,
      loadShippingOptions,
      onReady = noop,
      onUnhandledError,
    } = this.props;

    try {
      await Promise.all([
        loadShippingAddressFields(),
        loadShippingOptions(),
        loadBillingAddressFields(),
      ]);

      if (!this.isUnmounted) {
        onReady();
      }
    } catch (error) {
      if (!this.isUnmounted) {
        onUnhandledError(error);
      }
    } finally {
      if (!this.isUnmounted) {
        this.setState({ isInitializing: false });
      }
    }
  }

  componentWillUnmount(): void {
    this.isUnmounted = true;
    this.debouncedAssignCustomShippingAddress.cancel();
    this.debouncedCommitDealerConsignment.cancel();
  }

  // ----------------------
  // FFL Logic
  // ----------------------

  private getFFLItems() {
    return this.getFFLItemsForDecision(this.getAmmoRoutingDecision());
  }

  private getFFLItemsForDecision(decision: AmmoRoutingDecision) {
    if (this.state.bypassFFL) {
      return [];
    }

    const { stateRestrictedConsignmentItems, fflConsignmentItems } = this.props;

    if (decision === 'ffl') {
      return fflConsignmentItems.concat(stateRestrictedConsignmentItems);
    }

    return fflConsignmentItems;
  }

  private getDealerLineItems() {
    return this.getDealerLineItemsForDecision(this.getAmmoRoutingDecision());
  }

  private getDealerLineItemsForDecision(decision: AmmoRoutingDecision) {
    if (!this.state.multiShipment) {
      return this.getFFLItemsForDecision(decision);
    }

    return this.props.cart.lineItems.physicalItems
      .filter((item) => item.parentId == null && !item.addedByPromotion)
      .map((item) => ({
        itemId: item.id,
        quantity: item.quantity,
      }));
  }

  private getAmmoRoutingDecision(stateCode = this.state.ammoSelectedState): AmmoRoutingDecision {
    return resolveAmmoRouting({
      applyAmmoStateRulesInMixedCarts: this.state.applyAmmoStateRulesInMixedCarts,
      fflProducts: this.props.fflProducts,
      hasAmmunition: this.hasAmmunition(),
      hasFirearms: this.hasFirearms(),
      multiShipment: this.state.multiShipment,
      stateCode,
      withAmmoSubscription: this.state.withAmmoSubscription,
    });
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
    const { stateRestrictedConsignmentItems } = this.props;
    return stateRestrictedConsignmentItems.length > 0;
  }

  /**
   * Checks whether the ammo state-selection flow applies. Ordinary products
   * may also be present; firearms may not.
   */
  private hasOnlyAmmunition(): boolean {
    const { fflConsignmentItems, stateRestrictedConsignmentItems } = this.props;
    return fflConsignmentItems.length === 0 && stateRestrictedConsignmentItems.length > 0;
  }

  /**
   * Checks whether every shippable cart item is ammunition.
   */
  private hasAmmunitionOnlyCart(): boolean {
    const { cart, stateRestrictedConsignmentItems } = this.props;
    const cartItemIds = cart.lineItems.physicalItems
      .filter((item) => !item.addedByPromotion)
      .map((item) => item.id as string);
    const ammunitionItemIds = stateRestrictedConsignmentItems.map((item) => item.itemId as string);

    return isAmmunitionOnlyCart(cartItemIds, ammunitionItemIds);
  }

  /**
   * Checks if the cart contains any FFL items (firearms, ammunition in FFL-required states,
   * or ammunition when there are firearms in the cart with an ammo subscription)
   */
  private hasAnyFflItems(): boolean {
    const fflItems = this.getFFLItems();
    return fflItems.length > 0;
  }

  private getCurrentConsignments(checkoutState?: CheckoutSelectors): Consignment[] {
    return (
      checkoutState?.data?.getConsignments?.() ||
      this.props.getCheckoutState()?.data?.getConsignments?.() ||
      this.props.consignments
    );
  }

  private areItemsAssignedToDestination(
    itemIds: string[],
    address: Address,
    checkoutState?: CheckoutSelectors,
  ): boolean {
    const consignments = this.getCurrentConsignments(checkoutState);

    return itemIds.every((itemId) => {
      const owners = consignments.filter((consignment) => consignment.lineItemIds.includes(itemId));

      return (
        owners.length === 1 && isSameConsignmentDestination(owners[0].shippingAddress, address)
      );
    });
  }

  private requiresExplicitDealerSelection(): boolean {
    const { selectedDealer } = this.state;

    if (this.state.bypassFFL || this.state.manualFflInput || !this.hasAnyFflItems()) {
      return false;
    }

    if (!selectedDealer) {
      return true;
    }

    const selectedDealerAddress = this.resolveDealerShippingAddress(selectedDealer).shippingAddress;
    const requiredItemIds = this.getDealerLineItems().map((item) => item.itemId);

    return (
      requiredItemIds.length === 0 ||
      !this.areItemsAssignedToDestination(requiredItemIds, selectedDealerAddress as Address)
    );
  }

  private isAmmunitionAssignedToSelectedDealer(): boolean {
    const { stateRestrictedConsignmentItems } = this.props;
    const { selectedDealer } = this.state;

    if (!selectedDealer || stateRestrictedConsignmentItems.length === 0) {
      return false;
    }

    const dealerAddress = this.resolveDealerShippingAddress(selectedDealer).shippingAddress;
    return this.areItemsAssignedToDestination(
      stateRestrictedConsignmentItems.map(({ itemId }) => itemId),
      dealerAddress as Address,
    );
  }

  private isAmmoStateSelectionPending(): boolean {
    return this.getAmmoRoutingDecision() === 'pending';
  }

  private getCurrentPageCustomerAddressSelection(): Address | undefined {
    return this.state.customerAddressSelection || this.props.customerAddressSelection;
  }

  private setCurrentPageCustomerAddressSelection(address?: Address, persist = false): void {
    this.setState({ customerAddressSelection: address });

    if (persist) {
      this.props.setCustomerAddressSelection?.(address);
    }
  }

  private getExplicitlySelectedCustomerAddress(address?: Address): Address | undefined {
    const currentPageSelection = this.getCurrentPageCustomerAddressSelection();

    if (currentPageSelection) {
      return currentPageSelection;
    }

    // A persisted checkout consignment is not proof that the customer selected
    // it during this page session. Confirmed ammo addresses are restored into
    // current-page state before rendering.
    if (this.props.customer.isGuest || this.hasAmmunition()) {
      return undefined;
    }

    return address;
  }

  /**
   * Finds the consignment that owns every direct-shipping item. This avoids the
   * SDK's generic first-shipping-address selector and cannot confuse the FFL
   * consignment with the address used for regular products.
   */
  private getCustomerItemsConsignment(
    address?: Address,
    checkoutState?: CheckoutSelectors,
  ): Consignment | undefined {
    const customerLineItems = this.getCustomerLineItems();

    if (customerLineItems.length === 0) {
      return undefined;
    }

    return this.getCurrentConsignments(checkoutState).find((candidate) => {
      const destinationAddress = address || candidate.shippingAddress;

      return (
        isSameConsignmentDestination(candidate.shippingAddress, destinationAddress) &&
        this.areItemsAssignedToDestination(
          customerLineItems.map(({ itemId }) => itemId),
          destinationAddress,
          checkoutState,
        )
      );
    });
  }

  private getSelectedCustomerAddress(): Address | undefined {
    const currentPageSelection = this.getCurrentPageCustomerAddressSelection();

    if (currentPageSelection) {
      return currentPageSelection;
    }

    if (this.props.customer.isGuest) {
      return undefined;
    }

    return this.getCustomerItemsConsignment()?.shippingAddress;
  }

  /**
   * Finds the buyer's direct-shipping address without confusing the firearm
   * consignment's dealer address for the destination used by ammo state rules.
   */
  private getCustomerDestinationAddress(): Address | undefined {
    const savedAddress = this.getSelectedCustomerAddress();

    if (savedAddress) {
      return savedAddress;
    }

    if (this.props.customer.isGuest) {
      return undefined;
    }

    if (!this.hasFirearms()) {
      return undefined;
    }

    const firearmItemIds = new Set(this.props.fflConsignmentItems.map((item) => item.itemId));

    return this.props.consignments.find((consignment) =>
      consignment.lineItemIds.every((itemId) => !firearmItemIds.has(itemId)),
    )?.shippingAddress;
  }

  private getCanonicalConfirmedCustomerAddress(
    address: Address,
    checkoutState?: CheckoutSelectors,
  ): Address | undefined {
    return this.getCustomerItemsConsignment(address, checkoutState)?.shippingAddress;
  }

  private getCustomerAddressState(address: Address): Partial<DealerState> {
    return {
      customAddressLine1Input: address.address1 || '',
      customAddressLine2Input: address.address2 || '',
      customCityInput: address.city || '',
      customCompanyInput: address.company || '',
      customFirstNameInput: address.firstName || '',
      customLastNameInput: address.lastName || '',
      customPhoneInput: address.phone || '',
      customPostCodeInput: address.postalCode || '',
      customerAddressSelection: address,
    };
  }

  private applyFulfilledCustomerAddress(
    address: Address,
    decision = this.getAmmoRoutingDecision(),
  ): void {
    if (this.props.customer.isGuest && this.hasOnlyAmmunition() && decision === 'standard') {
      // The guest direct-shipping form is controlled by these local fields. Hydrate
      // it from BigCommerce's canonical address without firing its change handler
      // or starting another assignment.
      this.setState(this.getCustomerAddressState(address) as DealerState);
      return;
    }

    this.setCurrentPageCustomerAddressSelection(address);
  }

  private confirmAmmoRoutingSession(
    stateCode: string,
    customerAddress: Address | undefined,
    checkoutState: CheckoutSelectors,
  ): boolean {
    const normalizedStateCode = stateCode.trim().toUpperCase();
    const decision = this.getAmmoRoutingDecision(normalizedStateCode);

    if (!normalizedStateCode || decision === 'pending') {
      return false;
    }

    const customerLineItems = this.getCustomerLineItemsForDecision(decision);
    const confirmedCustomerAddress = customerLineItems.length
      ? customerAddress && this.getCanonicalConfirmedCustomerAddress(customerAddress, checkoutState)
      : undefined;

    if (customerLineItems.length && !confirmedCustomerAddress) {
      return false;
    }

    this.props.confirmAmmoRoutingSession({
      cartId: this.props.cart.id,
      confirmedCustomerAddress,
      customerIdentityKey: getCustomerIdentityKey(this.props.customer),
      stateCode: normalizedStateCode,
    });

    return true;
  }

  private restoreConfirmedAmmoRoutingSession = async (
    session: ConfirmedAmmoRoutingSession,
  ): Promise<boolean> => {
    const stateCode = session.stateCode.trim().toUpperCase();
    const decision = this.getAmmoRoutingDecision(stateCode);
    const liveAddress = session.confirmedCustomerAddress
      ? this.getCurrentConsignments().find((consignment) =>
          isSameConsignmentDestination(
            consignment.shippingAddress,
            session.confirmedCustomerAddress,
          ),
        )?.shippingAddress
      : undefined;
    const customerAddress = liveAddress || session.confirmedCustomerAddress;
    const customerLineItems = this.getCustomerLineItemsForDecision(decision);
    const requiresCustomerAddress = decision !== 'pending' && customerLineItems.length > 0;

    await new Promise<void>((resolve) => {
      this.setState(
        {
          ...(customerAddress ? this.getCustomerAddressState(customerAddress) : {}),
          ammoRoutingError: false,
          ammoSelectedState: stateCode,
          ammoStateFFLRequired: decision === 'pending' ? null : decision === 'ffl',
          requiresAmmoRoutingReconciliation: requiresCustomerAddress && !customerAddress,
        } as DealerState,
        resolve,
      );
    });

    if (requiresCustomerAddress && !customerAddress) {
      return true;
    }

    await this.reconcileAmmoRouting(stateCode, customerAddress);

    return true;
  };

  // ----------------------
  // Event Handlers
  // ----------------------

  private reconcileFflConsignments = async (
    assignments: Array<{
      address: Address;
      lineItems: Array<{ itemId: string; quantity: number }>;
    }>,
    unassignedLineItems: Array<{ itemId: string; quantity: number }> = [],
    handoff?: CheckoutHandoffIntent,
  ): Promise<FflCoordinatorResult> => {
    if (!this.isUnmounted) {
      this.setState({ ammoRoutingError: false, isUpdatingShippingData: true });
    }

    const result = await this.props.fflConsignmentCoordinator.reconcile({
      assignments: assignments.map(({ address, lineItems }) => ({
        address: address as AddressRequestBody,
        itemIds: lineItems.map(({ itemId }) => String(itemId)),
      })),
      cartId: this.props.cart.id,
      handoff,
      unassignedItemIds: unassignedLineItems.map(({ itemId }) => String(itemId)),
    });

    if (!this.isUnmounted && result.status !== 'superseded') {
      this.setState({ isUpdatingShippingData: false });
    }

    return result;
  };

  private reportFflCoordinatorFailure(result: FflCoordinatorResult): void {
    if (result.status !== 'failed' || this.isUnmounted) {
      return;
    }

    this.setState({
      ammoRoutingError: true,
      requiresAmmoRoutingReconciliation: true,
    });
    this.props.onUnhandledError(
      result.kind === 'assign'
        ? new AssignItemFailedError(result.error as any)
        : new UnassignItemError(result.error as any),
    );
  }

  private getDealerId(selectedDealer = this.state.selectedDealer): string | number | undefined {
    const dealerId = selectedDealer?.dealerId ?? selectedDealer?.id;

    return dealerId === null || dealerId === '' ? undefined : dealerId;
  }

  private getActiveHandoffIntent(
    selectedDealer: any,
    destination: AddressRequestBody,
    lineItems: Array<{ itemId: string | number }>,
  ): CheckoutHandoffIntent | undefined {
    const dealerId = this.getDealerId(selectedDealer);

    if (dealerId === undefined) {
      this.props.onHandoffError(
        new Error('Automatic FFL cannot correlate the selected dealer without its canonical ID'),
      );
      return undefined;
    }

    return {
      active: true,
      dealerId,
      destination,
      itemIds: lineItems.map(({ itemId }) => String(itemId)),
    };
  }

  private getInactiveHandoffIntent(
    selectedDealer = this.state.selectedDealer,
  ): CheckoutHandoffIntent {
    if (!selectedDealer) {
      return { active: false };
    }

    const previousDealerId = this.getDealerId(selectedDealer);
    const previousDestination = this.resolveDealerShippingAddress(selectedDealer).shippingAddress;

    return {
      active: false,
      ...(previousDealerId === undefined ? {} : { previousDealerId }),
      previousDestination,
    };
  }

  /**
   * When the user toggles the bypass checkbox, we clear all consignments
   * and set the bypassFFL flag to true. Once bypassed, the customer cannot revert.
   */
  private handleBypassFFLToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      this.setState({ ammoRoutingError: false, isUpdatingShippingData: true });
      const result = await this.props.fflConsignmentCoordinator.clearAll(
        this.props.cart.id,
        this.getInactiveHandoffIntent(),
      );

      if (!this.isUnmounted && result.status !== 'superseded') {
        this.setState({ isUpdatingShippingData: false });
      }

      if (result.status === 'failed') {
        this.reportFflCoordinatorFailure(result);
        return;
      }

      if (result.status === 'fulfilled') {
        this.props.clearConfirmedAmmoRoutingSession();
        this.props.setSelectedFFL(null);

        if (!this.isUnmounted) {
          this.setState({
            ammoRoutingError: false,
            bypassFFL: true,
            multiShipment: false,
            requiresAmmoRoutingReconciliation: false,
          });
        }
      }
    }
  };

  handleManualFFLInput: () => Promise<void> = async () => {
    const { manualFflInput } = this.state;
    const dealerLineItems = this.getDealerLineItems();
    const result = await this.reconcileFflConsignments(
      [],
      dealerLineItems,
      this.getInactiveHandoffIntent(),
    );

    if (result.status === 'failed') {
      this.reportFflCoordinatorFailure(result);
      return;
    }

    if (result.status === 'superseded') {
      return;
    }

    this.props.clearConfirmedAmmoRoutingSession();
    this.props.setSelectedFFL(null);

    if (!this.isUnmounted) {
      this.setState({
        ammoRoutingError: false,
        manualFflInput: !manualFflInput,
        requiresAmmoRoutingReconciliation: false,
        selectedDealer: null,
      });
    }
  };

  toggleMapSelector: () => void = () => {
    this.setState({
      manualFflInput: false,
      showLocator: true,
    });
  };

  selectDealer: (dealer: any) => Promise<void> = (dealer: any) => {
    const selectedDealer = { ...dealer, shouldSaveAddress: false };
    const dealerId = this.getDealerId(selectedDealer);

    // API call to track dealer selection for analytics purposes
    if (dealerId !== undefined) {
      fetch(
        `https://${process.env.HOST}/store-front/api/${this.props.storeHash}/dealers/${dealerId}/select`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ).catch((error) => {
        console.log('Error logging dealer selection:', error);
      });
    }

    // Always remember the customer's selection, even if name fields are still
    // empty. commitDealerConsignment is a no-op until both names are present;
    // onChangeCustomShippingField re-fires it (debounced) once they are, so the
    // customer can pick a dealer first and type their name afterward without
    // having to re-pick the dealer.
    return new Promise<void>((resolve) => {
      this.setState(
        {
          selectedDealer,
          showLocator: false,
        },
        () => {
          this.startDealerConsignmentCommit().then(() => resolve());
        },
      );
    });
  };

  private startDealerConsignmentCommit = (): Promise<boolean> => {
    return this.commitDealerConsignment();
  };

  private resolveDealerShippingAddress = (selectedDealer = this.state.selectedDealer) => {
    const recipientName = resolveFflRecipientName({
      customerFirstName: this.state.customFirstNameInput,
      customerLastName: this.state.customLastNameInput,
      resolvedFirstName: selectedDealer.firstName,
      resolvedLastName: selectedDealer.lastName,
      useGenericRecipientName: this.state.useGenericFflRecipientName,
    });

    return {
      recipientName,
      shippingAddress: {
        ...selectedDealer,
        country: selectedDealer.country || selectedDealer.localizedCountry || 'United States',
        stateOrProvince: selectedDealer.stateOrProvince || selectedDealer.stateOrProvinceCode || '',
        customFields: selectedDealer.customFields || [],
        firstName: recipientName.firstName,
        lastName: recipientName.lastName,
        shouldSaveAddress: false,
      },
    };
  };

  /**
   * Builds and submits (or updates) the FFL consignment using the currently
   * selected dealer plus either the customer recipient name or the recipient
   * already resolved by AutoFFL. When customer names are required, it returns
   * silently if either input is missing and retries as the customer types.
   *
   * The recipient name lives in shippingAddress.firstName / .lastName. The
   * `company` value is resolved upstream and preserved from the iframe payload.
   */
  commitDealerConsignment: () => Promise<boolean> = async () => {
    if (this.isUnmounted) { return false; }
    const { getFields, onUnhandledError } = this.props;
    const selectedDealer = this.state.selectedDealer;
    const fflItems = this.getDealerLineItems();

    if (!canCommitDealerConsignment(Boolean(selectedDealer), fflItems.length)) {
      return false;
    }

    const { recipientName, shippingAddress } = this.resolveDealerShippingAddress(selectedDealer);

    if (
      !this.state.useGenericFflRecipientName &&
      (!recipientName.firstName || !recipientName.lastName)
    ) {
      // Surface the inline "First/Last Name is required" hint so the customer
      // knows what's still needed, but DON'T pop a modal — they may have just
      // picked a dealer first on purpose.
      this.setState({
        customFirstNameInputError: !recipientName.firstName,
        customLastNameInputError: !recipientName.lastName,
      });

      const result = await this.reconcileFflConsignments(
        [],
        fflItems,
        this.getInactiveHandoffIntent(selectedDealer),
      );

      if (result.status === 'failed') {
        this.reportFflCoordinatorFailure(result);
      }

      return false;
    }

    // Custom shipping fields (merchant-defined extras like "Delivery Instructions") are
    // captured by the standard BC shipping form, not by the FFL dealer flow — the dealer's
    // address doesn't carry customer-supplied custom-field input. Strip them from the
    // local pre-check so a store with required custom fields doesn't block dealer
    // selection. BC's server-side validation still applies via assignItem; if a custom
    // field is truly required at the API level, AssignItemFailedError surfaces it.
    const shippingFields = getFields(shippingAddress.countryCode).filter((f: any) => !f.custom);

    if (!isValidAddress(shippingAddress, shippingFields)) {
      this.setState({ ammoRoutingError: true });
      onUnhandledError(new AssignItemInvalidAddressError());
      return false;
    }

    const result = await this.reconcileFflConsignments(
      [{ address: shippingAddress, lineItems: fflItems }],
      [],
      this.getActiveHandoffIntent(selectedDealer, shippingAddress, fflItems),
    );

    if (this.isUnmounted) { return false; }

    if (result.status === 'fulfilled') {
      if (shippingAddress.fflID) {
        this.props.setSelectedFFL(shippingAddress);
      }
      if (!this.state.requiresAmmoRoutingReconciliation) {
        this.setState({ ammoRoutingError: false });
      }
      return true;
    }

    this.reportFflCoordinatorFailure(result);
    return false;
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
        const requirements = this.getFieldRequirements();
        const allRequiredFilled = Object.entries(requirements).every(
          ([key, isRequired]) => !isRequired || this.state[key],
        );

        if (allRequiredFilled) {
          this.debouncedAssignCustomShippingAddress();
        }

        // Dealer-flow re-commit: when the customer types into the top-of-page
        // name inputs after picking a dealer, debounce a consignment commit so
        // they can fill the name without having to re-select the dealer.
        if (
          this.state.selectedDealer &&
          this.hasAnyFflItems() &&
          (fieldId === 'firstNameInput' || fieldId === 'lastNameInput')
        ) {
          this.debouncedCommitDealerConsignment();
        }
      },
    );
  };

  private getCustomerLineItems = () => {
    return this.getCustomerLineItemsForDecision(this.getAmmoRoutingDecision());
  };

  private getCustomerLineItemsForDecision = (decision: AmmoRoutingDecision) => {
    const fflItemIds = new Set(this.getFFLItemsForDecision(decision).map((item) => item.itemId));

    if (this.state.multiShipment && fflItemIds.size > 0) {
      return [];
    }

    return this.props.cart.lineItems.physicalItems
      .filter((item) => item.parentId == null && !item.addedByPromotion && !fflItemIds.has(item.id))
      .map((item) => ({
        itemId: item.id,
        quantity: item.quantity,
      }));
  };

  private assignCustomerItemsToAddress = async (
    address: Address,
    clearRoutingErrorOnSuccess = true,
    confirmAmmoRoutingOnSuccess = false,
  ): Promise<boolean | undefined> => {
    const lineItems = this.getCustomerLineItems();
    const result = await this.reconcileFflConsignments([{ address, lineItems }]);

    if (result.status === 'fulfilled') {
      if (confirmAmmoRoutingOnSuccess) {
        const confirmed = this.confirmAmmoRoutingSession(
          this.state.ammoSelectedState,
          address,
          result.checkoutState,
        );

        if (!confirmed) {
          const failure: FflCoordinatorResult = {
            status: 'failed',
            kind: 'assign',
            error: new Error('BigCommerce did not return the confirmed customer destination'),
          };
          this.reportFflCoordinatorFailure(failure);
          return false;
        }
      }

      if (!this.isUnmounted) {
        const fulfilledAddress = this.getCanonicalConfirmedCustomerAddress(
          address,
          result.checkoutState,
        );

        if (fulfilledAddress) {
          this.applyFulfilledCustomerAddress(fulfilledAddress);
        }

        if (confirmAmmoRoutingOnSuccess) {
          this.setState({ requiresAmmoRoutingReconciliation: false });
        }

        if (clearRoutingErrorOnSuccess) {
          this.setState({ ammoRoutingError: false });
        }
      }
      return true;
    }

    if (result.status === 'failed') {
      this.reportFflCoordinatorFailure(result);
      return false;
    }

    return undefined;
  };

  private reconcileAmmoRouting = async (
    stateCode: string,
    customerAddress?: Address,
    notifyCustomer = false,
  ): Promise<boolean> => {
    const normalizedStateCode = stateCode.trim().toUpperCase();
    const decision = this.getAmmoRoutingDecision(normalizedStateCode);
    const wasFflRequired = this.state.ammoStateFFLRequired === true;
    const retainedDealer = this.state.selectedDealer;
    const shouldClearAmmoOnlyDealer = !this.hasFirearms() && decision !== 'ffl';
    const ammoStateFFLRequired = decision === 'pending' ? null : decision === 'ffl';
    const customerLineItems =
      decision === 'pending' ? [] : this.getCustomerLineItemsForDecision(decision);
    const requiresCustomerAddress = decision !== 'pending' && customerLineItems.length > 0;
    const rollbackAddress = customerAddress
      ? this.props.customer.isGuest
        ? this.props.customerAddressSelection
        : this.getCustomerItemsConsignment()?.shippingAddress
      : undefined;
    const shouldShowFflNotice =
      notifyCustomer &&
      this.getAmmoRoutingDecision('') === 'pending' &&
      decision === 'ffl' &&
      !this.isAmmunitionAssignedToSelectedDealer();
    const newState: Partial<DealerState> = {
      ammoFflNoticeState: shouldShowFflNotice
        ? customerAddress?.stateOrProvince || normalizedStateCode
        : '',
      ammoRoutingError: false,
      ammoSelectedState: normalizedStateCode,
      ammoStateFFLRequired,
      isUpdatingShippingData: true,
      requiresAmmoRoutingReconciliation: false,
      selectedDealer: retainedDealer,
      showAmmoFflNotice: shouldShowFflNotice,
      showLocator: false,
    };

    if (customerAddress) {
      // Preserve the click immediately while the SDK routing queue catches up.
      // Fulfillment is confirmed from returned consignments below.
      this.setCurrentPageCustomerAddressSelection(customerAddress);
    }

    this.debouncedAssignCustomShippingAddress.cancel();
    this.debouncedCommitDealerConsignment.cancel();

    if (requiresCustomerAddress && !customerAddress) {
      this.setState({
        ...newState,
        isUpdatingShippingData: false,
        requiresAmmoRoutingReconciliation: true,
        showAmmoFflNotice: false,
      } as DealerState);
      return false;
    }

    this.setState(newState as DealerState);

    const dealerShippingAddress =
      !shouldClearAmmoOnlyDealer && retainedDealer
        ? this.resolveDealerShippingAddress(retainedDealer).shippingAddress
        : undefined;
    const dealerLineItems = dealerShippingAddress
      ? this.getDealerLineItemsForDecision(decision)
      : [];

    if (dealerShippingAddress && dealerLineItems.length) {
      const { recipientName } = this.resolveDealerShippingAddress(retainedDealer);

      if (
        !this.state.useGenericFflRecipientName &&
        (!recipientName.firstName || !recipientName.lastName)
      ) {
        this.setState({
          ammoRoutingError: true,
          customFirstNameInputError: !recipientName.firstName,
          customLastNameInputError: !recipientName.lastName,
          isUpdatingShippingData: false,
          requiresAmmoRoutingReconciliation: true,
          showAmmoFflNotice: false,
        });

        if (customerAddress) {
          this.setCurrentPageCustomerAddressSelection(rollbackAddress);
        }

        return false;
      }

      const shippingFields = this.props
        .getFields(dealerShippingAddress.countryCode)
        .filter((field: any) => !field.custom);

      if (!isValidAddress(dealerShippingAddress, shippingFields)) {
        this.setState({
          ammoRoutingError: true,
          isUpdatingShippingData: false,
          requiresAmmoRoutingReconciliation: true,
          showAmmoFflNotice: false,
        });
        this.props.onUnhandledError(new AssignItemInvalidAddressError());

        if (customerAddress) {
          this.setCurrentPageCustomerAddressSelection(rollbackAddress);
        }

        return false;
      }
    }

    const assignments = [];
    const unassignedLineItems = [];

    if (dealerShippingAddress && dealerLineItems.length) {
      assignments.push({ address: dealerShippingAddress, lineItems: dealerLineItems });
    }

    if (decision !== 'pending' && customerAddress) {
      assignments.push({
        address: customerAddress,
        lineItems: customerLineItems,
      });
    }

    if (decision === 'pending' || (decision === 'ffl' && !dealerShippingAddress)) {
      unassignedLineItems.push(...this.props.stateRestrictedConsignmentItems);
    }

    const handoff = shouldClearAmmoOnlyDealer
      ? this.getInactiveHandoffIntent(retainedDealer)
      : dealerShippingAddress && dealerLineItems.length
      ? this.getActiveHandoffIntent(retainedDealer, dealerShippingAddress, dealerLineItems)
      : undefined;
    const result = await this.reconcileFflConsignments(assignments, unassignedLineItems, handoff);

    if (result.status === 'superseded') {
      return false;
    }

    if (result.status === 'failed') {
      this.reportFflCoordinatorFailure(result);

      if (this.isUnmounted) {
        return false;
      }

      if (customerAddress) {
        this.setCurrentPageCustomerAddressSelection(rollbackAddress);
      }

      this.setState({ showAmmoFflNotice: false });
      return false;
    }

    const fulfilledAddress = customerAddress
      ? this.getCanonicalConfirmedCustomerAddress(customerAddress, result.checkoutState)
      : undefined;

    if (decision === 'pending') {
      this.props.clearConfirmedAmmoRoutingSession();
    } else if (
      !this.confirmAmmoRoutingSession(
        normalizedStateCode,
        fulfilledAddress || customerAddress,
        result.checkoutState,
      )
    ) {
      const failure: FflCoordinatorResult = {
        status: 'failed',
        kind: 'assign',
        error: new Error('BigCommerce did not return the confirmed customer destination'),
      };
      this.reportFflCoordinatorFailure(failure);
      return false;
    }

    if (this.isUnmounted) {
      return true;
    }

    if (shouldClearAmmoOnlyDealer) {
      this.setState({
        ...(wasFflRequired ? this.getClearedCustomShippingFields() : {}),
        selectedDealer: null,
      });
      this.props.setSelectedFFL(null);
    } else if (dealerShippingAddress?.fflID) {
      this.props.setSelectedFFL(dealerShippingAddress);
    }

    if (fulfilledAddress) {
      this.applyFulfilledCustomerAddress(fulfilledAddress, decision);
    }

    this.setState((state) => ({
      ammoRoutingError: false,
      isUpdatingShippingData: false,
      requiresAmmoRoutingReconciliation: false,
      showAmmoFflNotice: state.showAmmoFflNotice,
    }));

    return true;
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
      customCompanyInputError: false,
      customPhoneInput: '',
      customPhoneInputError: false,
      customAddressLine1Input: '',
      customAddressLine1InputError: false,
      customAddressLine2Input: '',
      customAddressLine2InputError: false,
      customCityInput: '',
      customCityInputError: false,
      customPostCodeInput: '',
      customPostCodeInputError: false,
    };
  };

  private getFieldRequirements = (): Record<string, boolean> => {
    const { getFields, getBillingFields } = this.props;
    const shippingFields = getFields('US');
    const billingFields = getBillingFields('US');
    const requirements: Record<string, boolean> = {};

    for (const [sdkName, stateKey] of Object.entries(SDK_FIELD_TO_STATE_KEY)) {
      const shippingField = shippingFields.find((f) => f.name === sdkName);
      const billingField = billingFields.find((f) => f.name === sdkName);
      requirements[stateKey] =
        (shippingField?.required ?? false) || (billingField?.required ?? false);
    }

    return requirements;
  };

  validateSelectedState: (event: any) => void = async (event) => {
    const stateCode = event.target.value;
    await this.reconcileAmmoRouting(stateCode);
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
    const { onUnhandledError, getFields } = this.props;

    // The store response determines whether ammo is FFL-bound. Do not assign
    // the cart against the constructor's temporary default before it arrives.
    if (this.state.isLoading) {
      return;
    }

    if (!isValidAddress(address, getFields(address.countryCode))) {
      return onUnhandledError(new AssignItemInvalidAddressError());
    }

    // Guest checkouts start with blank recipient fields. Reuse the completed
    // shipping address name before moving restricted ammo to the selected FFL;
    // preserve any name the customer already entered above the consignments.
    const recipientName: Partial<DealerState> = {};

    if (!this.state.customFirstNameInput.trim() && address.firstName) {
      recipientName.customFirstNameInput = address.firstName;
      recipientName.customFirstNameInputError = false;
    }

    if (!this.state.customLastNameInput.trim() && address.lastName) {
      recipientName.customLastNameInput = address.lastName;
      recipientName.customLastNameInputError = false;
    }

    if (Object.keys(recipientName).length > 0) {
      await new Promise<void>((resolve) => {
        this.setState(recipientName as DealerState, resolve);
      });
    }

    if (this.hasAmmunition() && this.state.withAmmoSubscription) {
      await this.reconcileAmmoRouting(address.stateOrProvinceCode, address, true);
      return;
    }

    this.setCurrentPageCustomerAddressSelection(address);
    const succeeded = await this.assignCustomerItemsToAddress(address);

    if (succeeded === undefined) {
      return;
    }

    const fulfilledAddress = this.getCustomerItemsConsignment(address)?.shippingAddress;
    const rollbackAddress = this.props.customer.isGuest
      ? this.props.customerAddressSelection
      : this.getCustomerItemsConsignment()?.shippingAddress;

    this.setCurrentPageCustomerAddressSelection(
      succeeded ? fulfilledAddress || address : rollbackAddress,
      succeeded,
    );
  };

  render() {
    const {
      stateRestrictedConsignmentItems,
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

    // Never present a persisted consignment address as the selected FFL. Only
    // current-page selector state (or the parent's same-page in-memory state)
    // is trusted as dealer identity.
    const selectedFflAddress = this.state.selectedDealer
      ? this.resolveDealerShippingAddress(this.state.selectedDealer).shippingAddress
      : undefined;
    const fflConsignment = selectedFflAddress
      ? consignments.find((consignment) =>
          isSameConsignmentDestination(consignment.shippingAddress, selectedFflAddress),
        )
      : undefined;
    const currentPageCustomerAddress = this.getCurrentPageCustomerAddressSelection();
    const { itemAddingAddress } = this.state;

    return (
      <section className="ffl-section checkout-form">
        <Modal
          additionalBodyClassName="modal--withText"
          additionalModalClassName="modal--medium"
          closeButtonLabel={<TranslatedString id="common.close_action" />}
          footer={
            <Button onClick={this.handleCloseAmmoFflNotice} size={ButtonSize.Small} type="button">
              <TranslatedString id="common.ok_action" />
            </Button>
          }
          header={
            <ModalHeader>
              <TranslatedString id="shipping.ffl_shipping_required_heading" />
            </ModalHeader>
          }
          isOpen={this.state.showAmmoFflNotice}
          onRequestClose={this.handleCloseAmmoFflNotice}
          shouldShowCloseButton={true}
        >
          <p className="lead">
            <TranslatedString
              data={{ state: this.state.ammoFflNoticeState }}
              id="shipping.ffl_ammo_state_required_text"
            />
          </p>
        </Modal>

        {/* Customer recipient name — feeds whichever consignment needs it downstream:
            - firearm / FFL-required ammo path: hidden when the generic name is enabled
            - guest non-FFL ammo path: debouncedAssignCustomShippingAddress reads these into address
            - signed-in ammo path: saved-address names are reused until an FFL is required
            Prefilled in the constructor from billingAddress / customer; empty for guests.
            Hidden in bypass / manual-FFL modes — the embedded <Shipping /> form below
            captures the name there, so rendering these would duplicate the inputs. */}
        {!this.state.bypassFFL &&
          !this.state.manualFflInput &&
          shouldShowCustomerRecipientNameFields({
            ammoStateFflRequired: this.state.ammoStateFFLRequired,
            hasFflItems: this.hasAnyFflItems(),
            hasOnlyAmmunition: this.hasOnlyAmmunition(),
            isGuest: customer.isGuest,
            useGenericRecipientName: this.state.useGenericFflRecipientName,
          }) && (
            <CustomerNameFields
              firstName={this.state.customFirstNameInput}
              firstNameError={this.state.customFirstNameInputError}
              lastName={this.state.customLastNameInput}
              lastNameError={this.state.customLastNameInputError}
              onChange={this.onChangeCustomShippingField}
            />
          )}

        {/* If there's no firearm but we have ammo items, show the state dropdown if subscription is active */}
        {this.hasOnlyAmmunition() &&
          this.state.withAmmoSubscription &&
          customer.isGuest &&
          !this.state.bypassFFL && (
            <StatesDropdown
              selectedState={this.state.ammoSelectedState}
              validateSelectedState={this.validateSelectedState}
            />
          )}

        {/* ========== FFL Consignment Area ========== */}
        {this.hasFirearms() || (this.hasOnlyAmmunition() && this.state.ammoStateFFLRequired) ? (
          <div className="ffl-consignment-area">
            {/* No dealer picked yet — show the FFL warning. */}
            {this.state.manualFflInput === false &&
              !selectedFflAddress &&
              !this.state.bypassFFL && (
                <div className="alertBox alertBox--error alertBox--font-color-black automaticFfl-panel automaticFfl-panel--warning">
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

            {selectedFflAddress && (
              <div className="consignment-product-body alertBox--success shipping automaticFfl-panel automaticFfl-panel--selected">
                {groupedItemsWithFFLEntries.map(([key, items]) => (
                  <li key={items[0].key}>
                    <ItemFFL item={items[0]} quantity={items.length} />
                  </li>
                ))}
                {/* Before names commit, fflConsignment doesn't exist yet — fall back
                    to the dealer payload and tell StaticAddress to skip validation
                    so it renders without firstName/lastName. */}
                <StaticAddress
                  address={selectedFflAddress}
                  skipValidation={!fflConsignment}
                  type={AddressType.Shipping}
                />
              </div>
            )}

            {/* Only show the Select Dealer button if bypass is not enabled */}
            {!this.state.bypassFFL && (
              <div className="form-action">
                <DealerMessageListener selectDealer={this.selectDealer} />
                <Modal
                  additionalBodyClassName="modal-iframe-body"
                  additionalHeaderClassName="modal-iframe-header"
                  additionalModalClassName="modal-iframe"
                  isOpen={this.state.showLocator}
                  onRequestClose={this.handleCancel}
                  shouldShowCloseButton={false}
                >
                  <iframe
                    src={`https://${process.env.STATIC_HOST}/index.html?store_hash=${this.props.storeHash}&platform=BigCommerce&maps_api_key=${process.env.GOOGLE_MAPS_KEY}`}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                  ></iframe>
                </Modal>
                <button
                  type="button"
                  className="button button--primary optimizedCheckout-buttonPrimary automaticFfl-dealerButton"
                  onClick={this.toggleMapSelector}
                >
                  {selectedFflAddress ? (
                    <TranslatedString id="shipping.ffl_change_dealer" />
                  ) : (
                    <TranslatedString id="shipping.ffl_select_dealer" />
                  )}
                </button>
              </div>
            )}

            {/* Bypass checkbox appears below the Select Dealer button if bypassOption is true */}
            {this.state.bypassOption && (
              <div
                className="bypass-ffl-toggle"
                style={{ marginBottom: '10px', marginTop: '-10px' }}
              >
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
          <div className="non-ffl-consignment-area" style={{ marginTop: '10px' }}>
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
                                selectedAddress={this.getExplicitlySelectedCustomerAddress(
                                  items[0].consignment?.shippingAddress,
                                )}
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
        {shouldShowAmmoAddressSelector({
          ammoStateFflRequired: this.state.ammoStateFFLRequired,
          hasAmmunitionOnlyCart: this.hasAmmunitionOnlyCart(),
          hasAmmoWithoutFirearms: this.hasOnlyAmmunition(),
          isBypassEnabled: this.state.bypassFFL,
          isGuest: customer.isGuest,
        }) && (
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
            {!this.state.isLoading && (
              <AddressSelect
                addresses={customer.addresses}
                onSelectAddress={this.handleSelectAddress}
                onUseNewAddress={this.handleUseNewAddress}
                selectedAddress={currentPageCustomerAddress}
              />
            )}
          </div>
        )}

        {/* ========== Custom Shipping Form (non-FFL) ========== */}
        {this.state.ammoStateFFLRequired === false &&
          customer.isGuest &&
          this.hasOnlyAmmunition() && (
            <CustomShippingForm
              onChangeCustomShippingField={this.onChangeCustomShippingField}
              companyInput={this.state.customCompanyInput}
              companyInputError={this.state.customCompanyInputError}
              phoneInput={this.state.customPhoneInput}
              phoneInputError={this.state.customPhoneInputError}
              fieldRequirements={this.getFieldRequirements()}
              addressLine1Input={this.state.customAddressLine1Input}
              addressLine1InputError={this.state.customAddressLine1InputError}
              addressLine2Input={this.state.customAddressLine2Input}
              addressLine2InputError={this.state.customAddressLine2InputError}
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
            shouldShowShippingOptions={
              !this.isAmmoStateSelectionPending() &&
              !hasUnassignedLineItems(consignments, cart.lineItems)
            }
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
      </section>
    );
  }

  private handleCloseAddAddressForm: () => void = () => {
    this.setState({
      itemAddingAddress: undefined,
    });
  };

  private handleCloseAmmoFflNotice: () => void = () => {
    this.setState({ showAmmoFflNotice: false });
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

  private handleSaveAddress: (address: AddressFormValues) => void = async (address) => {
    const { createCustomerAddress, customer } = this.props;
    const { itemAddingAddress } = this.state;

    if (!itemAddingAddress) {
      return;
    }

    const shippingAddress = mapAddressFromFormValues(address);
    const addressSelection = this.state.itemAddingAddress;

    // Close the address form before opening any routing notice.
    this.setState({ itemAddingAddress: undefined });

    await this.handleSelectAddress(shippingAddress, addressSelection.itemId, addressSelection.key);

    // Guest addresses belong to the checkout consignment, not an account
    // address book. BigCommerce correctly rejects createCustomerAddress for
    // guests with a 401, so only persist the address for signed-in customers.
    if (!customer.isGuest) {
      try {
        await createCustomerAddress(shippingAddress);
      } catch (e) {
        this.setState({ createCustomerAddressError: e });
      }
    }
  };

  private handleMultiShippingSubmit: (values: MultiShippingFormValues) => void = async ({
    orderComment,
  }) => {
    const {
      cart,
      consignments,
      customer,
      customerMessage,
      navigateNextStep,
      onUnhandledError,
      updateCheckout,
    } = this.props;

    // Keep the handler safe even if it is triggered outside the disabled button.
    // A partial non-FFL consignment can already have a quote while restricted ammo
    // is still unassigned and waiting for a dealer.
    if (
      this.state.isLoading ||
      this.state.isUpdatingShippingData ||
      this.state.ammoRoutingError ||
      this.state.requiresAmmoRoutingReconciliation ||
      this.requiresExplicitDealerSelection() ||
      this.isAmmoStateSelectionPending() ||
      hasUnassignedLineItems(consignments, cart.lineItems)
    ) {
      return;
    }

    // Only validate custom shipping fields if:
    // 1. Ammunition doesn't require FFL shipping (ammoStateFFLRequired is false)
    // 2. We're not in the case of a logged-in user with only ammunition in cart
    // (In those cases, we use saved addresses or FFL dealers instead of the custom form)
    if (this.state.ammoStateFFLRequired === false && customer.isGuest && this.hasOnlyAmmunition()) {
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
    let firstErrorField: string | null = null;
    const requirements = this.getFieldRequirements();

    for (const [stateKey, isRequired] of Object.entries(requirements)) {
      if (isRequired && !this.state[stateKey]) {
        this.setState({ [`${stateKey}Error`]: true });
        if (!firstErrorField) {
          firstErrorField = stateKey.replace('custom', '');
          firstErrorField = firstErrorField.charAt(0).toLowerCase() + firstErrorField.slice(1);
        }
        isValid = false;
      }
    }

    if (firstErrorField) {
      document
        .getElementById(firstErrorField)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    const { cart, isLoading, consignments, isValid } = this.props;
    const { isLoading: isStoreSettingsLoading, isUpdatingShippingData } = this.state;

    if (isValid === false) {
      return true;
    }

    if (this.requiresExplicitDealerSelection()) {
      return true;
    }

    return shouldDisableFflShippingSubmit({
      hasAmmoRoutingError: this.state.ammoRoutingError,
      hasSelectedShippingOptions: hasSelectedShippingOptions(consignments),
      hasUnassignedLineItems: hasUnassignedLineItems(consignments, cart.lineItems),
      isAmmoStateSelectionPending: this.isAmmoStateSelectionPending(),
      isLoading: isLoading || isStoreSettingsLoading,
      isUpdatingShippingData,
      requiresAmmoRoutingReconciliation: this.state.requiresAmmoRoutingReconciliation,
    });
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
      getBillingAddressFields,
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
    billingAddress: getBillingAddress(),
    cart,
    consignments,
    countries: getShippingCountries() || EMPTY_ARRAY,
    countriesWithAutocomplete,
    customer,
    customerMessage: checkout.customerMessage,
    deinitializeShippingMethod: checkoutService.deinitializeShipping,
    getFields: getShippingAddressFields,
    getBillingFields: getBillingAddressFields,
    googleMapsApiKey,
    initializeShippingMethod: checkoutService.initializeShipping,
    loadShippingAddressFields: checkoutService.loadShippingAddressFields,
    loadBillingAddressFields: checkoutService.loadBillingAddressFields,
    loadShippingOptions: checkoutService.loadShippingOptions,
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
    updateBillingAddress: checkoutService.updateBillingAddress,
    createCustomerAddress: checkoutService.createCustomerAddress,
    getCheckoutState: () => checkoutService.getState(),
    updateCheckout: checkoutService.updateCheckout,
    updateShippingAddress: checkoutService.updateShippingAddress,
  };
}

export default withCheckout(mapToDealerShippingProps)(DealerShipping);
