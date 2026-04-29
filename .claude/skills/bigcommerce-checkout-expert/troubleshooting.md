# BigCommerce Checkout Troubleshooting Reference

## FFL Dealer Integration Issues

### Dealer iframe not loading
- Check `STATIC_HOST` environment variable is set correctly at build time
- Verify the automatic-ffl-map app is running/deployed at that host
- Check browser console for CORS errors or mixed content warnings
- Ensure `window.postMessage` origin matches between both apps

### Dealer selection not triggering
- Verify `getFflLineItems()` correctly identifies firearm products
- Check store hash configuration matches the expected categories
- Confirm `fflLineItems.length > 0` in the Checkout component's state
- Debug: add console.log in `DealerShipping.tsx` to verify the `dealerUpdate` messages are received

### Dealer data mismatch between codebases
- Compare `DealerSelectionData` interface in `packages/core/src/app/checkout/dealer/types.ts`
- With `handleSelect` in automatic-ffl-map `src/components/Dealer/components/LocatorMap/utils.ts`
- Both must have identical field names and types
- postMessage serializes objects — no functions, Dates, or circular references

### Order notes missing FFL info
- Check `appendFFLtoCheckoutNotes.ts` is being called with correct dealer data
- Verify the `selectedFFL` state is populated before order submission
- Ensure license, expiration, and certificate URL fields are present

## Custom Ammo Shipping Form

### Form not respecting store field requirements
- Store field requirements come from `loadShippingAddressFields()` SDK call
- Check that the form reads field definitions from SDK state, not hardcoded
- Phone field requirement must be read from store settings
- Custom fields must be mapped via `SDK_FIELD_TO_STATE_KEY`

### Scroll-to-error not working
- Verify the error element has a ref or ID that the scroll function targets
- Check that validation errors are set before the scroll call
- Ensure Formik's `setFieldTouched` is called to trigger error display

## Payment Integration Issues

### Payment method not appearing
- Verify the method is enabled in BigCommerce Control Panel
- Check `loadPaymentMethods()` response in browser DevTools
- Ensure the integration package is properly registered in the payment factory
- Check webpack lazy-loading — the chunk may fail to load

### Payment initialization failing
- `initializePayment()` must be called before `submitOrder()`
- Check that the container element exists in DOM when init is called
- Verify provider-specific options are correctly formatted
- Check for script loading errors (third-party payment SDKs)

### Embedded checkout payment method unsupported
- These methods are blocked in embedded: afterpay, applepay, amazonpay, googlepay, klarna, masterpass
- Check `createEmbeddedCheckoutSupport()` for the full list
- For embedded checkout, only methods that don't require redirects work

## Build & Development Issues

### `npm run dev:server` not reflecting changes
- Ensure `npm run dev` (watch mode) is running in a separate terminal
- Check that the Script URL in Control Panel points to `http://127.0.0.1:8080/auto-loader-dev.js`
- Clear browser cache — checkout JS may be cached aggressively
- Check webpack output for compilation errors

### Build failing with scope boundary errors
- ESLint enforces Nx module boundaries: core → shared only, integration → shared only
- Fix: move shared code to a `scope:shared` package
- Check `project.json` tags match the expected scope

### TypeScript errors after SDK upgrade
- The checkout-sdk types change between versions
- Check the changelog: `github.com/bigcommerce/checkout-sdk-js/releases`
- Common: renamed interfaces, added required fields, deprecated methods
- Run `npm run lint` to catch all type errors at once

### E2E tests failing
- HAR files may be stale — run `npm run regenerate-har`
- Check that Polly.js is correctly intercepting network requests
- Verify test environment has correct configuration
- Playwright may need browser binaries updated: `npx playwright install`

## Checkout Flow Issues

### Step not advancing automatically
- Check `getCheckoutStepStatuses.ts` — step completion logic
- Verify required data is present (address, shipping option selected, etc.)
- Look at `isComplete` flag in the step status selector
- SDK subscription may not be triggering — check `subscribe()` calls

### Billing "same as shipping" not working
- Check `isBillingSameAsShipping` state in Checkout.tsx
- Verify the billing address update copies shipping address correctly
- Multi-shipping mode may interfere — check `isMultiShippingMode`

### Guest checkout email not persisting
- `continueAsGuest()` stores email in billing address
- Check that the SDK call succeeds (inspect network tab)
- Verify the form submits the email before advancing steps

## Performance

### Checkout loading slowly
- Check webpack bundle size — payment integrations should be code-split
- Verify chunks are loaded with `prefetch: true` for next-step prediction
- Check for unnecessary re-renders — SDK subscriptions without filters cause full re-renders
- Use filtered subscriptions: `subscribe(cb, state => state.data.getCart())`

### Memory leaks
- Ensure all SDK subscriptions are cleaned up in `componentWillUnmount` or cleanup functions
- Check for event listeners on `window` (postMessage) not being removed
- Verify Formik doesn't re-create validation schemas on every render
