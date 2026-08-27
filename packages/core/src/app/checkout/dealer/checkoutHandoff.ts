import { Address, AddressRequestBody, CheckoutSelectors } from '@bigcommerce/checkout-sdk';

export interface CheckoutHandoffContext {
  cartId: string;
  storeHash: string;
}

export interface CheckoutHandoffState {
  active: boolean;
  consumed: boolean;
  dealerId?: string;
  revision: number;
}

export interface CheckoutHandoffUpdate {
  active: boolean;
  dealerId?: string | number;
  expectedRevision: number;
  operationId: string;
}

export interface CheckoutHandoffConfirmation {
  dealerId: string | number;
  expectedRevision: number;
  orderId: string | number;
}

export interface CheckoutHandoffClient {
  load(context: CheckoutHandoffContext): Promise<CheckoutHandoffState>;
  confirm(
    context: CheckoutHandoffContext,
    confirmation: CheckoutHandoffConfirmation,
  ): Promise<CheckoutHandoffState>;
  update(
    context: CheckoutHandoffContext,
    update: CheckoutHandoffUpdate,
  ): Promise<CheckoutHandoffState>;
}

export type CheckoutHandoffIntent =
  | {
      active: true;
      dealerId: string | number;
      destination: AddressRequestBody;
      itemIds: string[];
    }
  | {
      active: false;
      previousDealerId?: string | number;
      previousDestination?: AddressRequestBody;
    };

interface CheckoutHandoffPublisherDependencies {
  client: CheckoutHandoffClient;
  createOperationId?(): string;
  getCheckoutState(): CheckoutSelectors;
  matchesDestination(addressA?: Partial<Address>, addressB?: Partial<Address>): boolean;
  maxAttempts?: number;
  onError?(error: Error): void;
  refreshCheckout(cartId: string): Promise<CheckoutSelectors>;
  storage?: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
  wait?(milliseconds: number): Promise<void>;
}

export interface CheckoutHandoffPublisher {
  confirmOrder(orderId: string | number): Promise<void>;
  configure(context: CheckoutHandoffContext): void;
  dispose(): void;
  publish(intent: CheckoutHandoffIntent, confirmedCheckoutState?: CheckoutSelectors): void;
}

interface CheckoutHandoffResponseBody {
  active?: unknown;
  consumed?: unknown;
  dealer_id?: unknown;
  error?: unknown;
  revision?: unknown;
}

interface ConfirmableHandoffIntent {
  destination: Partial<Address>;
  itemIds: string[];
}

interface StoredHandoffConfirmation extends ConfirmableHandoffIntent {
  dealerId: string;
  revision: number;
}

export class CheckoutHandoffHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly state?: CheckoutHandoffState,
    public readonly retryAfterMilliseconds?: number,
    message = `Checkout handoff request failed with status ${status}`,
  ) {
    super(message);
    this.name = 'CheckoutHandoffHttpError';
    Object.setPrototypeOf(this, CheckoutHandoffHttpError.prototype);
  }
}

const parseState = (body: CheckoutHandoffResponseBody): CheckoutHandoffState | undefined => {
  if (
    typeof body.revision !== 'number' ||
    body.revision < 0 ||
    typeof body.active !== 'boolean' ||
    typeof body.consumed !== 'boolean'
  ) {
    return undefined;
  }

  return {
    active: body.active,
    consumed: body.consumed,
    dealerId:
      typeof body.dealer_id === 'string' || typeof body.dealer_id === 'number'
        ? String(body.dealer_id)
        : undefined,
    revision: body.revision,
  };
};

const usStateCodes: Record<string, string> = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  'DISTRICT OF COLUMBIA': 'DC',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY',
};

