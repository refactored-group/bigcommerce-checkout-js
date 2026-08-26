// @ts-nocheck
import {
    Address,
    Cart,
    CartChangedError,
    CheckoutParams,
    CheckoutSelectors,
    Consignment,
    ConsignmentAssignmentRequestBody,
    EmbeddedCheckoutMessenger,
    EmbeddedCheckoutMessengerOptions,
    ExtensionRegion,
    FlashMessage,
    PaymentMethod,
    Promotion,
 RequestOptions } from '@bigcommerce/checkout-sdk';
import classNames from 'classnames';
import { find, findIndex } from 'lodash';
import React, { Component, lazy, ReactNode } from 'react';

import { AnalyticsContextProps } from '@bigcommerce/checkout/analytics';
import { Extension, ExtensionContextProps, withExtension } from '@bigcommerce/checkout/checkout-extension';
import { ErrorLogger } from '@bigcommerce/checkout/error-handling-utils';
import { TranslatedString, withLanguage, WithLanguageProps } from '@bigcommerce/checkout/locale';
import { AddressFormSkeleton, ChecklistSkeleton } from '@bigcommerce/checkout/ui';

import { withAnalytics } from '../analytics';
import { StaticBillingAddress } from '../billing';
import { EmptyCartMessage } from '../cart';
import { withCheckout } from '../checkout';
import { CustomError, ErrorModal, isCustomError } from '../common/error';
import { retry } from '../common/utility';
import {
    CheckoutButtonContainer,
    CheckoutSuggestion,
    Customer,
    CustomerInfo,
    CustomerSignOutEvent,
    CustomerViewType,
} from '../customer';
import { getSupportedMethodIds } from '../customer/getSupportedMethods';
import { SubscribeSessionStorage } from '../customer/SubscribeSessionStorage';
import { EmbeddedCheckoutStylesheet, isEmbedded } from '../embeddedCheckout';
import { PromotionBannerList } from '../promotion';
import { hasSelectedShippingOptions, isUsingMultiShipping, StaticConsignment } from '../shipping';
import { ShippingOptionExpiredError } from '../shipping/shippingOption';
import { LazyContainer, LoadingNotification, LoadingOverlay } from '../ui/loading';
import { MobileView } from '../ui/responsive';

import getFflLineItems from '../shipping/getFflLineItems';
import CheckoutStep from './CheckoutStep';
import CheckoutStepStatus from './CheckoutStepStatus';
import CheckoutStepType from './CheckoutStepType';
import getCheckoutStepStatuses from './getCheckoutStepStatuses';
import CheckoutSupport from './CheckoutSupport';
import mapToCheckoutProps from './mapToCheckoutProps';
import navigateToOrderConfirmation from './navigateToOrderConfirmation';
import withCheckout from './withCheckout';
import DealerShipping from './dealer/DealerShipping';
import { createCheckoutHandoffClient } from './dealer/checkoutHandoff';
import {
    createFflConsignmentCoordinator,
    FflConsignmentCoordinator,
} from './dealer/fflConsignmentCoordinator';
import { ConfirmedAmmoRoutingSession } from './dealer/utils';

const Billing = lazy(() =>
    retry(
        () =>
            import(
                /* webpackChunkName: "billing" */
                '../billing/Billing'
            ),
    ),
);

const CartSummary = lazy(() =>
    retry(
        () =>
            import(
                /* webpackChunkName: "cart-summary" */
                '../cart/CartSummary'
            ),
    ),
);

const CartSummaryDrawer = lazy(() =>
    retry(
        () =>
            import(
                /* webpackChunkName: "cart-summary-drawer" */
                '../cart/CartSummaryDrawer'
            ),
    ),
);

const Payment = lazy(() =>
    retry(
        () =>
            import(
                /* webpackChunkName: "payment" */
                '../payment/Payment'
            ),
    ),
);

const Shipping = lazy(() =>
    retry(
        () =>
            import(
                /* webpackChunkName: "shipping" */
                '../shipping/Shipping'
            ),
    ),
);

export const shouldForceFreshFflShippingStep = (
    steps: CheckoutStepStatus[],
): boolean => {
    const customerStep = find(steps, { type: CheckoutStepType.Customer });

    return Boolean(customerStep?.isComplete);
};

export const shouldRequireFreshFflSelection = (
    steps: CheckoutStepStatus[],
    hasFflRelatedItems: boolean,
    selectedFFL: any,
): boolean => {
    return (
        hasFflRelatedItems &&
        !selectedFFL &&
        shouldForceFreshFflShippingStep(steps)
    );
};

export const getCustomerIdentityKey = (customer?: { id: number; isGuest: boolean }): string =>
    customer ? `${customer.isGuest ? 'guest' : 'customer'}:${customer.id}` : 'customer:none';

