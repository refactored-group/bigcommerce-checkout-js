import { Cart, CheckoutSelectors } from '@bigcommerce/checkout-sdk';

import stripFFLFromCheckoutNotes from '../../order/stripFFLFromCheckoutNotes';
import { FflConsignmentCoordinator } from '../dealer/fflConsignmentCoordinator';

import discoverPickup from './discoverPickup';
import { hasNativePickup, matchesPickup, PickupChoice, pickupCartSignature } from './pickup';

export interface PickupState {
  intent: 'shipping' | 'pickup';
  choices: PickupChoice[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  signature?: string;
  draftMethodId?: number;
  confirmedSignature?: string;
  transitioning: boolean;
  message?: 'cart_changed' | 'availability_error' | 'save_error' | 'switch_error' | 'confirm_again';
}

export const initialPickupState: PickupState = {
  intent: 'shipping',
  choices: [],
  status: 'idle',
  transitioning: false,
};

interface Dependencies {
  coordinator: FflConsignmentCoordinator;
  getState(): CheckoutSelectors;
  onChange(state: PickupState): Promise<void>;
  onRequireDelivery(): void;
  onConfirmed(): void;
  onShipping(): void | Promise<void>;
  settleShipping(): Promise<void>;
  updateCheckout(body: { customerMessage: string }): Promise<CheckoutSelectors>;
  log(error: Error): void;
  discover?(cart: Cart, log: (error: Error) => void, signal?: AbortSignal): Promise<PickupChoice[]>;
}

// Local confirmation is deliberately not persisted. Native pickup survives a
// reload, but the shopper must reconfirm its eligibility before payment.
export default class PickupController {
  state: PickupState = { ...initialPickupState };
  private abort?: AbortController;
  private disposed = false;
  private operation = 0;
  private observedSignature?: string;

  constructor(private readonly deps: Dependencies) {}

  private change(patch: Partial<PickupState>): Promise<void> {
    this.state = { ...this.state, ...patch };

    return this.disposed ? Promise.resolve() : this.deps.onChange(this.state);
  }

  dispose(): void {
    this.disposed = true;
    this.operation += 1;
    this.abort?.abort();
  }

  reset(): void {
    this.operation += 1;
    this.abort?.abort();
    this.observedSignature = undefined;
    void this.change({
      ...initialPickupState,
      signature: undefined,
      confirmedSignature: undefined,
      draftMethodId: undefined,
      message: undefined,
    });
  }

  invalidate(): void {
    if (this.isPickup()) {
      this.operation += 1;
      void this.change({ confirmedSignature: undefined, message: 'confirm_again' });
      this.deps.onRequireDelivery();
      void this.refresh();
    }
  }

  isPickup(state = this.deps.getState()): boolean {
    return this.state.intent === 'pickup' || hasNativePickup(state.data.getConsignments());
  }

  isReady(state = this.deps.getState()): boolean {
    return (
      this.state.intent === 'pickup' &&
      !this.state.transitioning &&
      this.state.status === 'ready' &&
      !this.state.message &&
      this.state.confirmedSignature === this.state.signature &&
      this.state.choices.some(({ id }) => id === this.state.draftMethodId) &&
      matchesPickup(state, this.state.signature || '', this.state.draftMethodId) &&
      stripFFLFromCheckoutNotes(state.data.getCheckout()?.customerMessage) ===
        (state.data.getCheckout()?.customerMessage || '')
    );
  }

  observe(startDiscovery: boolean): void {
    const state = this.deps.getState();
    const cart = state.data.getCart();

    if (!cart || this.disposed) {
      return;
    }

    const signature = pickupCartSignature(cart);
    const changed = this.observedSignature !== undefined && this.observedSignature !== signature;
    const native = state.data
      .getConsignments()
      ?.find(({ selectedPickupOption }) => selectedPickupOption);

    this.observedSignature = signature;

    if (native && this.state.intent === 'shipping' && !this.state.transitioning) {
      void this.deps.coordinator.suspendShipping();
      this.deps.coordinator.deactivateHandoff();
      void this.change({
        intent: 'pickup',
        draftMethodId: native.selectedPickupOption?.pickupMethodId,
        confirmedSignature: undefined,
        message: 'confirm_again',
      });
      this.deps.onRequireDelivery();
    }

    if (changed && this.isPickup(state)) {
      this.operation += 1;
      void this.change({ confirmedSignature: undefined, message: 'cart_changed' });
      this.deps.onRequireDelivery();
    }

    if ((startDiscovery || this.isPickup(state)) && this.state.signature !== signature) {
      void this.refresh();
    }
  }

  async refresh(): Promise<void> {
    const cart = this.deps.getState().data.getCart();

    if (!cart || this.disposed) {
      return;
    }

    this.abort?.abort();
    const abort = new AbortController();
    this.abort = abort;
    const signature = pickupCartSignature(cart);

    await this.change({ status: 'loading', signature, confirmedSignature: undefined });

    try {
      const choices = await (this.deps.discover || discoverPickup)(
        cart,
        this.deps.log,
        abort.signal,
      );

      if (
        abort.signal.aborted ||
        this.disposed ||
        signature !== pickupCartSignature(this.deps.getState().data.getCart())
      ) {
        return;
      }

      const previous = this.state.draftMethodId;
      const draftMethodId = choices.some(({ id }) => id === previous)
        ? previous
        : this.state.intent === 'pickup' && choices.length === 1
        ? choices[0].id
        : undefined;

      await this.change({
        choices,
        draftMethodId,
        status: 'ready',
        message: this.state.message === 'availability_error' ? 'confirm_again' : this.state.message,
      });
    } catch (error) {
      if (abort.signal.aborted || this.disposed) {
        return;
      }

      this.deps.log(error instanceof Error ? error : new Error(String(error)));
      await this.change({
        status: 'error',
        choices: [],
        message: this.isPickup() ? 'availability_error' : undefined,
      });
    }
  }

