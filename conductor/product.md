# Product Definition: BigCommerce Checkout for FFL

## Initial Concept

A customized fork of BigCommerce's Optimized One-Page Checkout (`@bigcommerce/checkout-js`), extended with native FFL (Federal Firearms License) dealer selection, ammunition state restriction enforcement, and compliance automation. Built for BigCommerce merchants whose product catalogs include firearms or ammunition and who need the regulatory shipping workflow handled directly inside the checkout experience.

## Vision

The FFL compliance layer for BigCommerce. Where the upstream BigCommerce Checkout JS provides the foundational checkout UI for any BC store, this fork makes that same checkout legally and operationally viable for stores selling regulated firearms products — eliminating manual FFL coordination by handling dealer lookups, shipping address overrides, ammunition restrictions, and order-comment compliance metadata automatically inside the existing BC checkout flow.

## Target Users

BigCommerce merchants who have committed to BC as their commerce platform and need FFL compliance integrated into their checkout. The unifying primary user is the BC store operator; within that, three sub-segments share the same compliance needs:

### 1. Online Firearms Retailers (BC)
BC store operators who sell firearms and must comply with federal shipping regulations requiring delivery to a licensed FFL dealer.

### 2. Ammunition-Only Retailers (BC)
BC sellers of ammunition and related consumables who face varying state-level shipping restrictions and need automated enforcement to prevent illegal shipments.

### 3. Multi-Product Retailers (BC)
BC stores selling a mix of firearms, ammunition, and non-regulated items (accessories, apparel, optics) that need intelligent cart analysis to route each product type through the correct compliance and shipping workflow.

## Core Value Proposition

- **Compliance automation native to the BC checkout.** Dealer lookup, map-based selection, shipping address override, and ammo restriction enforcement all happen inside the standard BC Optimized One-Page Checkout — no separate flow, no third-party redirect, no custom step.
- **Easy FFL dealer lookup for the customer.** Customers get an iframe-based map search and selection experience embedded directly in the BC shipping step, reducing friction and cart abandonment.
- **Cross-platform parity with the AutomaticFFL platform.** Mirrors the customer-facing FFL experience offered by the WooCommerce, Magento, and Shopify integrations of the same AutomaticFFL platform — same dealer database, same map, same compliance behavior.
- **Maintainable fork.** Stays close enough to upstream `@bigcommerce/checkout-js` that BC platform updates can be merged in; FFL integration lives in clearly-scoped files under `packages/core/src/app/checkout/dealer/`.

## Key Features

### Iframe-based FFL Dealer Map
Dealer selection runs inside a modal iframe served by the AutomaticFFL backend (`STATIC_HOST` / `automatic-ffl-map`). The iframe communicates with the checkout via `window.postMessage`. `DealerMessageListener` in `DealerShipping.tsx` receives `dealerUpdate` messages and feeds the selected dealer into the checkout's shipping consignment.

### Ammunition State Restriction Enforcement
Cart analysis identifies ammo line items and enforces state-level shipping restrictions, blocking checkout for shipments to states that prohibit ammunition shipments.

### Shipping Consignment Override
On dealer selection, the dealer's address replaces the shipping address for FFL-flagged items in the BigCommerce consignment via the checkout SDK's `assignItem` flow. Mixed carts produce two consignments (FFL items → dealer, regular items → customer).

### Custom Shipping Form
For carts requiring FFL but where the dealer flow is bypassed or unavailable, a `CustomShippingForm` collects the customer's shipping address fields with the same validation rules as the standard BC shipping form.

### FFL Order Comments
`order/appendFFLtoCheckoutNotes.ts` writes the selected dealer's license number, expiration date, and certificate URL into the order comments at submission, surfacing the compliance metadata to the merchant's order management system.

### Save-for-Later Affordances
The dealer flow supports save-for-later patterns aligned with the broader AutomaticFFL platform.

## Technical Requirements

- **Node.js** v20 (per `.nvmrc`)
- **npm** v9
- **Unix-based development environment** (or WSL on Windows)
- **BigCommerce store** with Optimized One-Page Checkout enabled, configured to load this fork as a Custom Checkout
- **AutomaticFFL store hash** (merchant account) — provisions access to the dealer search backend
- **Google Maps API key** — powers the interactive dealer map inside the iframe (managed by the `automatic-ffl-map` app, not this repo)

## API Dependencies

- **AutomaticFFL Map iframe** (`automatic-ffl-map`) — hosts the dealer search/selection UI; communicates via `postMessage`. The dealer object structure is a contract between this repo (`packages/core/src/app/checkout/dealer/types.ts` — `DealerSelectionData`) and the map repo (`src/components/Dealer/components/LocatorMap/utils.ts` — `handleSelect`). Field changes require coordinated updates in both repos.
- **BigCommerce Checkout SDK** (`@bigcommerce/checkout-sdk`) — drives all checkout state, consignment management, and order submission. The FFL integration sits on top of the SDK rather than replacing it.
- **AutomaticFFL backend API** — store configuration retrieval and dealer search (production and sandbox environments), accessed indirectly via the `automatic-ffl-map` iframe.

## Architecture Notes

- **Nx monorepo, 40+ packages.** FFL code lives almost entirely in `packages/core/src/app/checkout/dealer/`, with one supporting file in `packages/core/src/app/order/` for order-comment metadata.
- **Shared dealer payload contract.** The `DealerSelectionData` interface in this repo and `handleSelect` in `automatic-ffl-map` form a cross-repo contract. Both sides currently emit/consume `phone`, `company` (the dealer's `business_name`), address fields, `fflID`, and `uuid`. The customer's `firstName`/`lastName` are sourced from BC SDK state at the consignment-build site rather than from the dealer payload, so the shipping label reads `<customer name> c/o <dealer business name>` — the correct FFL release pattern. Changes to either side require coordinated rollout (see also: the AutomaticFFL platform's WC sibling, which has its own equivalent listener).
- **Forkability.** Customizations are kept in clearly-scoped paths so the fork can absorb upstream BC checkout updates without conflicts in unrelated areas.