export const shouldResetGuestFflShipping = (
    customer: { isGuest: boolean } | undefined,
    hasFflRelatedItems: boolean,
    consignments: Consignment[] = [],
): boolean => Boolean(customer?.isGuest && hasFflRelatedItems && consignments.length > 0);

export interface CheckoutProps {
    checkoutId: string;
    containerId: string;
    embeddedStylesheet: EmbeddedCheckoutStylesheet;
    embeddedSupport: CheckoutSupport;
    errorLogger: ErrorLogger;
    createEmbeddedMessenger(options: EmbeddedCheckoutMessengerOptions): EmbeddedCheckoutMessenger;
}

export interface CheckoutState {
    activeStepType?: CheckoutStepType;
    isBillingSameAsShipping: boolean;
    customerViewType?: CustomerViewType;
    defaultStepType?: CheckoutStepType;
    error?: Error;
    flashMessages?: FlashMessage[];
    isMultiShippingMode: boolean;
    isCartEmpty: boolean;
    isRedirecting: boolean;
    hasSelectedShippingOptions: boolean;
    isSubscribed: boolean;
    fflLineItems: LineItem[];
    storeHash: string;
    selectedFFL: any;
    fflToOrderComments: boolean;
    requiresFreshFflSelection: boolean;
    withAmmoSubscription: boolean;
    buttonConfigs: PaymentMethod[];
    confirmedAmmoRoutingSession?: ConfirmedAmmoRoutingSession;
    customerAddressSelection?: Address;
    hasFflRelatedItems: boolean;
    isResolvingFflShipping: boolean;
}

export interface WithCheckoutProps {
    billingAddress?: Address;
    cart?: Cart;
    consignments?: Consignment[];
    error?: Error;
    hasCartChanged: boolean;
    flashMessages?: FlashMessage[];
    isGuestEnabled: boolean;
    isLoadingCheckout: boolean;
    isPending: boolean;
    isPriceHiddenFromGuests: boolean;
    isShowingWalletButtonsOnTop: boolean;
    loginUrl: string;
    cartUrl: string;
    createAccountUrl: string;
    promotions?: Promotion[];
    steps: CheckoutStepStatus[];
    clearError(error?: Error): void;
    loadCheckout(id: string, options?: RequestOptions<CheckoutParams>): Promise<CheckoutSelectors>;
    loadPaymentMethodByIds(methodIds: string[]): Promise<CheckoutSelectors>;
    subscribeToConsignments(subscriber: (state: CheckoutSelectors) => void): () => void;
    subscribeToLogin(subscriber: (state: CheckoutSelectors) => void): () => void;
    assignItemsToAddress(
        consignment: ConsignmentAssignmentRequestBody,
    ): Promise<CheckoutSelectors>;
    loadShippingAddressFields(): Promise<CheckoutSelectors>;
    loadShippingOptions(): Promise<CheckoutSelectors>;
    deleteConsignment(id: string): Promise<CheckoutSelectors>;
    getCheckoutState(): CheckoutSelectors;
    unassignItemsToAddress(
        consignment: ConsignmentAssignmentRequestBody,
    ): Promise<CheckoutSelectors>;
}

export class Checkout extends Component<
    CheckoutProps &
        WithCheckoutProps &
        WithLanguageProps &
        AnalyticsContextProps &
        ExtensionContextProps,
    CheckoutState