  async choosePickup(message?: string): Promise<void> {
    if (
      this.state.transitioning ||
      this.state.status === 'error' ||
      (this.state.status === 'ready' && !this.state.choices.length)
    ) {
      return;
    }

    const settled = this.deps.coordinator.suspendShipping();
    await this.change({
      intent: 'pickup',
      confirmedSignature: undefined,
      transitioning: true,
      message: undefined,
      draftMethodId:
        this.state.status === 'ready' && this.state.choices.length === 1
          ? this.state.choices[0].id
          : undefined,
    });

    try {
      // An early pickup click can precede the first background discovery.
      // observe reuses the request already in flight for this cart.
      this.observe(true);
      // onChange resolves after React unmounts the old shipping form and
      // cancels its debounce; then wait for mutations already in flight.
      await settled;
      await this.deps.settleShipping();
      await this.cleanComments(message);
      await this.change({ transitioning: false });
    } catch (error) {
      this.deps.log(error instanceof Error ? error : new Error(String(error)));
      await this.change({ transitioning: false, message: 'save_error' });
    }
  }

  chooseMethod(draftMethodId: number): void {
    if (!this.state.transitioning) {
      void this.change({ draftMethodId, confirmedSignature: undefined, message: undefined });
    }
  }

  private async cleanComments(
    message = this.deps.getState().data.getCheckout()?.customerMessage || '',
  ): Promise<void> {
    const cleaned = stripFFLFromCheckoutNotes(message);

    if (cleaned !== this.deps.getState().data.getCheckout()?.customerMessage) {
      await this.deps.updateCheckout({ customerMessage: cleaned });
    }
  }

  async confirm(message?: string): Promise<void> {
    const { draftMethodId, signature, status, transitioning, choices } = this.state;
    const cart = this.deps.getState().data.getCart();

    if (transitioning || status !== 'ready' || !draftMethodId || !signature || !cart) {
      return;
    }

    const operation = ++this.operation;
    await this.change({ transitioning: true, confirmedSignature: undefined, message: undefined });

    try {
      await this.deps.coordinator.suspendShipping();
      await this.deps.settleShipping();
      const result = await this.deps.coordinator.selectPickup(
        cart.id,
        signature,
        draftMethodId,
        choices.map(({ id }) => id),
      );

      if (result.status !== 'fulfilled') {
        throw result.status === 'failed'
          ? result.error
          : new Error('Pickup selection was superseded');
      }

      await this.cleanComments(message);

      if (
        operation !== this.operation ||
        !matchesPickup(this.deps.getState(), signature, draftMethodId)
      ) {
        throw new Error('Cart changed during pickup confirmation');
      }

      await this.change({ transitioning: false, confirmedSignature: signature });
      this.deps.onConfirmed();
    } catch (error) {
      this.deps.log(error instanceof Error ? error : new Error(String(error)));
      await this.change({
        transitioning: false,
        confirmedSignature: undefined,
        message: 'save_error',
      });
      await this.refresh();
    }
  }

  async chooseShipping(message?: string): Promise<void> {
    if (this.state.transitioning) {
      return;
    }

    this.operation += 1;
    await this.change({ transitioning: true, confirmedSignature: undefined });

    try {
      await this.deps.coordinator.suspendShipping();
      await this.deps.settleShipping();
      await this.cleanComments(message);
      const state = this.deps.getState();
      const cart = state.data.getCart();

      if (cart && hasNativePickup(state.data.getConsignments())) {
        const result = await this.deps.coordinator.clearAll(cart.id);

        if (result.status !== 'fulfilled') {
          throw result.status === 'failed'
            ? result.error
            : new Error('Pickup cleanup was superseded');
        }
      }

      await this.deps.onShipping();
      this.deps.coordinator.resumeShipping();
      await this.change({
        intent: 'shipping',
        transitioning: false,
        draftMethodId: undefined,
        message: undefined,
      });

      if (!this.deps.getState().data.getCart()?.lineItems.physicalItems.length) {
        this.deps.onConfirmed();
      }
    } catch (error) {
      this.deps.log(error instanceof Error ? error : new Error(String(error)));
      await this.change({ intent: 'pickup', transitioning: false, message: 'switch_error' });
    }
  }

  async preflight(state: CheckoutSelectors): Promise<void> {
    if (!this.isPickup(state)) {
      return;
    }

    // Cleanup precedes either payment submit path, even when stale parent
    // props still contain a previously selected FFL.
    await this.cleanComments();
    this.deps.coordinator.deactivateHandoff();

    if (!this.isReady(this.deps.getState())) {
      this.observe(true);
      this.deps.onRequireDelivery();
      throw new Error('Please confirm your pickup location in Shipping before paying.');
    }
  }
}