const normalizeHandoffText = (value: unknown): string =>
  (value === undefined || value === null ? '' : String(value))
    .normalize('NFC')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const normalizeCountry = (address: Partial<Address>): string => {
  const country = normalizeHandoffText(address.countryCode || address.country);

  return ['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(country)
    ? 'US'
    : country.replace(/ /g, '');
};

const normalizeState = (address: Partial<Address>): string => {
  const state = normalizeHandoffText(address.stateOrProvinceCode || address.stateOrProvince);

  // Keep this candidate-only comparison aligned with the backend's canonical
  // BigCommerce destination normalization. Final order proof still belongs to
  // the backend and is never inferred from this browser comparison.
  return usStateCodes[state] || state;
};

const normalizePostalCode = (address: Partial<Address>, country: string): string => {
  const postalCode = normalizeHandoffText(address.postalCode);

  if (country === 'US') {
    const digits = postalCode.replace(/[^0-9]/g, '');

    return digits.length >= 5 ? digits.slice(0, 5) : digits;
  }

  return postalCode.replace(/ /g, '');
};

const normalizeHandoffDestination = (address: Partial<Address>) => {
  const country = normalizeCountry(address);

  return {
    address1: normalizeHandoffText(address.address1),
    address2: normalizeHandoffText(address.address2),
    city: normalizeHandoffText(address.city),
    country,
    postalCode: normalizePostalCode(address, country),
    state: normalizeState(address),
  };
};

export const isSameCheckoutHandoffDestination = (
  addressA?: Partial<Address>,
  addressB?: Partial<Address>,
): boolean => {
  if (!addressA || !addressB) {
    return false;
  }

  const destinationA = normalizeHandoffDestination(addressA);
  const destinationB = normalizeHandoffDestination(addressB);

  return Object.keys(destinationA).every(
    (field) =>
      destinationA[field as keyof typeof destinationA] ===
      destinationB[field as keyof typeof destinationB],
  );
};

const parseRetryAfterMilliseconds = (response: Response): number | undefined => {
  const retryAfter = response.headers.get('retry-after');

  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);

  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
};

const readResponseBody = async (response: Response): Promise<CheckoutHandoffResponseBody> => {
  try {
    return (await response.json()) as CheckoutHandoffResponseBody;
  } catch (_error) {
    return {};
  }
};

