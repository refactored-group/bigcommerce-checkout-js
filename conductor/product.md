# Product Definition

## Overview
BigCommerce Checkout JS is a customized one-page checkout application for BigCommerce stores specializing in firearms and ammunition sales. It extends the standard BigCommerce checkout experience with FFL (Federal Firearms License) compliance features and custom shipping form handling to meet the regulatory requirements of selling regulated products online.

## Target Users
- **BigCommerce store owners/merchants** who sell firearms, ammunition, and related regulated products and need to embed a compliant checkout experience into their storefronts.

## Core Goals
1. **Enable regulatory compliance** — Provide FFL dealer selection and certificate tracking so merchants can legally fulfill firearms and ammunition orders in compliance with federal regulations.
2. **Streamline the regulated purchase flow** — Reduce friction for customers purchasing regulated items by integrating dealer selection directly into the checkout process.
3. **Maintain BigCommerce compatibility** — Operate as a drop-in replacement for the standard BigCommerce checkout while adding compliance-specific functionality.

## Core Differentiators
- **FFL Dealer Integration** — An embedded dealer locator map (loaded via iframe from the automatic-ffl-map app) that allows customers to select a licensed FFL dealer during checkout. Dealer data (license number, expiration, certificate URL) is communicated via `window.postMessage` and appended to order comments.
- **Custom Shipping Form Handling** — Specialized shipping address forms that respect all store field requirements (phone, address fields) with validation and scroll-to-error UX for regulated product shipments.

## Key Features
1. **FFL Dealer Map Iframe** — Embedded dealer locator with cross-origin postMessage communication for dealer selection and data synchronization between the automatic-ffl-map app and checkout.
2. **FFL Certificate Tracking** — Automatic appending of FFL license details (license number, expiration date, certificate URL) to order notes for merchant compliance records.
3. **Custom Ammo Shipping Form** — Shipping form that enforces store-configured field requirements with client-side validation and scroll-to-first-error behavior.
4. **Custom Address Fields in FFL Checkout** — Supports merchant-configured required custom address fields (from BC Admin > Address Fields) in the FFL checkout flow, rendered below dealer selection and ammo shipping form with inline validation.
5. **Embedded Checkout Support** — iframe-based checkout that can be embedded in any BigCommerce storefront.
6. **Full Payment Provider Support** — 27+ payment integrations (Stripe, PayPal, Braintree, Klarna, etc.) inherited from the base BigCommerce checkout.

## Out of Scope
- Payment provider integration development (handled by separate integration packages)
- BigCommerce platform/SDK modifications
- FFL dealer map application development (separate codebase: automatic-ffl-map)
