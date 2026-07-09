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
import React, { lazy, useEffect } from 'react';
import { debounce, noop } from 'lodash';

import { withCheckout, CheckoutContextProps } from '../../checkout';
import getShippingMethodId from '../../shipping/getShippingMethodId';
import getShippableItemsCount from '../../shipping/getShippableItemsCount';
import hasUnassignedLineItems from '../../shipping/hasUnassignedLineItems';
import hasSelectedShippingOptions from '../../shipping/hasSelectedShippingOptions';
import updateShippableItems from '../../shipping/updateShippableItems';
import AddressSelect from '../../address/AddressSelect';
import isEqualAddress from '../../address/isEqualAddress';
import { AddressType, StaticAddress } from '../../address';
import { TranslatedString } from '@bigcommerce/checkout/locale';
import { Modal, ModalHeader } from '@bigcommerce/checkout/ui';

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
import {
  AmmoCheckoutSessionState,
  canCommitDealerConsignment,
  isAmmunitionOnlyCart,
  isAmmoFflRequiredState,
  resolveAmmoCheckoutSessionState,
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

const Shipping = lazy(() =>
  retry(
    () =>
      import(
        /* webpackChunkName: "shipping" */
        '../../shipping/Shipping'
      ),
  ),
);

// CheckoutStep unmounts Shipping while Billing is active. Keep the buyer's ammo
// state choice for that page lifetime only; a full checkout reload evaluates the
// destination again instead of inheriting a persisted BigCommerce consignment.
let ammoCheckoutSessionState: AmmoCheckoutSessionState | null = null;

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
  getBillingFields(countryCode?: string): FormField[];
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
  stateRestrictedConsignmentItems: any;
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

    // Prefill the recipient name fields from BC SDK state when available so logged-in
    // customers don't retype. Empty string for guests / pre-billing — they fill it in.
    const initialFirstName = props.billingAddress?.firstName || props.customer?.firstName || '';
    const initialLastName = props.billingAddress?.lastName || props.customer?.lastName || '';
    const restoredAmmoState = resolveAmmoCheckoutSessionState(
      props.cart.id,
      ammoCheckoutSessionState,
    );

    this.state = {
      ammoSelectedState: restoredAmmoState?.ammoSelectedState ?? '',
      ammoStateFFLRequired: restoredAmmoState?.ammoStateFFLRequired ?? null,
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
      useGenericFflRecipientName: false,
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

    // Re-fired by onChangeCustomShippingField when the customer types into the
    // top-of-page name inputs AFTER they've already picked a dealer. The 500ms
    // debounce avoids spamming assignItem on every keystroke. Commits silently
    // when names are blank (the dealer stays remembered until names arrive).
    this.debouncedCommitDealerConsignment = debounce(() => {
      this.commitDealerConsignment();
    }, 500);

    fetch(`https://${process.env.HOST}/store-front/api/stores/${this.props.storeHash}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.json())
      .then((data) => {
        const useGenericFflRecipientName = data.use_generic_ffl_recipient_name === true;
        const merchantStates = data.merchant.merchant_states.filter(
          (merchantState) => merchantState.enabled,
        );

        this.props.setFFLtoOrderComments(data.ffl_to_order_comments);
        this.props.setWithAmmoSubscription(data.with_ammo_subscription);
        this.setState(
          {
            announcement: data.announcement,
            multiShipment: data.multi_shipment,
            withAmmoSubscription: data.with_ammo_subscription,
            bypassOption: data.bypass_option,
            bypassText: data.bypass_text,
            useGenericFflRecipientName,
          },
          () => {
            this.setState({ isLoading: false }, () => {
              if (useGenericFflRecipientName && this.state.selectedDealer) {
                this.commitDealerConsignment();
              }
            });
          },
        );
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

    const { stateRestrictedConsignmentItems, fflConsignmentItems } = this.props;
    const { withAmmoSubscription, ammoStateFFLRequired } = this.state;

    // If there are firearms and ammo in the cart with an ammo subscription,
    // mark ammo as FFL required without state checks
    if (withAmmoSubscription && fflConsignmentItems.length > 0 && stateRestrictedConsignmentItems.length > 0) {
      return fflConsignmentItems.concat(stateRestrictedConsignmentItems);
    }

    // Original logic for other cases
    if (withAmmoSubscription && ammoStateFFLRequired) {
      return fflConsignmentItems.concat(stateRestrictedConsignmentItems);
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
    const ammunitionItemIds = stateRestrictedConsignmentItems.map(
      (item) => item.itemId as string,
    );

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

  private isAmmoStateSelectionPending(): boolean {
    return (
      this.hasOnlyAmmunition() &&
      this.state.withAmmoSubscription &&
      this.state.ammoStateFFLRequired === null
    );
  }

  /**
   * Returns the persisted customer address used for direct shipping, if one is
   * still present in checkout state. Matching against the customer's address
   * book avoids mistaking an FFL consignment address for the saved address.
   */
  private getSelectedSavedAddress(): Address | undefined {
    const { consignments, customer } = this.props;

    return consignments.find((consignment) =>
      customer.addresses.some((address) => isEqualAddress(address, consignment.shippingAddress)),
    )?.shippingAddress;
  }

  private rememberAmmoCheckoutSessionState = (
    stateCode: string,
    ammoStateFFLRequired: boolean | null,
  ): void => {
    ammoCheckoutSessionState =
      stateCode && ammoStateFFLRequired !== null
        ? {
            ammoSelectedState: stateCode,
            ammoStateFFLRequired,
            cartId: this.props.cart.id,
          }
        : null;
  };

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

  handleManualFFLInput: () => Promise<void> = async () => {
    const { manualFflInput } = this.state;
    const { deleteConsignment, onUnhandledError } = this.props;

    // If a dealer-bound FFL consignment was already committed, drop it before
    // switching to manual input — otherwise it lingers in BC SDK state and can
    // ride through to checkout under the now-abandoned dealer's address.
    const existingConsignment = this.getFFLConsignment();
    if (existingConsignment) {
      try {
        await deleteConsignment(existingConsignment.id);
      } catch (e) {
        onUnhandledError(new UnassignItemError(e as any));
      }
    }

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
      `https://${process.env.HOST}/store-front/api/${this.props.storeHash}/dealers/${dealer.id}/select`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    ).catch((error) => {
      console.log('Error logging dealer selection:', error);
    });

    // Always remember the customer's selection, even if name fields are still
    // empty. commitDealerConsignment is a no-op until both names are present;
    // onChangeCustomShippingField re-fires it (debounced) once they are, so the
    // customer can pick a dealer first and type their name afterward without
    // having to re-pick the dealer.
    this.setState(
      {
        selectedDealer: dealer,
        showLocator: false,
      },
      () => {
        this.commitDealerConsignment();
      },
    );
  };

  /**
   * Builds and submits (or updates) the FFL consignment using the currently
   * selected dealer plus either the customer recipient name or the configured
   * generic FFL recipient name. When customer names are required, it returns
   * silently if either input is missing and retries as the customer types.
   *
   * The recipient name lives in shippingAddress.firstName / .lastName. The
   * dealer business name always remains in `company` from the iframe payload.
   */
  commitDealerConsignment: () => Promise<void> = async () => {
    const { assignItem, deleteConsignment, getFields, onUnhandledError } = this.props;
    const { selectedDealer } = this.state;
    const fflItems = this.getFFLItems();

    if (!canCommitDealerConsignment(Boolean(selectedDealer), fflItems.length)) {
      return;
    }

    const recipientName = resolveFflRecipientName({
      customerFirstName: this.state.customFirstNameInput,
      customerLastName: this.state.customLastNameInput,
      useGenericRecipientName: this.state.useGenericFflRecipientName,
    });

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

      // If a consignment was already committed (customer filled names earlier
      // and is now clearing one), drop it. Otherwise the user could proceed
      // through the shipping step with the now-stale name on the consignment.
      // The dealer card stays visible (selectedDealer is still in state) so
      // the customer just has to re-type the name to re-commit.
      const existingConsignment = this.getFFLConsignment();
      if (existingConsignment) {
        try {
          await deleteConsignment(existingConsignment.id);
        } catch (e) {
          onUnhandledError(new UnassignItemError(e as any));
        }
      }
      return;
    }

    const allCartItems = this.state.items.map((item: any) => ({
      itemId: item.id,
      quantity: item.quantity,
    }));

    // The iframe map's postMessage payload (automatic-ffl-map handleSelect) omits a few
    // fields that BC's address Yup schema may treat as required (notably the full
    // `country` name, `stateOrProvince`, and `customFields`). Normalize defensively so
    // a real-world dealer payload doesn't trip BC's local pre-validation.
    const shippingAddress = {
      ...selectedDealer,
      country: selectedDealer.country || selectedDealer.localizedCountry || 'United States',
      stateOrProvince:
        selectedDealer.stateOrProvince || selectedDealer.stateOrProvinceCode || '',
      customFields: selectedDealer.customFields || [],
      firstName: recipientName.firstName,
      lastName: recipientName.lastName,
    };

    const consignment = {
      lineItems: this.state.multiShipment ? allCartItems : fflItems,
      shippingAddress,
    };

    // Custom shipping fields (merchant-defined extras like "Delivery Instructions") are
    // captured by the standard BC shipping form, not by the FFL dealer flow — the dealer's
    // address doesn't carry customer-supplied custom-field input. Strip them from the
    // local pre-check so a store with required custom fields doesn't block dealer
    // selection. BC's server-side validation still applies via assignItem; if a custom
    // field is truly required at the API level, AssignItemFailedError surfaces it.
    const shippingFields = getFields(shippingAddress.countryCode).filter(
      (f: any) => !f.custom,
    );

    if (!isValidAddress(shippingAddress, shippingFields)) {
      return onUnhandledError(new AssignItemInvalidAddressError());
    }

    try {
      this.props.setSelectedFFL(shippingAddress);
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

  private validateAndUnassignState = async (stateCode: string): Promise<void> => {
    const {
      deleteConsignment,
      onUnhandledError,
      consignments,
      fflConsignmentItems,
      fflProducts,
      stateRestrictedConsignmentItems,
    } = this.props;
    const { withAmmoSubscription } = this.state;

    // Skip state validation if there are firearms and ammo with an ammo subscription
    const skipStateValidation =
      withAmmoSubscription &&
      fflConsignmentItems.length > 0 &&
      stateRestrictedConsignmentItems.length > 0;

    const fflRequired = skipStateValidation || isAmmoFflRequiredState(stateCode, fflProducts);

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
        this.debouncedCommitDealerConsignment.cancel();
        this.props.setSelectedFFL(null);
        Object.assign(newState, this.getClearedCustomShippingFields(), {
          selectedDealer: null,
          showLocator: false,
        });
      }

      this.setState(newState as DealerState, () => {
        this.rememberAmmoCheckoutSessionState(stateCode, newState.ammoStateFFLRequired ?? null);
        resolve();
      });
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
      requirements[stateKey] = (shippingField?.required ?? false) || (billingField?.required ?? false);
    }

    return requirements;
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
    const { assignItem, onUnhandledError, getFields, stateRestrictedConsignmentItems, customer } =
      this.props;

    // The store response determines whether ammo is FFL-bound. Do not assign
    // the cart against the constructor's temporary default before it arrives.
    if (this.state.isLoading) {
      return;
    }

    if (!isValidAddress(address, getFields(address.countryCode))) {
      return onUnhandledError(new AssignItemInvalidAddressError());
    }

    const isLoggedIn = !customer.isGuest;
    if (isLoggedIn && stateRestrictedConsignmentItems.length > 0 && !this.hasFirearms()) {
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

    // Grab the consignment that contains FFL items (if any)
    const fflConsignment = this.getFFLConsignment();
    const selectedFflAddress = fflConsignment?.shippingAddress ?? this.state.selectedDealer;
    const selectedSavedAddress = this.getSelectedSavedAddress();
    const { itemAddingAddress } = this.state;

    return (
      <section className="ffl-section checkout-form">
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
            <StatesDropdown validateSelectedState={this.validateSelectedState} />
          )}

        {/* ========== FFL Consignment Area ========== */}
        {this.hasFirearms() || (this.hasOnlyAmmunition() && this.state.ammoStateFFLRequired) ? (
          <div className="ffl-consignment-area">
            {/* No dealer picked yet — show the FFL warning. */}
            {this.state.manualFflInput === false &&
              !selectedFflAddress &&
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

            {selectedFflAddress && (
              <div className="consignment-product-body alertBox--success shipping">
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
                  className="button button--primary optimizedCheckout-buttonPrimary"
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
                selectedAddress={
                  this.state.ammoSelectedState !== '' && stateRestrictedConsignmentItems.length > 0
                    ? selectedSavedAddress
                    : undefined
                }
              />
            )}
          </div>
        )}

        {/* ========== Custom Shipping Form (non-FFL) ========== */}
        {this.state.ammoStateFFLRequired === false &&
          !(!customer.isGuest && this.hasOnlyAmmunition()) && (
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
      this.isAmmoStateSelectionPending() ||
      hasUnassignedLineItems(consignments, cart.lineItems)
    ) {
      return;
    }

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
      document.getElementById(firstErrorField)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      return false;
    }

    return shouldDisableFflShippingSubmit({
      hasSelectedShippingOptions: hasSelectedShippingOptions(consignments),
      hasUnassignedLineItems: hasUnassignedLineItems(consignments, cart.lineItems),
      isAmmoStateSelectionPending: this.isAmmoStateSelectionPending(),
      isLoading: isLoading || isStoreSettingsLoading,
      isUpdatingShippingData,
    });
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
    getBillingFields: getBillingAddressFields,
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
