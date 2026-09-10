# Native BigCommerce Store Pickup: MVP Plan

Plan of record, revised 2026-09-09. The MVP is implemented locally in `bigcommerce-checkout-js` on `staging`; merchant acceptance and deployment remain pending. This version uses one shared regular/FFL pickup flow with an explicit ZIP search.

## Goal

Let a shopper choose one of the merchant's eligible BigCommerce locations and collect every physical item in the order there. Use BigCommerce's native pickup methods, inventory eligibility, consignment, totals, and order fulfilment. Preserve the existing ordinary shipping and FFL shipping flows when the shopper chooses shipping.

The MVP journey is: **choose pickup → enter ZIP → search → choose a location/method → Continue → billing → payment**. Regular, firearm, ammunition, and mixed carts use the same pickup panel and the same commit operation. Each order uses one pickup location; mixed pickup/shipping is out of scope.

## MVP scope

| Include in the first release | Defer or exclude |
| --- | --- |
| ZIP search within 200 miles, up to five nearest eligible stores, one chosen per order | ZIP prefill, pagination controls, automatic radius expansion |
| Compact radio cards showing store, address, method, and native collection information | Nested store/method selectors, calculated opening hours, timezone logic |
| A linked store address opening destination-only directions | Embedded maps, browser location, driving distance/time |
| One shared pickup panel with commit on Continue | Separate regular/FFL pickup forms or immediate FFL commit on radio selection |
| Cart-change invalidation and explicit reconfirmation | Automatic background repair of pickup assignments after cart changes |
| Correct switching, payment gating, comment cleanup, and exclusion from dealer attribution | New scheduling, pickup-person, notification, or dealer-attribution features |

No SDK upgrade, new packages, dealer payload change, or FFL locator change. Merchants configure locations, pickup methods, and inventory in BigCommerce, and enable pickup in AutoFFL store settings. Existing stores default off; new stores default on. Discovery has no local ten-location restriction.

## Native foundation

The installed Checkout SDK is 1.658.1 and already supports pickup consignments. Prior testing established that a shipping consignment can be converted in place, that a pickup consignment retains the store's shipping address, and that a second pickup consignment alongside shipping is rejected. Detect pickup through `selectedPickupOption`, never through a missing address. Revalidate the relevant behaviours against the launch store during acceptance.