> {
    state: CheckoutState = {
        selectedFFL: null,
        requiresFreshFflSelection: false,
        fflLineItems: [],
        fflProducts: [],
        fflStateRestrictedItems: [],
        hasSelectedShippingOptions: false,
        isBillingSameAsShipping: true,
        isBuyNowCartEnabled: false,
        isCartEmpty: false,
        isMultiShippingMode: false,
        isRedirecting: false,
        isSubscribed: false,
        storeHash: "",
        withAmmoSubscription: true,
        hasSelectedShippingOptions: false,
        isSubscribed: false,
        buttonConfigs: [],
        confirmedAmmoRoutingSession: undefined,
        customerAddressSelection: undefined,
        hasFflRelatedItems: false,
        isResolvingFflShipping: true,
    };

    private embeddedMessenger?: EmbeddedCheckoutMessenger;
    private unsubscribeFromConsignments?: () => void;
    private unsubscribeFromLogin?: () => void;
    private customerIdentityKey = 'customer:none';
    private customerIdentityResetKey?: string;
    private customerIdentityResetPromise: Promise<void> = Promise.resolve();
    private fflConsignmentCoordinator: FflConsignmentCoordinator =
        createFflConsignmentCoordinator({
            assignItemsToAddress: this.props.assignItemsToAddress,
            deleteConsignment: this.props.deleteConsignment,
            getState: this.props.getCheckoutState,
            handoffClient: createCheckoutHandoffClient(`https://${process.env.HOST}`),
            refreshCheckout: (cartId) =>
                this.props.loadCheckout(cartId, this.getCheckoutLoadOptions()),
            unassignItemsToAddress: this.props.unassignItemsToAddress,
        });
    private isFflRelatedCart = false;

    componentWillUnmount(): void {
        if (this.unsubscribeFromConsignments) {
            this.unsubscribeFromConsignments();
            this.unsubscribeFromConsignments = undefined;
        }
        if (this.unsubscribeFromLogin) {
            this.unsubscribeFromLogin();
            this.unsubscribeFromLogin = undefined;
        }

        window.removeEventListener('beforeunload', this.handleBeforeExit);
        this.fflConsignmentCoordinator.dispose();
        this.handleBeforeExit();
    }

    private getCheckoutLoadOptions = (): RequestOptions<CheckoutParams> => ({
        params: {
            include: [
                'cart.lineItems.physicalItems.categoryNames',
                'cart.lineItems.digitalItems.categoryNames',
            ] as any,
        },
    });

    private resetFflShippingState = async (
        initialState: CheckoutSelectors,
    ): Promise<CheckoutSelectors> => {
        const {
            loadShippingAddressFields,
            loadShippingOptions,
        } = this.props;
        const cart = initialState.data.getCart();

        if (!cart) {
            throw new Error('Automatic FFL could not resolve the active cart');
        }

        // Customer identity cleanup shares the same queue as every DealerShipping
        // mutation, so it sees and clears the result of any in-flight assignment.
        const result = await this.fflConsignmentCoordinator.clearAll(cart.id);

        if (result.status !== 'fulfilled') {
            throw result.status === 'failed'
                ? result.error
                : new Error('Automatic FFL shipping cleanup was superseded');
        }

        await Promise.all([loadShippingAddressFields(), loadShippingOptions()]);

        return result.checkoutState;
    };

    private queueCustomerIdentityReset = (
        checkoutState: CheckoutSelectors,
        identityKey = getCustomerIdentityKey(checkoutState.data.getCustomer()),
    ): Promise<void> => {
        if (!this.isFflRelatedCart) {
            return Promise.resolve();
        }

        if (this.customerIdentityResetKey === identityKey) {
            return this.customerIdentityResetPromise;
        }

        this.customerIdentityResetKey = identityKey;
        this.setState({
            isResolvingFflShipping: true,
            requiresFreshFflSelection: true,
        });

        this.customerIdentityResetPromise = this.customerIdentityResetPromise
            .catch(() => undefined)
            .then(async () => {
                await this.resetFflShippingState(checkoutState);

                if (this.customerIdentityKey === identityKey) {
                    this.setState({
                        confirmedAmmoRoutingSession: undefined,
                        customerAddressSelection: undefined,
                        isResolvingFflShipping: false,
                        selectedFFL: null,
                    });
                }
            })
            .catch((error) => {
                this.handleUnhandledError(error);
            });

        return this.customerIdentityResetPromise;
    };

    private handleCustomerIdentityChanged: (state: CheckoutSelectors) => void = (state) => {
        const identityKey = getCustomerIdentityKey(state.data.getCustomer());

        if (identityKey === this.customerIdentityKey) {
            return;
        }

        this.customerIdentityKey = identityKey;
        void this.queueCustomerIdentityReset(state, identityKey);
    };

    async componentDidMount(): Promise<void> {
        const {
            analyticsTracker,
            checkoutId,
            containerId,
            createEmbeddedMessenger,
            embeddedStylesheet,
            extensionService,
            loadCheckout,
            loadPaymentMethodByIds,
            subscribeToConsignments,
            subscribeToLogin,
        } = this.props;

        try {
            const [loadedCheckoutState] = await Promise.all([
                loadCheckout(checkoutId, this.getCheckoutLoadOptions()),
                extensionService.loadExtensions(),
            ]);
            let checkoutState = loadedCheckoutState;
            let data = checkoutState.data;
            this.customerIdentityKey = getCustomerIdentityKey(data.getCustomer());

            const providers = data.getConfig()?.checkoutSettings?.remoteCheckoutProviders || [];
            const supportedProviders = getSupportedMethodIds(providers);

            if (providers.length > 0) {
                const configs = await loadPaymentMethodByIds(supportedProviders);

                this.setState({
                    buttonConfigs: configs.data.getPaymentMethods() || [],
                });
            }

            extensionService.preloadExtensions();

            const { links: { siteLink = '' } = {} } = data.getConfig() || {};
            const errorFlashMessages = data.getFlashMessages('error') || [];
            const storeHash = data.getConfig()?.storeProfile.storeHash || '';
            this.setState({ storeHash });

            if (errorFlashMessages.length) {
                const { language } = this.props;

                this.setState({
                    error: new CustomError({
                        title:
                            errorFlashMessages[0].title ||
                            language.translate('common.error_heading'),
                        message: errorFlashMessages[0].message,
                        data: {},
                        name: 'default',
                    }),
                });
            }

            const messenger = createEmbeddedMessenger({ parentOrigin: siteLink });

            this.unsubscribeFromConsignments = subscribeToConsignments(
                this.handleConsignmentsUpdated,
            );
            this.unsubscribeFromLogin = subscribeToLogin(this.handleCustomerIdentityChanged);
            this.embeddedMessenger = messenger;
            messenger.receiveStyles((styles) => embeddedStylesheet.append(styles));
            messenger.postFrameLoaded({ contentId: containerId });
            messenger.postLoaded();

            analyticsTracker.checkoutBegin();

            let consignments = data.getConsignments();
            const cart = data.getCart();

            let hasFflRelatedItems = false;

            if (cart?.lineItems.physicalItems.length > 0) {
                try {
                    const [fflProducts, fflLineItems, fflStateRestrictedItems] =
                        await getFflLineItems(storeHash, cart);
                    hasFflRelatedItems =
                        fflLineItems.length > 0 || fflStateRestrictedItems.length > 0;
                    this.setState({ fflLineItems, fflProducts, fflStateRestrictedItems });
                } catch (error) {
                    this.setState({
                        error: new CustomError({
                            title: 'Error',
                            message:
                                'Contact customer support to verify your FFL if you have firearm related products in the cart',
                            data: {},
                            name: 'default',
                        }),
                    });

                    return;
                }
            }

            this.isFflRelatedCart = hasFflRelatedItems;
            this.setState({ hasFflRelatedItems });

            if (hasFflRelatedItems && cart) {
                this.fflConsignmentCoordinator.configureHandoff({
                    cartId: cart.id,
                    storeHash,
                });
            }

            if (shouldResetGuestFflShipping(data.getCustomer(), hasFflRelatedItems, consignments)) {
                this.customerIdentityResetKey = this.customerIdentityKey;
                checkoutState = await this.resetFflShippingState(checkoutState);
                data = checkoutState.data;
                consignments = data.getConsignments();
            }

            const hasMultiShippingEnabled =
                data.getConfig()?.checkoutSettings.hasMultiShippingEnabled;
            const checkoutBillingSameAsShippingEnabled =
                data.getConfig()?.checkoutSettings.checkoutBillingSameAsShippingEnabled ?? true;
            const defaultNewsletterSignupOption =
                data.getConfig()?.shopperConfig.defaultNewsletterSignup ??
                false;
            const isMultiShippingMode =
                !!cart &&
                !!consignments &&
                hasMultiShippingEnabled &&
                isUsingMultiShipping(consignments, cart.lineItems);

            this.setState({
                isBillingSameAsShipping: checkoutBillingSameAsShippingEnabled,
                isResolvingFflShipping: false,
                isSubscribed: defaultNewsletterSignupOption,
                requiresFreshFflSelection: hasFflRelatedItems && !this.state.selectedFFL,
            });

            const requiresFreshFflSelection = shouldRequireFreshFflSelection(
                getCheckoutStepStatuses(checkoutState),
                hasFflRelatedItems,
                this.state.selectedFFL,
            );
            const handleInitialReady = () => {
                if (requiresFreshFflSelection) {
                    this.navigateToStep(CheckoutStepType.Shipping, { isDefault: true });
                    return;
                }

                this.handleReady();
            };

            if (isMultiShippingMode) {
                this.setState({ isMultiShippingMode }, handleInitialReady);
            } else {
                handleInitialReady();
            }

            window.addEventListener('beforeunload', this.handleBeforeExit);

        } catch (error) {
            if (error instanceof Error) {
                this.handleUnhandledError(error);
            }
        }
    }

    render(): ReactNode {
        const { error } = this.state;
        let errorModal = null;

        if (error) {
            if (isCustomError(error)) {
                errorModal = (
                    <ErrorModal
                        error={error}
                        onClose={this.handleCloseErrorModal}
                        title={error.title}
                    />
                );
            } else {
                errorModal = <ErrorModal error={error} onClose={this.handleCloseErrorModal} />;
            }
        }

        return (
            <div className={classNames('remove-checkout-step-numbers', { 'is-embedded': isEmbedded() })} data-test="checkout-page-container" id="checkout-page-container">
                <div className="layout optimizedCheckout-contentPrimary">
                    {this.renderContent()}
                </div>
                {errorModal}
            </div>
        );
    }

    private renderContent(): ReactNode {
        const { isPending, loginUrl, promotions = [], steps, isShowingWalletButtonsOnTop, extensionState } = this.props;

        const {
            activeStepType,
            defaultStepType,
            isCartEmpty,
            isRedirecting,
            isResolvingFflShipping,
        } = this.state;

        if (isCartEmpty) {
            return <EmptyCartMessage loginUrl={loginUrl} waitInterval={3000} />;
        }

        const isPaymentStepActive = activeStepType
            ? activeStepType === CheckoutStepType.Payment
            : defaultStepType === CheckoutStepType.Payment;

        return (
            <LoadingOverlay
                hideContentWhenLoading
                isLoading={isRedirecting || isResolvingFflShipping}
                unmountContentWhenLoading
            >
                <div className="layout-main">
                    <LoadingNotification
                        isLoading={
                            (!isShowingWalletButtonsOnTop && isPending) ||
                            extensionState.isShowingLoadingIndicator
                        }
                    />

                    <PromotionBannerList promotions={promotions} />

                    {isShowingWalletButtonsOnTop && this.state.buttonConfigs?.length > 0 && (
                        <CheckoutButtonContainer
                            checkEmbeddedSupport={this.checkEmbeddedSupport}
                            isPaymentStepActive={isPaymentStepActive}
                            onUnhandledError={this.handleUnhandledError}
                            onWalletButtonClick={this.handleWalletButtonClick}
                        />
                    )}

                    <ol className="checkout-steps">
                        {steps
                            .filter((step) => step.isRequired)
                            .map((step) =>
                                this.renderStep({
                                    ...step,
                                    isActive: activeStepType
                                        ? activeStepType === step.type
                                        : defaultStepType === step.type,
                                    isBusy: isPending,
                                }),
                            )}
                    </ol>
                </div>

                {this.renderCartSummary()}
            </LoadingOverlay>
        );
    }

    private renderStep(step: CheckoutStepStatus): ReactNode {
        switch (step.type) {
            case CheckoutStepType.Customer:
                return this.renderCustomerStep(step);

            case CheckoutStepType.Shipping:
                return (this.state.fflLineItems || this.state.fflStateRestrictedItems) &&
                (this.state.fflLineItems.length > 0 || (this.state.fflStateRestrictedItems.length > 0 && this.state.withAmmoSubscription)) ?
                this.renderDealerShippingStep(step) :
                this.renderShippingStep(step);

            case CheckoutStepType.Billing:
                return this.renderBillingStep(step);

            case CheckoutStepType.Payment:
                return this.renderPaymentStep(step);

            default:
                return null;
        }
    }

    private renderCustomerStep(step: CheckoutStepStatus): ReactNode {
        const { isGuestEnabled, isShowingWalletButtonsOnTop } = this.props;
        const {
            customerViewType = isGuestEnabled ? CustomerViewType.Guest : CustomerViewType.Login,
            isSubscribed,
        } = this.state;

        return (
            <CheckoutStep
                {...step}
                heading={<TranslatedString id="customer.customer_heading" />}
                key={step.type}
                onEdit={this.handleEditStep}
                onExpanded={this.handleExpanded}
                suggestion={<CheckoutSuggestion />}
                summary={
                    <CustomerInfo
                        onSignOut={this.handleSignOut}
                        onSignOutError={this.handleError}
                    />
                }
            >
                <Customer
                    checkEmbeddedSupport={this.checkEmbeddedSupport}
                    isEmbedded={isEmbedded()}
                    isSubscribed={isSubscribed}
                    isWalletButtonsOnTop = {isShowingWalletButtonsOnTop }
                    onAccountCreated={this.navigateToNextIncompleteStep}
                    onChangeViewType={this.setCustomerViewType}
                    onContinueAsGuest={this.navigateToNextIncompleteStep}
                    onContinueAsGuestError={this.handleError}
                    onReady={this.handleReady}
                    onSignIn={this.navigateToNextIncompleteStep}
                    onSignInError={this.handleError}
                    onSubscribeToNewsletter={this.handleNewsletterSubscription}
                    onUnhandledError={this.handleUnhandledError}
                    onWalletButtonClick={this.handleWalletButtonClick}
                    step={step}
                    viewType={customerViewType}
                />
            </CheckoutStep>
        );
    }

    private renderShippingStep(step: CheckoutStepStatus): ReactNode {
        const { hasCartChanged, cart, consignments = [] } = this.props;

        const { isBillingSameAsShipping, isMultiShippingMode } = this.state;

        if (!cart) {
            return;
        }

        return (
            <CheckoutStep
                {...step}
                heading={<TranslatedString id="shipping.shipping_heading" />}
                key={step.type}
                onEdit={this.handleEditStep}
                onExpanded={this.handleExpanded}
                summary={consignments.map((consignment) => (
                    <div className="staticConsignmentContainer" key={consignment.id}>
                        <StaticConsignment
                            cart={cart}
                            compactView={consignments.length < 2}
                            consignment={consignment}
                        />
                    </div>
                ))}
            >
                <LazyContainer loadingSkeleton={<AddressFormSkeleton />}>
                    <Shipping
                        cartHasChanged={hasCartChanged}
                        isBillingSameAsShipping={isBillingSameAsShipping}
                        isMultiShippingMode={isMultiShippingMode}
                        navigateNextStep={this.handleShippingNextStep}
                        onCreateAccount={this.handleShippingCreateAccount}
                        onReady={this.handleReady}
                        onSignIn={this.handleShippingSignIn}
                        onToggleMultiShipping={this.handleToggleMultiShipping}
                        onUnhandledError={this.handleUnhandledError}
                        step={step}
                    />
                </LazyContainer>
            </CheckoutStep>
        );
    }

    private renderDealerShippingStep(step: CheckoutStepStatus): ReactNode {
          const {
              hasCartChanged,
              cart,
              consignments,
          } = this.props;

          const fflConsignmentItems = this.state.fflLineItems.map(fflItem => ({ itemId: fflItem.id, quantity: fflItem.quantity }));
          const stateRestrictedConsignmentItems = this.state.fflStateRestrictedItems.map(fflItem => ({ itemId: fflItem.id, quantity: fflItem.quantity }));

          if (!cart) {
              return;
          }

          return (
              <CheckoutStep
                  { ...step }
                  heading={ <TranslatedString id="shipping.ffl_shipping_heading" /> }
                  key={ step.type }
                  onEdit={ this.handleEditStep }
                  onExpanded={ this.handleExpanded }
                  summary={ consignments.map(consignment =>
                      <div className="staticConsignmentContainer" key={ consignment.id }>
                          <StaticConsignment
                              cart={ cart }
                              compactView={ consignments.length < 2 }
                              consignment={ consignment }
                          />
                      </div>) }
              >
                  <LazyContainer>
                    <DealerShipping
                        cartHasChanged={ hasCartChanged }
                        confirmedAmmoRoutingSession={ this.state.confirmedAmmoRoutingSession }
                        customerAddressSelection={ this.state.customerAddressSelection }
                        fflConsignmentCoordinator={ this.fflConsignmentCoordinator }
                        fflProducts={ this.state.fflProducts }
                        fflConsignmentItems={ fflConsignmentItems }
                        isMultiShippingMode={ true }
                        navigateNextStep={ this.handleShippingNextStep }
                        onCreateAccount={ this.handleShippingCreateAccount }
                        onSignIn={ this.handleShippingSignIn }
                        onToggleMultiShipping={ this.handleToggleMultiShipping }
                        onUnhandledError={ this.handleUnhandledError }
                        stateRestrictedConsignmentItems={ stateRestrictedConsignmentItems }
                        storeHash={ this.state.storeHash }
                        selectedFFL={ this.state.selectedFFL }
                        clearConfirmedAmmoRoutingSession={ this.clearConfirmedAmmoRoutingSession }
                        confirmAmmoRoutingSession={ this.confirmAmmoRoutingSession }
                        setSelectedFFL={ this.setSelectedFFL }
                        setCustomerAddressSelection={ this.setCustomerAddressSelection }
                        setFFLtoOrderComments={ this.setFFLtoOrderComments }
                        setWithAmmoSubscription={ this.setWithAmmoSubscription }
                    />
                  </LazyContainer>
              </CheckoutStep>
          );
        }

    private renderBillingStep(step: CheckoutStepStatus): ReactNode {
        const { billingAddress } = this.props;

        return (
            <CheckoutStep
                {...step}
                heading={<TranslatedString id="billing.billing_heading" />}
                key={step.type}
                onEdit={this.handleEditStep}
                onExpanded={this.handleExpanded}
                summary={billingAddress && <StaticBillingAddress address={billingAddress} />}
            >
                <LazyContainer loadingSkeleton={<AddressFormSkeleton />}>
                    <Billing
                        navigateNextStep={this.navigateToNextIncompleteStep}
                        onReady={this.handleReady}
                        onUnhandledError={this.handleUnhandledError}
                    />
                </LazyContainer>
            </CheckoutStep>
        );
    }

    private renderPaymentStep(step: CheckoutStepStatus): ReactNode {
        const { consignments, cart, errorLogger } = this.props;

        return (
            <CheckoutStep
                {...step}
                heading={<TranslatedString id="payment.payment_heading" />}
                key={step.type}
                onEdit={this.handleEditStep}
                onExpanded={this.handleExpanded}
            >
                <LazyContainer loadingSkeleton={<ChecklistSkeleton />}>
                    <Payment
                        checkEmbeddedSupport={this.checkEmbeddedSupport}
                        errorLogger={errorLogger}
                        isEmbedded={isEmbedded()}
                        isUsingMultiShipping={
                            cart && consignments
                                ? isUsingMultiShipping(consignments, cart.lineItems)
                                : false
                        }
                        onCartChangedError={this.handleCartChangedError}
                        onFinalize={this.navigateToOrderConfirmation}
                        onReady={this.handleReady}
                        onSubmit={this.navigateToOrderConfirmation}
                        onSubmitError={this.handleError}
                        onUnhandledError={this.handleUnhandledError}
                        storeHash={this.state.storeHash}
                        selectedFFL={this.state.selectedFFL}
                        fflToOrderComments={this.state.fflToOrderComments}
                    />
                </LazyContainer>
            </CheckoutStep>
        );
    }

    private renderCartSummary(): ReactNode {
        return (
            <MobileView>
                {(matched) => {
                    if (matched) {
                        return (
                            <LazyContainer>
                                <Extension region={ExtensionRegion.SummaryAfter} />
                                <CartSummaryDrawer />
                            </LazyContainer>
                        );
                    }

                    return (
                        <aside className="layout-cart">
                            <LazyContainer>
                                <CartSummary />
                                <Extension region={ExtensionRegion.SummaryAfter} />
                            </LazyContainer>
                        </aside>
                    );
                }}
            </MobileView>
        );
    }

    private navigateToStep(type: CheckoutStepType, options?: { isDefault?: boolean }): void {
        const { clearError, error, steps } = this.props;
        const { activeStepType } = this.state;
        const step = find(steps, { type });

        if (!step) {
            return;
        }

        if (activeStepType === step.type) {
            return;
        }

        if (options && options.isDefault) {
            this.setState({ defaultStepType: step.type });
        } else {
            this.setState({ activeStepType: step.type });
        }

        if (error) {
            clearError(error);
        }
    }

    private handleToggleMultiShipping: () => void = () => {
        const { isMultiShippingMode } = this.state;

        this.setState({ isMultiShippingMode: !isMultiShippingMode });
    };

    private navigateToNextIncompleteStep: (options?: { isDefault?: boolean }) => void = (
        options,
    ) => {
        const { steps, analyticsTracker } = this.props;
        const { requiresFreshFflSelection } = this.state;
        const activeStepIndex = findIndex(steps, { isActive: true });
        const activeStep = activeStepIndex >= 0 && steps[activeStepIndex];

        if (!activeStep) {
            return;
        }

        const previousStep = steps[Math.max(activeStepIndex - 1, 0)];

        if (previousStep) {
            analyticsTracker.trackStepCompleted(previousStep.type);
        }

        // BigCommerce can consider persisted consignments complete after a
        // refresh. Once the customer step is complete, force every FFL-related
        // checkout through Shipping until that step is successfully submitted.
        if (
            requiresFreshFflSelection &&
            shouldForceFreshFflShippingStep(steps)
        ) {
            this.navigateToStep(CheckoutStepType.Shipping, options);
            return;
        }

        this.navigateToStep(activeStep.type, options);
    };

    private navigateToOrderConfirmation: (orderId?: number) => void = (orderId) => {
        const { steps, analyticsTracker } = this.props;

        analyticsTracker.trackStepCompleted(steps[steps.length - 1].type);

        if (this.embeddedMessenger) {
            this.embeddedMessenger.postComplete();
        }

        SubscribeSessionStorage.removeSubscribeStatus();

        this.setState({ isRedirecting: true }, () => {
            navigateToOrderConfirmation(orderId);
        });
    };

    private checkEmbeddedSupport: (methodIds: string[]) => boolean = (methodIds) => {
        const { embeddedSupport } = this.props;

        return embeddedSupport.isSupported(...methodIds);
    };

    private handleCartChangedError: (error: CartChangedError) => void = () => {
        this.navigateToStep(CheckoutStepType.Shipping);
    };

    private handleConsignmentsUpdated: (state: CheckoutSelectors) => void = ({ data }) => {
        const { hasSelectedShippingOptions: prevHasSelectedShippingOptions, activeStepType, defaultStepType } =
            this.state;

        const { steps } = this.props;

        const newHasSelectedShippingOptions = hasSelectedShippingOptions(
            data.getConsignments() || [],
        );

        const isDefaultStepPaymentOrBilling =
            !activeStepType &&
            (defaultStepType === CheckoutStepType.Payment ||
                defaultStepType === CheckoutStepType.Billing);

        const isShippingStepFinished =
            findIndex(steps, { type: CheckoutStepType.Shipping }) <
                findIndex(steps, { type: activeStepType }) || isDefaultStepPaymentOrBilling;

        if (
            prevHasSelectedShippingOptions &&
            !newHasSelectedShippingOptions &&
            isShippingStepFinished
        ) {
            this.navigateToStep(CheckoutStepType.Shipping);
            this.setState({ error: new ShippingOptionExpiredError() });
        }

        this.setState({ hasSelectedShippingOptions: newHasSelectedShippingOptions });
    };

    private handleCloseErrorModal: () => void = () => {
        this.setState({ error: undefined });
    };

    private handleExpanded: (type: CheckoutStepType) => void = (type) => {
        const { analyticsTracker } = this.props;

        analyticsTracker.trackStepViewed(type);
    };

    private handleUnhandledError: (error: Error) => void = (error) => {
        this.handleError(error);

        // For errors that are not caught and handled by child components, we
        // handle them here by displaying a generic error modal to the shopper.
        this.setState({ error });
    };

    private handleError: (error: Error) => void = (error) => {
        const { errorLogger } = this.props;

        errorLogger.log(error);

        if (this.embeddedMessenger) {
            this.embeddedMessenger.postError(error);
        }
    };

    private handleEditStep: (type: CheckoutStepType) => void = (type) => {
        if (
            type !== CheckoutStepType.Customer &&
            type !== CheckoutStepType.Shipping &&
            this.state.requiresFreshFflSelection &&
            shouldForceFreshFflShippingStep(this.props.steps)
        ) {
            this.navigateToStep(CheckoutStepType.Shipping);
            return;
        }

        this.navigateToStep(type);
    };

    private handleReady: () => void = () => {
        this.navigateToNextIncompleteStep({ isDefault: true });
    };

    private handleNewsletterSubscription: (subscribed: boolean) => void = (subscribed) => {
        this.setState({ isSubscribed: subscribed });
    }

    private handleSignOut: (event: CustomerSignOutEvent) => Promise<void> = async ({
        checkoutState,
        isCartEmpty,
    }) => {
        const { loginUrl, cartUrl, isPriceHiddenFromGuests, isGuestEnabled } = this.props;

        if (checkoutState) {
            const identityKey = getCustomerIdentityKey(checkoutState.data.getCustomer());
            this.customerIdentityKey = identityKey;
            await this.queueCustomerIdentityReset(checkoutState, identityKey);
        } else {
            await this.customerIdentityResetPromise;
        }

        if (isPriceHiddenFromGuests) {
            if (window.top) {
                return (window.top.location.href = cartUrl);
            }
        }

        if (this.embeddedMessenger) {
            this.embeddedMessenger.postSignedOut();
        }

        if (isGuestEnabled) {
            this.setCustomerViewType(CustomerViewType.Guest);
        }

        if (isCartEmpty) {
            this.setState({ isCartEmpty: true });

            if (!isEmbedded()) {
                if (window.top) {
                    return window.top.location.assign(loginUrl);
                }
            }
        }

        this.navigateToStep(CheckoutStepType.Customer);
    };

    private handleShippingNextStep: (isBillingSameAsShipping: boolean) => void = (
        isBillingSameAsShipping,
    ) => {
        this.setState(
            {
                isBillingSameAsShipping,
                requiresFreshFflSelection: false,
            },
            () => {
                if (isBillingSameAsShipping) {
                    this.navigateToNextIncompleteStep();
                } else {
                    this.navigateToStep(CheckoutStepType.Billing);
                }
            },
        );
    };

    private handleShippingSignIn: () => void = () => {
        this.setCustomerViewType(CustomerViewType.Login);
    };

    private handleShippingCreateAccount: () => void = () => {
        this.setCustomerViewType(CustomerViewType.CreateAccount);
    };

    private setCustomerViewType: (viewType: CustomerViewType) => void = (customerViewType) => {
        const { createAccountUrl } = this.props;

        if (customerViewType === CustomerViewType.CreateAccount && isEmbedded()) {
            if (window.top) {
                window.top.location.replace(createAccountUrl);
            }

            return;
        }

        this.navigateToStep(CheckoutStepType.Customer);
        this.setState({ customerViewType });
    };

    private handleBeforeExit: () => void = () => {
        const { analyticsTracker } = this.props;

        analyticsTracker.exitCheckout();
    }

    private setSelectedFFL: () => void = (value) => {
        this.setState({ selectedFFL: value });
    }

    private setCustomerAddressSelection = (customerAddressSelection?: Address): void => {
        this.setState({ customerAddressSelection });
    };

    private confirmAmmoRoutingSession = (
        confirmedAmmoRoutingSession: ConfirmedAmmoRoutingSession,
    ): void => {
        const cartId = this.props.getCheckoutState()?.data?.getCart?.()?.id;

        if (
            confirmedAmmoRoutingSession.cartId !== cartId ||
            confirmedAmmoRoutingSession.customerIdentityKey !== this.customerIdentityKey
        ) {
            return;
        }

        this.setState({
            confirmedAmmoRoutingSession,
            customerAddressSelection: confirmedAmmoRoutingSession.confirmedCustomerAddress,
        });
    };

    private clearConfirmedAmmoRoutingSession = (): void => {
        this.setState({
            confirmedAmmoRoutingSession: undefined,
            customerAddressSelection: undefined,
        });
    };

    private setFFLtoOrderComments: () => void = (value) => {
        this.setState({ fflToOrderComments: value });
    }

    private setWithAmmoSubscription: () => void = (value) => {
        this.setState({ withAmmoSubscription: value });
    }

    private handleWalletButtonClick: (methodName: string) => void = (methodName) => {
        const { analyticsTracker } = this.props;

        analyticsTracker.walletButtonClick(methodName);
    }
}

export default withExtension(
    withAnalytics(withLanguage(withCheckout(mapToCheckoutProps)(Checkout))),
);