export const createCheckoutHandoffClient = (baseUrl: string): CheckoutHandoffClient => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const endpoint = ({ cartId }: CheckoutHandoffContext) =>
    `${normalizedBaseUrl}/big_commerce/api/checkouts/${encodeURIComponent(cartId)}/handoff`;

  const request = async (
    context: CheckoutHandoffContext,
    init: RequestInit,
    path = '',
  ): Promise<CheckoutHandoffState> => {
    const response = await fetch(`${endpoint(context)}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'store-hash': context.storeHash,
        ...init.headers,
      },
    });
    const body = await readResponseBody(response);
    const state = parseState(body);

    if (!response.ok) {
      const message = typeof body.error === 'string' ? body.error : undefined;

      throw new CheckoutHandoffHttpError(
        response.status,
        state,
        parseRetryAfterMilliseconds(response),
        message,
      );
    }

    if (!state) {
      throw new Error('Automatic FFL received an invalid checkout handoff response');
    }

    return state;
  };

  return {
    load: (context) => request(context, { method: 'GET' }),
    confirm: (context, confirmation) =>
      request(
        context,
        {
          body: JSON.stringify({
            dealer_id: confirmation.dealerId,
            expected_revision: confirmation.expectedRevision,
            order_id: String(confirmation.orderId),
          }),
          keepalive: true,
          method: 'POST',
        },
        '/confirmation',
      ),
    update: (context, update) =>
      request(context, {
        body: JSON.stringify({
          active: update.active,
          dealer_id: update.active ? update.dealerId : undefined,
          expected_revision: update.expectedRevision,
          operation_id: update.operationId,
        }),
        keepalive: true,
        method: 'PUT',
      }),
  };
};

const defaultWait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const createOperationId = (): string => {
  const randomValues = new Uint32Array(4);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    randomValues.forEach((_value, index) => {
      randomValues[index] = Math.floor(Math.random() * 0xffffffff);
    });
  }

  return `checkout-${Date.now().toString(36)}-${Array.from(randomValues)
    .map((value) => value.toString(36))
    .join('-')}`;
};

const isRetryable = (error: unknown): boolean =>
  !(error instanceof CheckoutHandoffHttpError) || error.status === 429 || error.status >= 500;

const toError = (error: unknown): Error =>
  error instanceof Error
    ? error
    : new Error(`Automatic FFL checkout handoff failed: ${String(error)}`);

const hasMatchingConsignment = (
  checkoutState: CheckoutSelectors,
  cartId: string,
  destination: Partial<Address>,
  itemIds: string[],
  matchesDestination: CheckoutHandoffPublisherDependencies['matchesDestination'],
): boolean => {
  const cart = checkoutState?.data?.getCart?.();

  if (cart?.id !== cartId) {
    return false;
  }

  const consignments = checkoutState.data.getConsignments?.() || [];
  const activeItemIds = new Set(cart.lineItems.physicalItems.map((item) => String(item.id)));
  const requiredItemIds = itemIds.filter((itemId) => activeItemIds.has(itemId));

  if (itemIds.length === 0) {
    return consignments.some((consignment) =>
      matchesDestination(consignment.shippingAddress, destination),
    );
  }

  return (
    requiredItemIds.length > 0 &&
    requiredItemIds.every((itemId) => {
      const owners = consignments.filter((consignment) =>
        consignment.lineItemIds.some((lineItemId) => String(lineItemId) === itemId),
      );

      return owners.length === 1 && matchesDestination(owners[0].shippingAddress, destination);
    })
  );
};

const getSessionStorage = (): Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> | undefined => {
  try {
    return globalThis.sessionStorage;
  } catch (_error) {
    return undefined;
  }
};

const storedDestination = (destination: Partial<Address>): Partial<Address> => ({
  address1: destination.address1,
  address2: destination.address2,
  city: destination.city,
  country: destination.country,
  countryCode: destination.countryCode,
  postalCode: destination.postalCode,
  stateOrProvince: destination.stateOrProvince,
  stateOrProvinceCode: destination.stateOrProvinceCode,
});

const parseStoredConfirmation = (value: string | null): StoredHandoffConfirmation | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const candidate = JSON.parse(value) as Partial<StoredHandoffConfirmation>;

    if (
      typeof candidate.dealerId !== 'string' ||
      candidate.dealerId.length === 0 ||
      !Number.isInteger(candidate.revision) ||
      (candidate.revision as number) < 0 ||
      !candidate.destination ||
      typeof candidate.destination !== 'object' ||
      Array.isArray(candidate.destination) ||
      !Array.isArray(candidate.itemIds) ||
      candidate.itemIds.length === 0 ||
      !candidate.itemIds.every((itemId) => typeof itemId === 'string')
    ) {
      return undefined;
    }

    return candidate as StoredHandoffConfirmation;
  } catch (_error) {
    return undefined;
  }
};

export const createCheckoutHandoffPublisher = (
  dependencies: CheckoutHandoffPublisherDependencies,
): CheckoutHandoffPublisher => {
  const maxAttempts = dependencies.maxAttempts ?? 4;
  const wait = dependencies.wait ?? defaultWait;
  const nextOperationId = dependencies.createOperationId ?? createOperationId;
  const storage = dependencies.storage ?? getSessionStorage();
  const reportError =
    dependencies.onError ??
    ((error: Error) => {
      // Attribution reliability must never block checkout. Operational failures
      // remain visible to browser monitoring without becoming shopper errors.
      console.error('Automatic FFL could not synchronize the checkout handoff', error);
    });

  let configurationGeneration = 0;
  let active: boolean | undefined;
  let confirmableDealerId: string | undefined;
  let confirmableIntent: ConfirmableHandoffIntent | undefined;
  let confirmablePublication: number | undefined;
  let confirmableRevision: number | undefined;
  let context: CheckoutHandoffContext | undefined;
  let consumed = false;
  let disposed = false;
  let initializationPromise: Promise<void> | undefined;
  let publishGeneration = 0;
  let queue: Promise<void> = Promise.resolve();
  let revision: number | undefined;

  const storageKey = (activeContext: CheckoutHandoffContext): string =>
    `automatic-ffl:bigcommerce:handoff:${activeContext.storeHash}:${activeContext.cartId}`;

  const removeStoredConfirmation = (activeContext: CheckoutHandoffContext): void => {
    try {
      storage?.removeItem(storageKey(activeContext));
    } catch (_error) {
      // Storage can be disabled by the browser. Same-page confirmation still works.
    }
  };

  const storeConfirmation = (
    activeContext: CheckoutHandoffContext,
    confirmation: StoredHandoffConfirmation,
  ): void => {
    try {
      storage?.setItem(storageKey(activeContext), JSON.stringify(confirmation));
    } catch (_error) {
      // Storage can be disabled or full. Same-page confirmation still works.
    }
  };

  const readStoredConfirmation = (
    activeContext: CheckoutHandoffContext,
  ): StoredHandoffConfirmation | undefined => {
    try {
      const value = storage?.getItem(storageKey(activeContext)) ?? null;
      const confirmation = parseStoredConfirmation(value);

      if (value && !confirmation) {
        removeStoredConfirmation(activeContext);
      }

      return confirmation;
    } catch (_error) {
      return undefined;
    }
  };

  const isCurrent = (configuration: number, publication?: number): boolean =>
    !disposed &&
    configuration === configurationGeneration &&
    (publication === undefined || publication === publishGeneration);

  const retryDelay = (attempt: number, error: unknown): number =>
    error instanceof CheckoutHandoffHttpError && error.retryAfterMilliseconds !== undefined
      ? error.retryAfterMilliseconds
      : 250 * 2 ** attempt;

  const initialize = async (configuration: number): Promise<void> => {
    if (!context || revision !== undefined || consumed || !isCurrent(configuration)) {
      return;
    }

    if (initializationPromise) {
      return initializationPromise;
    }

    const activeContext = context;
    const promise = (async () => {
      let lastError: unknown;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!isCurrent(configuration)) {
          return;
        }

        try {
          const state = await dependencies.client.load(activeContext);

          if (isCurrent(configuration)) {
            active = state.active;
            revision = state.revision;
            consumed = state.consumed;

            const stored = readStoredConfirmation(activeContext);

            if (
              stored &&
              state.active &&
              !state.consumed &&
              state.dealerId === stored.dealerId &&
              state.revision === stored.revision
            ) {
              confirmableDealerId = stored.dealerId;
              confirmableIntent = {
                destination: stored.destination,
                itemIds: stored.itemIds,
              };
              confirmablePublication = publishGeneration;
              confirmableRevision = stored.revision;
            } else if (stored) {
              removeStoredConfirmation(activeContext);
            }
          }

          return;
        } catch (error) {
          lastError = error;

          if (!isRetryable(error) || attempt === maxAttempts - 1) {
            throw error;
          }

          await wait(retryDelay(attempt, error));
        }
      }

      throw lastError;
    })();

    initializationPromise = promise;

    try {
      await promise;
    } finally {
      if (initializationPromise === promise) {
        initializationPromise = undefined;
      }
    }
  };

  const canRetryStaleIntent = async (
    intent: CheckoutHandoffIntent,
    staleState: CheckoutHandoffState,
    activeContext: CheckoutHandoffContext,
    configuration: number,
    publication: number,
  ): Promise<boolean> => {
    let checkoutState: CheckoutSelectors | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (!isCurrent(configuration, publication)) {
        return false;
      }

      try {
        checkoutState = await dependencies.refreshCheckout(activeContext.cartId);
        break;
      } catch (error) {
        if (!isRetryable(error) || attempt === maxAttempts - 1) {
          throw error;
        }

        await wait(retryDelay(attempt, error));
      }
    }

    if (!checkoutState || !isCurrent(configuration, publication)) {
      return false;
    }

    if (intent.active) {
      return hasMatchingConsignment(
        checkoutState,
        activeContext.cartId,
        intent.destination,
        intent.itemIds,
        dependencies.matchesDestination,
      );
    }

    if (intent.previousDealerId === undefined || !intent.previousDestination) {
      return false;
    }

    return (
      staleState.dealerId === String(intent.previousDealerId) &&
      !hasMatchingConsignment(
        checkoutState,
        activeContext.cartId,
        intent.previousDestination,
        [],
        dependencies.matchesDestination,
      )
    );
  };

  const publish = (
    intent: CheckoutHandoffIntent,
    confirmedCheckoutState?: CheckoutSelectors,
  ): void => {
    const publication = ++publishGeneration;
    const configuration = configurationGeneration;
    const activeContext = context;

    // A newer cart intent invalidates final-order confirmation immediately,
    // even if its handoff request later fails or is superseded.
    confirmableDealerId = undefined;
    confirmableIntent = undefined;
    confirmablePublication = undefined;
    confirmableRevision = undefined;

    if (!activeContext || disposed) {
      return;
    }

    removeStoredConfirmation(activeContext);

    const operation = async () => {
      if (!isCurrent(configuration, publication)) {
        return;
      }

      try {
        await initialize(configuration);
      } catch (error) {
        if (isCurrent(configuration, publication)) {
          reportError(toError(error));
        }

        return;
      }

      if (!isCurrent(configuration, publication) || revision === undefined || consumed) {
        return;
      }

      if (!intent.active && active === false) {
        return;
      }

      if (
        intent.active &&
        !hasMatchingConsignment(
          confirmedCheckoutState || dependencies.getCheckoutState(),
          activeContext.cartId,
          intent.destination,
          intent.itemIds,
          dependencies.matchesDestination,
        )
      ) {
        return;
      }

      const operationId = nextOperationId();
      let lastError: unknown;
      let staleRetries = 0;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!isCurrent(configuration, publication) || revision === undefined || consumed) {
          return;
        }

        try {
          const state: CheckoutHandoffState = await dependencies.client.update(activeContext, {
            active: intent.active,
            dealerId: intent.active ? intent.dealerId : undefined,
            expectedRevision: revision,
            operationId,
          });

          if (isCurrent(configuration)) {
            active = state.active;
            revision = state.revision;
            consumed = state.consumed;
          }

          if (
            isCurrent(configuration, publication) &&
            intent.active &&
            state.active &&
            state.dealerId === String(intent.dealerId)
          ) {
            confirmableDealerId = state.dealerId;
            confirmableIntent = {
              destination: intent.destination,
              itemIds: intent.itemIds,
            };
            confirmablePublication = publication;
            confirmableRevision = state.revision;
            storeConfirmation(activeContext, {
              dealerId: state.dealerId,
              destination: storedDestination(intent.destination),
              itemIds: intent.itemIds,
              revision: state.revision,
            });
          }

          return;
        } catch (error) {
          lastError = error;

          if (!isCurrent(configuration)) {
            return;
          }

          if (
            error instanceof CheckoutHandoffHttpError &&
            error.status === 409 &&
            error.message === 'handoff_consumed'
          ) {
            consumed = true;
            return;
          }

          if (error instanceof CheckoutHandoffHttpError && error.status === 409 && error.state) {
            active = error.state.active;
            revision = error.state.revision;
            consumed = error.state.consumed;
            staleRetries += 1;

            if (consumed || !isCurrent(configuration, publication)) {
              return;
            }

            if (staleRetries > 2) {
              reportError(toError(error));
              return;
            }

            if (
              !(await canRetryStaleIntent(
                intent,
                error.state,
                activeContext,
                configuration,
                publication,
              ))
            ) {
              return;
            }

            continue;
          }

          if (!isCurrent(configuration, publication)) {
            return;
          }

          if (!isRetryable(error) || attempt === maxAttempts - 1) {
            break;
          }

          await wait(retryDelay(attempt, error));
        }
      }

      if (isCurrent(configuration, publication)) {
        reportError(toError(lastError));
      }
    };

    const result = queue.then(operation);
    queue = result.catch((error) => {
      if (isCurrent(configuration, publication)) {
        reportError(toError(error));
      }
    });
  };

  const confirmOrder = (orderId: string | number): Promise<void> => {
    const publication = publishGeneration;
    const configuration = configurationGeneration;
    const activeContext = context;

    if (!activeContext || disposed) {
      return Promise.resolve();
    }

    const confirmationCandidate = (): StoredHandoffConfirmation | undefined => {
      if (
        confirmablePublication === publication &&
        confirmableDealerId !== undefined &&
        confirmableIntent !== undefined &&
        confirmableRevision !== undefined
      ) {
        return {
          dealerId: confirmableDealerId,
          destination: confirmableIntent.destination,
          itemIds: confirmableIntent.itemIds,
          revision: confirmableRevision,
        };
      }

      // A hosted payment return has the exact dealer and server revision in
      // tab-scoped storage. The confirmation endpoint performs the same exact
      // active/dealer/revision checks, so a preliminary GET would only delay
      // navigation without adding an integrity boundary.
      return readStoredConfirmation(activeContext);
    };

    const operation = async (candidate: StoredHandoffConfirmation) => {
      if (!isCurrent(configuration, publication)) {
        return;
      }

      // The cart can still change after a successful handoff publication. Use
      // the SDK's retained checkout state to make sure at least one of the
      // routed FFL items still belongs to the verified dealer consignment at
      // the instant BigCommerce reports the order ID. If the state is missing
      // or no longer matches, undercount instead of confirming a stale dealer.
      if (
        !hasMatchingConsignment(
          dependencies.getCheckoutState(),
          activeContext.cartId,
          candidate.destination,
          candidate.itemIds,
          dependencies.matchesDestination,
        )
      ) {
        confirmableDealerId = undefined;
        confirmableIntent = undefined;
        confirmablePublication = undefined;
        confirmableRevision = undefined;
        removeStoredConfirmation(activeContext);
        return;
      }

      const confirmation = {
        dealerId: candidate.dealerId,
        expectedRevision: candidate.revision,
        orderId,
      };
      let lastError: unknown;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!isCurrent(configuration, publication)) {
          return;
        }

        try {
          const state = await dependencies.client.confirm(activeContext, confirmation);

          if (isCurrent(configuration, publication)) {
            active = state.active;
            revision = state.revision;
            consumed = state.consumed;
            removeStoredConfirmation(activeContext);
          }

          return;
        } catch (error) {
          lastError = error;

          if (
            !isCurrent(configuration, publication) ||
            !isRetryable(error) ||
            attempt === maxAttempts - 1
          ) {
            if (!isRetryable(error)) {
              removeStoredConfirmation(activeContext);
            }

            break;
          }

          await wait(retryDelay(attempt, error));
        }
      }

      if (isCurrent(configuration, publication)) {
        reportError(toError(lastError));
      }
    };

    const candidate = confirmationCandidate();

    // Calling the async operation directly starts the keepalive fetch before
    // returning to Checkout, which can then navigate without awaiting it.
    if (candidate) {
      return operation(candidate).catch((error) => {
        if (isCurrent(configuration, publication)) {
          reportError(toError(error));
        }
      });
    }

    // Preserve a best-effort fallback for an activation already in flight.
    // Checkout does not wait for this path before navigating.
    const result = queue.then(() => {
      const queuedCandidate = confirmationCandidate();

      return queuedCandidate ? operation(queuedCandidate) : undefined;
    });
    queue = result.catch((error) => {
      if (isCurrent(configuration, publication)) {
        reportError(toError(error));
      }
    });

    return result;
  };

  return {
    confirmOrder,
    configure: (nextContext) => {
      if (
        context?.cartId === nextContext.cartId &&
        context.storeHash === nextContext.storeHash &&
        !disposed
      ) {
        return;
      }

      const previousContext = context;

      if (
        previousContext &&
        (previousContext.cartId !== nextContext.cartId ||
          previousContext.storeHash !== nextContext.storeHash)
      ) {
        removeStoredConfirmation(previousContext);
      }

      disposed = false;
      configurationGeneration += 1;
      publishGeneration += 1;
      context = nextContext;
      active = undefined;
      confirmableDealerId = undefined;
      confirmableIntent = undefined;
      confirmablePublication = undefined;
      confirmableRevision = undefined;
      consumed = false;
      initializationPromise = undefined;
      revision = undefined;

      const configuration = configurationGeneration;
      // Initialization is speculative on checkout load. A real publication
      // retries it and owns error reporting, which avoids duplicate alerts when
      // configure() and publish() share the same in-flight request.
      void initialize(configuration).catch(() => undefined);
    },
    dispose: () => {
      disposed = true;
      configurationGeneration += 1;
      publishGeneration += 1;
      confirmableDealerId = undefined;
      confirmableIntent = undefined;
      confirmablePublication = undefined;
      confirmableRevision = undefined;
    },
    publish,
  };
};