- [BigCommerce checkout and pickup consignments](https://docs.bigcommerce.com/developer/docs/integrations/platform-solutions/buy-online-pick-up-in-store/end-to-end-guide/manage-checkout-as-a-shopper)
- [BigCommerce storefront pickup eligibility](https://docs.bigcommerce.com/developer/api-reference/rest/storefront/pickup-options/post-pickup-options)

## Customer experience

### 1. Arriving at delivery

The existing sign-in/guest and customer-contact experience comes first. At the current shipping step, offer pickup when the AutoFFL store setting explicitly enables it. Eligibility is checked only after the shopper selects pickup and submits a ZIP. Ordinary shipping remains available, including after search errors or empty results.

When pickup is enabled, show a small choice above the form under **How would you like to receive your order?**:

- **Ship my order** — selected by default on a fresh checkout; shows the existing regular or FFL shipping form appropriate to the cart.
- **Pick up in store** — opens the shared pickup panel.

Retain the existing outer step heading. A store with no eligible methods shows the empty-search message after ZIP submission. Do not automatically put a fresh checkout into pickup mode merely because only one method is eligible.

Pickup must be available without a shipping address, without a carrier quote, and when the merchant has no carrier rates. A customer buying firearms sees the same pickup choice before needing to select a dealer. Choosing shipping still runs the existing FFL or ammunition routing rules.

### 2. Choosing pickup

Selecting **Pick up in store** replaces the shipping/dealer form with an initially empty ZIP field, regardless of store count. Do not prefill from customer, billing, shipping, FFL, or pickup addresses. Submitting a five-digit US ZIP finds eligible stores within 200 miles of its center and shows up to five distinct stores nearest first. The shopper is not asked to enter a home shipping address, choose a carrier, select an FFL, supply a dealer-recipient name, or choose an ammunition shipping state in this panel. Customer contact and billing information are still collected by the normal checkout steps.

Display **Choose one store for your order.** Every offered method must cover the whole physical cart. Digital items continue through their existing fulfilment process.

Each radio option shows:

- Store label, a two-line address, and compact approximate distance (for example, **0.8 miles**).
- Pickup method name, such as in-store or curbside, when it differs from the store label. Suppress duplicate names ignoring case and surrounding whitespace.
- BigCommerce's collection time description below the address. Show collection instructions in the selected option.
- The store address links to Google Maps directions for that destination in a separate tab, preserving the checkout. No shopper origin is collected or sent.

Sort by distance, then stable location/method IDs. The five-store limit preserves all returned eligible methods at those stores. If a store offers two methods, it appears as two labelled radio options with the same address. There is no nested selector. If exactly one eligible method exists across all locations, select it automatically after ZIP search completes; Continue is still required. If several exist, require a deliberate choice.

If the merchant enables order comments, reuse the existing optional order-notes field below the list. Preserve the shopper's notes when moving between pickup and shipping, while keeping generated dealer information out of the pickup form.

For example, two options could read **Downtown Store — In-store pickup** and **North Store — Curbside pickup**. Any collection-time text comes from the merchant's native settings; the checkout does not invent a ready time or infer it from opening hours.

### 3. Continuing to billing

Changing a location radio changes the draft selection only. Both regular and FFL shoppers press **Continue** to save it. Disable Continue until a method is selected and current eligibility is known. During saving, show a loading state and prevent repeated submissions or competing fulfilment changes.

Existing totals may still reflect the previous delivery choice until saving finishes. While the draft differs from the saved fulfilment, show **Your order total will update after you continue.** Do not invent a pickup price or calculate tax/fees locally. On successful Continue, BigCommerce supplies the updated total and the carrier shipping option is no longer selected.

The completed Delivery step shows **Store pickup**, the chosen store/address, and the method. The customer then sees the existing billing form, with **Billing address** clearly identified. Preserve an existing valid billing address according to the checkout's normal identity rules; otherwise ask for one. Do not copy the store address into billing or require a separate shipping address first. A previous shipping address is not automatically written over a separate billing address.

### 4. Paying and receiving confirmation

The customer continues through the merchant's supported payment methods. The chosen pickup location remains visible in the completed Delivery summary, and the order total reflects the saved native pickup selection.

Place a native pickup order. For pickup, remove generated AutoFFL dealer information from order comments while preserving the customer's own notes. Pickup publishes an inactive dealer handoff and does not intentionally create dealer attribution. Attribution retains the existing best-effort reliability model described below. The customer never sees internal handoff or attribution details.

Use the existing order-confirmation, email, and merchant ready-for-pickup processes. Verify that the launch store's native confirmation surfaces expose the correct pickup details; do not assume the templates already do. Any required correction should be narrow and separately identified. The MVP adds no new emails, texts, scheduling, or readiness workflow. An order-confirmation message does not mean the order is already ready to collect; the merchant's collection instructions govern what the shopper does next.

### 5. Changing their mind

Before pickup has been saved, choosing **Ship my order** discards the draft pickup selection and returns to the existing shipping/dealer flow. Preserve existing saved shipping data where the current checkout normally does; do not add cross-mode persistence for unsaved address fields.

After pickup has been saved, editing Delivery reopens the pickup panel with the saved location selected. The shopper can choose another method and press Continue to update it. Choosing **Ship my order** removes the pickup consignment before mounting the ordinary form. For regular shipping, use its normal address defaults without exposing the store address as the customer's home address. For FFL shipping, require the normal dealer/state decisions again. There is no FFL bypass shortcut.

A failed switch leaves the shopper in the pickup panel with a retry action. Do not display a successful switch while the saved checkout still contains pickup.

### 6. Cart changes

If items or quantities change after pickup was chosen, return the shopper to Delivery and show **Your cart changed. Please confirm your pickup location again.** Recheck the current cart, but do not automatically change the saved consignment or advance the customer.

If the previous method remains eligible, keep it selected as a draft so the shopper only needs to press Continue again. If it no longer qualifies, clear the draft and show the remaining eligible choices. If none qualify, keep the ZIP field and show **No pickup locations within 200 miles can fulfill your entire order. Try another ZIP code or choose shipping.** Never silently switch the order to shipping or split it across locations.

Until the shopper successfully confirms a current pickup choice or switches to shipping, payment is blocked. This includes a change detected while the shopper is on the payment step.

### 7. Reloads and errors

For regular-cart guests and signed-in customers, recognize saved native pickup, require a manually entered ZIP to recheck eligibility, and require confirmation in the shared panel before resuming billing/payment. A draft never saved with Continue is not persisted across a reload. The existing guest FFL cleanup remains an accepted MVP exception: those shoppers reselect pickup/location after a reload. Preserve customer-identity cleanup; no new localStorage persistence is added.

Invalid or nonexistent ZIPs show a ZIP validation error. ZIP lookup failures have a separate retryable message. If native eligibility or location metadata discovery fails, retain the search panel and show **We couldn't check pickup availability. Try again or choose shipping.**

If saving the location fails, show **We couldn't save your pickup choice. Please try again.** Keep the shopper at Delivery with their draft where still valid. If availability changed, refresh the list and ask for a new choice. A failed payment keeps the confirmed pickup for retry or an explicit change of fulfilment.

### 8. Mobile, accessibility, and wallet boundaries

Use one vertical list at mobile widths, full-row radio labels, keyboard-operable controls, visible selected state, and an announced loading/error message. Use the existing checkout components and styles.

The ZIP search uses the native `TextInput`, `Label`, secondary `Button`, and `form-prefixPostfix` pairing so the input and button share checkout sizing. Fulfilment radios and pickup cards use native radio/checklist components and theme selectors; headings and secondary text follow the merchant's checkout theme.

Pickup options appear as separate cards using native checklist selection styles. Each card owns its rounded border and clips the inner background to keep the corners continuous. Each label includes the complete option so focus styling covers its address, collection time, and selected instructions. The address is one continuous text link that wraps naturally on small screens and opens directions in a new tab without selecting that pickup option. Only the address text is linked; adjacent whitespace selects the card.

Hide express wallet entry points while pickup is selected or committed. Test the launch merchant's enabled payment methods and returning wallet sessions. A provider whose active shipping callbacks cannot be safely stopped must have pickup explicitly unavailable for that session until the customer exits it through the normal checkout controls. Do not build new wallet-specific pickup interfaces for the MVP or promise untested provider compatibility.

## Implementation design

### One shared panel hosted by Checkout

Add a small fulfilment chooser and a `PickupShipping` component under `packages/core/src/app/checkout/pickup/`. `Checkout.tsx` already chooses the regular or dealer shipping body; add the pickup body at that boundary while retaining the existing CheckoutStep shell, summary, Customer, Billing, and Payment steps. Mount the same pickup component for all cart types.

Do not offer pickup while the shopper's actual multi-shipping mode is active. Distinguish that mode from DealerShipping's internal `isMultiShippingMode` presentation prop: an ordinary FFL cart may have multiple shipping consignments and still be eligible to convert the whole order to one pickup location.

While pickup is active, do not keep `Shipping`, `DealerShipping`, or alternate shipping forms mounted behind it. Their carrier, dealer, ammo-state, and address-submit guards stay with their own shipping flows. Avoid adding pickup submission branches throughout those forms or adding a synthetic entry to `ShippingOptionsForm`.

Before unmounting a shipping body or starting pickup conversion, cancel queued address/dealer debounces, settle in-flight shipping mutations, and invalidate obsolete dealer intents through the existing coordinator. `SingleShippingForm` currently needs explicit debounce cleanup; DealerShipping already cancels its debounces on unmount, but in-flight mutations still need the coordinator's ordering and supersession checks. This small lifecycle integration remains necessary.

Use the existing billing step to collect/confirm billing. Set billing-as-shipping false for pickup and prevent the store address from becoming a customer/billing default. Parent fresh-FFL navigation guards must recognise a confirmed pickup path; they become active again when the shopper switches back to FFL shipping. Pickup never sets the FFL bypass flag.

### Discovery and minimal state

- Resolve the submitted ZIP through `GET /store-front/api/stores/:hash/pickup/zip?zip=02108`. The backend requires an active BigCommerce store with pickup enabled and reuses its configured Google Maps geocoder. Strict country/postal-code validation prevents fallback to another place. No new dependency or migration is needed for ZIP search.
- Send one native `/api/storefront/pickup-options` request with the ZIP coordinates, a 200 MI radius, and aggregated variant quantities for the entire physical cart. Keep only methods covering every requested item and quantity.
- Fetch metadata only for returned eligible location IDs using Storefront GraphQL and the existing token. Batch IDs and follow location cursors; never reject a store for having more than ten locations. Reject failed/incomplete metadata requests, and skip invalid coordinates with a diagnostic.
- Calculate straight-line distance from the ZIP center, enforce the radius, sort nearest first, and retain methods from up to five distinct stores. Preserve native collection instructions and descriptions. No automatic widening, driving-distance service, or opening-hours processing.
- Search is explicit. Editing ZIP clears results and confirmation immediately. Cart changes recheck the submitted ZIP; reload/customer-identity reset starts with an empty ZIP. Abort obsolete searches and ignore late responses after ZIP changes, cart changes, reset, disposal, or switching to shipping.
- State includes ZIP input, submitted ZIP, search status/errors, intent, draft method, cart signature and confirmation, and transition status. Derive the committed method and assignment from BigCommerce checkout state. A successful search never commits a consignment; Continue remains required.

### Commit and switching

One `selectPickup` coordinator operation serves every cart. It reads the current checkout, checks the method against discovery for the current cart, converts the sole consignment in place, or clears all and creates one if the count differs from one. Assign every physical item with its current quantity and verify the returned method, sole-consignment condition, and item coverage against the latest cart. Any cart or intent change during the operation leaves confirmation invalid until the new state is checked.

Publish inactive handoff intent on both conversion paths, retaining previous-dealer context when known. After the confirmed native mutation, clear parent FFL selection, confirmed ammo routing, and customer shipping-address selection as appropriate; persist cleaned order comments before allowing progression. The unmounted DealerShipping body must not leave callbacks capable of restoring its selection or handoff.

While switching from committed pickup to shipping, use the same coordinator to remove pickup and await success before restoring the shipping body. Do not recreate a shipping consignment from the store address. Let the existing shipping/dealer form make the next assignment through its normal path.

### Readiness and cart changes

`hasSelectedShippingOptions` recognises a native `selectedPickupOption`, but this predicate alone is not the pickup completion check. Pickup is ready only when there is exactly one native consignment for the chosen method, all physical items are assigned, discovery and explicit confirmation match the current cart signature, comment cleanup has completed, and no transition is pending or failed.

A draft change, fulfilment-mode change, or cart-signature change invalidates confirmation immediately. Return a shopper on billing/payment to Delivery when the cart changes. Discovery can retain an eligible previous method as a draft; only the customer's next Continue reconciles the saved consignment. Do not automatically repair or delete it in the background. An older `selectedPickupOption` may remain stored temporarily, but it must never satisfy pickup readiness or allow payment while unconfirmed. A successful replacement or switch removes that obsolete fulfilment.

Payment preflight refreshes checkout, rejects stale or unconfirmed pickup, cleans any generated FFL comments, and checks full readiness before either a custom payment handler or ordinary `submitOrder`. BigCommerce remains the final validator for a change racing with order submission. Apply the new guard only to pickup intent/native pickup; preserve ordinary shipping validation.

### FFL comments and attribution

Keep a small, idempotent comment helper beside `order/appendFFLtoCheckoutNotes.ts`. Remove only recognised AutoFFL-generated `|FFL#...|Expiration:...|EZcheck:...` blocks and their optional `|Certificate:...` field, including repeated blocks left by failed payment attempts. Preserve shopper text outside those blocks. Synchronise any order-comment form state so it cannot write a removed block back. Use the helper on pickup confirmation, restoration, and pre-payment checks. A native pickup order must not append dealer details even if stale UI state still contains an FFL.

Keep the existing BigCommerce scopes and asynchronous handoff publication. **Do not add Orders read access, an Orders API lookup, or a checkout-blocking attribution prerequisite.** This retains the previously approved attribution design.

After native pickup is confirmed, publish an inactive handoff, preserving previous dealer/destination context when known. Republish on restored pickup and pickup payment preflight. Active dealer matching must reject `selectedPickupOption`, even when the pickup store shares the dealer's address. Existing publication generations, compare-and-swap revisions, bounded retries, and live-checkout refresh on conflicts prevent obsolete intents from ordinarily restoring an active dealer handoff.

The backend continues using the authenticated `store/cart/converted` event and existing cart handoff. Inactive handoffs create no attribution. This is best-effort exclusion: a stale active handoff can still be consumed if every deactivation fails or arrives after conversion. Do not claim an authoritative order-fulfilment check or absolute exclusion guarantee. This accepted limit does not justify new permissions or a reconciliation system for the MVP. ZIP search adds only a geocoding endpoint; existing backend handoff handling remains unchanged.

### Scope of code changes

Put pickup-specific UI, discovery, and state under `checkout/pickup/`. Expected integration points are `Checkout.tsx`, the existing consignment coordinator, pickup-aware step status/summary, `hasSelectedShippingOptions`, `Payment.tsx`, generated-comment helpers, translations, and the shipping lifecycle cleanup needed for safe unmounting. Attribution changes stay in the existing browser handoff/coordinator and focused regression tests; existing backend scopes and processing remain in place.

No synthetic carrier option, dual pickup forms, mandatory shipping-address-to-billing copy, broad DealerShipping guard rewrite, or generic shipping refactor. Keep edits narrow while allowing the specific lifecycle and navigation fixes required by the shared panel.

## Implementation phases and estimate

1. **Shared picker and Checkout integration — 2 to 3 days.** Minimal location discovery, flat radio list, shared pickup body, no-address entry, draft selection, existing billing flow, and safe shipping-body lifecycle transitions.
2. **Native commit and checkout readiness — 3 to 4 days.** Coordinator operation, switching, summary/status, cart-change reconfirmation, reload handling, and payment preflight. Verify a regular cart and an FFL cart through the same operation early.
3. **Comment cleanup and handoff integration — 2 to 3 days.** Failed-payment comment cases, native-pickup exclusion from dealer matching, inactive publication and retry cases, and regression coverage for ordinary FFL attribution.
4. **Staging acceptance and release — 2 to 3 days.** Validate the launch merchant's customer types, cart types, locations, and enabled payment methods, then perform the controlled rollout below.

Working estimate: **9 to 13 engineering days including staging acceptance**, plus merchant scheduling delays. This is a provisional planning estimate, not measured implementation time. Re-estimate after the first shared-flow slice and handoff regression checks; do not retain the former 15-to-21-day feature scope under an MVP label.

## Acceptance and release

Use focused tests for the shared operation and the meaningful differences between cart/customer/payment paths, rather than an exhaustive cross-product of every setting. Retain the repository's coverage requirements, keyboard accessibility, and mobile checks.

Required acceptance cases:

- Regular, firearm, ammo-only, and mixed physical carts all use the same picker and Continue behaviour; the whole order uses one native pickup location.
- Zero eligible methods shows no new pickup choice. Exactly one method is auto-selected only after entering pickup mode. Multiple locations and multiple methods at one location render as a flat, deduplicated list.
- Pickup starts with no shipping address, no carrier rates, and no existing consignment. Billing is collected through the existing billing step and never populated from the store address.
- Dealer/ammo/carrier form validation does not run behind pickup. Selecting shipping restores the existing routing, validation, and bypass behaviour.
- Switching modes, changing a location, and fast repeated clicks leave one intended fulfilment. Delayed shipping/dealer callbacks cannot reverse the result.
- Cart changes from Delivery or payment require reconfirmation. Both still-eligible and no-longer-eligible choices behave as described. Stale responses, failed discovery, or failed commits cannot enable ordinary or custom payment submission.
- Saved pickup restoration works for regular-cart guests and signed-in shoppers. Guest FFL reload follows the documented re-selection exception. Customer identity changes retain existing cleanup behaviour.
- Failed FFL payment → pickup → successful payment preserves shopper notes, removes generated FFL blocks, and creates no dealer attribution; cover reloads and repeated appended blocks.
- Native pickup never matches an active dealer destination, including a store at the same address. Confirmed pickup, restoration, and payment preflight publish inactive handoffs; stale-revision retries refresh checkout. Backend inactive handoffs create no attribution; normal FFL attribution and duplicate-webhook handling still work. Preserve the documented best-effort limit when publication fails entirely.
- Confirm native pickup location/method and totals in the placed order and control panel. Verify the launch store's customer-facing confirmation and existing collection instructions. Test enabled payment methods, failed payment/retry, mobile, and keyboard operation.

Release in order: deploy the backend ZIP endpoint (using the existing Google Maps key) and store-setting migration/UI; validate pickup and handoff behaviour in staging with existing scopes; publish the checkout and confirm native pickup; remove the merchant's legacy pickup shipping rate after native pickup works. Keep the prior checkout build and the prior legacy-rate configuration for rollback. Verify controlled production orders for ordinary shipping, FFL shipping, and native pickup at the available locations.

## Assumptions and limits

Merchants own location configuration, inventory, collection instructions, and their in-person handover process. BigCommerce eligibility is the fulfilment input; the checkout adds no new verification, scheduling, or transfer workflow. Only locations the merchant intends and is authorised to use for these products should be configured for pickup.

Multi-shipping, mixing pickup and shipping, assigning different items to different stores, alternate pickup persons, and new notification flows are outside this MVP. Hours processing and driving distance/time remain outside the planned design.

## Local implementation and verification — 2026-09-08

Implemented the shared picker, whole-cart discovery, native consignment conversion, shipping lifecycle cleanup, pickup summaries, billing transition, cart-change reconfirmation, payment preflight, generated-note cleanup, and pickup-aware asynchronous handoff matching. Switching back after a cart edit refreshes firearm/ammunition classification before mounting the shipping form. The implementation adds no Orders API lookup, new OAuth scope, backend code change, or dependency upgrade. Deployment remains pending.

The ammo-workflow review found and fixed a display edge case on reload: initial multi-shipping detection counts AutoFFL's dealer/customer split when a merchant enables multi-shipping. The pickup offer now distinguishes that inferred dealer split from an explicit shopper multi-shipping choice. Regular multi-shipping and explicit multi-shipping still hide pickup. Empty location/method responses and discovery failures also have explicit negative tests.

Validation:

- 301 focused tests passed across 13 suites: shared controller, discovery, picker interaction, comments, coordinator/handoff, Checkout, Payment, shipping lifecycle, step status, and the existing DealerShipping/ammo routing suites. These include state-based ammo routing, the legacy mixed-cart setting, the Ship Non-gun items to FFL override, and disabled ammo subscriptions.
- New pickup modules and note helper coverage: 95.80% statements, 82.57% branches, 100% functions, 94.69% lines. This meets the existing 80% thresholds for those files; it is not a whole-repository coverage claim.
- Production `webpack --mode production` build passed, including the final source changes. Existing Sass/Browserslist and bundle-size warnings remain.
- The installed Jest/Enzyme/Cheerio combination needs a temporary compatibility config mapping `cheerio` to its installed CommonJS slim entry and `cheerio/lib/utils` to the installed CommonJS utils entry. No dependency changes were made. The local config is `/tmp/pickup-jest.config.js`; test/build logs are `/tmp/pickup-ammo-full-regressions.log`, `/tmp/pickup-verified-tests.log`, and `/tmp/pickup-ammo-build.log`.
- The separate `Checkout.test.tsx` integration harness fails to reach the customer form with its existing AutoFFL restriction fixture. A representative failure was reproduced using `Checkout.tsx` from unchanged `HEAD` (`/tmp/pickup-baseline-check.log`). It is not included in the 301 passing focused tests.
- ESLint could not run because the existing installation lacks `eslint-plugin-prettier`. New files were formatted with the installed Prettier. The broad TypeScript check also includes existing test-fixture errors; the production compilation passed.

Still required before release: live launch-store location/eligibility checks; native mutation and totals verification; regular/FFL/ammo/mixed cart acceptance; mobile and keyboard review; enabled payment and returning-wallet tests; and confirmation/email pickup details. Use the release sequence above with the existing permission scopes. Local tests are not evidence that a production order has been placed or a merchant template has been verified.

### ZIP search validation, 2026-09-09

- 267 tests passed across 14 focused checkout suites using the existing temporary Jest compatibility config. Coverage includes blank ZIP entry, invalid/nonexistent ZIPs, provider failures, 11-store nearest-five selection, multiple methods, metadata pagination/batching, empty results, stale ZIP/cart requests, confirmation, shipping recovery, FFL/ammo routing, and payment guards. The final controller guard change also passed its 20 tests.
- 18 backend endpoint/settings tests passed against the local test database with a fake geocoder, including store/setting restrictions and exact US ZIP matching.
- Production build passed with the installed Node 24 runtime and existing Sass/Browserslist/bundle warnings. Logs: `/private/tmp/pickup-zip-regressions.log` and `/private/tmp/pickup-zip-final-build.log`.
- No live deployment or end-to-end merchant checkout test was performed for the new ZIP endpoint. Deploy the backend first, then the checkout bundle, and verify the complete ZIP-to-pickup flow in the test store.
