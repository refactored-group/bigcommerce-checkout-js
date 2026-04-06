# Product Guidelines

## UI/UX Philosophy
- **Minimal and functional** — The checkout should feel fast, trustworthy, and distraction-free. Prioritize clarity and speed over visual flourish.
- **BigCommerce-native consistency** — Follow existing BigCommerce checkout design patterns and conventions. Only deviate from the standard UI for FFL-specific features (dealer map, custom shipping fields).
- **Progressive disclosure** — Surface FFL and compliance-related UI elements only when the cart contains regulated products. Non-regulated purchases should flow through a standard checkout experience.

## Design Principles
1. **Conversion over customization** — Every UI decision should reduce friction and cart abandonment. Minimize required clicks and form fields.
2. **Trust signals** — FFL compliance features should feel authoritative and secure. Clearly communicate regulatory steps to the customer.
3. **Error prevention over error handling** — Use inline validation, sensible defaults, and field-level guidance to prevent form errors before submission. When errors occur, scroll to the first error and highlight clearly.
4. **Responsive by default** — All checkout components must work on mobile, tablet, and desktop. The FFL dealer map iframe must be usable on smaller screens.

## Brand & Messaging
- **Tone:** Professional, clear, and reassuring. Avoid jargon — explain FFL steps in plain language for customers unfamiliar with the process.
- **Labels & Copy:** Use concise, action-oriented labels for form fields and buttons. Follow BigCommerce's existing copy conventions where applicable.
- **Error Messages:** Be specific and helpful — tell the user exactly what needs to be fixed, not just that something went wrong.

## Technical Guidelines
- **CSS Modules with SCSS** — All component styles use CSS Modules. No global styles outside of shared theme variables.
- **Accessibility** — Form fields must have proper labels, focus states, and keyboard navigation. The dealer map iframe should have appropriate ARIA attributes.
- **Performance** — Keep bundle size minimal. Lazy-load FFL components when possible. The iframe dealer map loads independently and should not block the main checkout render.

## FFL-Specific Guidelines
- **Firearms — always required** — For carts containing firearms, FFL dealer selection is mandatory, no exceptions. The customer must select a licensed dealer before proceeding.
- **Ammunition — conditionally required** — For carts containing ammo, FFL dealer selection is required only if the shipping destination state has been configured by the merchant as FFL-required. The checkout supports per-state FFL configuration set by the client.
- **Data integrity** — FFL dealer data (license, expiration, certificate URL) must be validated before appending to order notes. Never submit incomplete FFL information.
- **Cross-origin safety** — All postMessage communication with the dealer map iframe must validate message origin before processing dealer data.
