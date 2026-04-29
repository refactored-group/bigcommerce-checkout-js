# Product Guidelines: BigCommerce Checkout for FFL

These guidelines apply to all changes made to this fork. They exist to keep the fork maintainable against upstream BigCommerce Checkout JS, keep cross-repo contracts intact, and keep the FFL flow accessible and trustworthy for end customers.

## Part 1 — Engineering Fork Guidelines

### Fork hygiene

This is a customization fork of `@bigcommerce/checkout-js`, not a rewrite. Customizations should make upstream merges easy, not hard.

- **Minimize the diff against upstream.** Touch the fewest files possible to deliver a feature. If a customization can live in a new file, prefer that to modifying an existing upstream file.
- **Isolate FFL code in scoped paths.** All FFL-specific application code lives under:
    - `packages/core/src/app/checkout/dealer/` — components, types, utilities, locator subdirectory
    - `packages/core/src/app/order/appendFFLtoCheckoutNotes.ts` — order-comment metadata
- **Avoid sprinkling FFL conditionals into unrelated upstream files.** If a touchpoint outside the scoped paths is unavoidable, keep the change to a single import + single call site, and document why.
- **Don't reformat upstream code casually.** Whitespace-only changes to upstream files inflate merge conflicts. Reformat only when the file's contract is changing anyway.
- **Prefer composition over inline edits.** Wrap, extend, or compose rather than editing upstream React components in place.

### Cross-repo dealer payload contract

`packages/core/src/app/checkout/dealer/types.ts` (`DealerSelectionData`) and `automatic-ffl-map`'s `src/components/Dealer/components/LocatorMap/utils.ts` (`handleSelect`) together form a contract over the iframe `postMessage` payload.

- **Field changes are cross-repo by definition.** Adding, removing, or renaming a field on either side without a coordinated update on the other side breaks the dealer flow.
- **Backwards-compatible removals require a transition window.** When dropping a field that downstream consumers (this repo, the WC plugin, etc.) still read, ship a backwards-compat shim on the map side first, update consumers to stop reading the field, then strip the shim. Document the removal condition in a TODO comment.
- **Add fields defensively.** New fields on the map payload should be optional on the consumer side until the map's deployment is confirmed.
- **Stage rollouts across consumers.** This repo, the WC plugin (`automaticffl-for-woocommerce`), the Magento integration, and the Shopify integration may all consume the same payload. Stage rollouts so the slowest consumer doesn't block deployment.

### Code organization

- **Respect Nx monorepo scopes.** ESLint enforces module boundaries:
    - `scope:core` may depend on `scope:shared` only
    - `scope:shared` may depend on `scope:shared` only
    - `scope:integration` may depend on `scope:shared` only
- **Don't add new top-level packages without a clear reason.** Most FFL work belongs inside `packages/core/`.
- **Co-locate tests.** Unit tests live next to source as `*.spec.ts` / `*.test.tsx`.

### Testing expectations

The repo's coverage threshold is 80% (branches, functions, lines, statements) per upstream BC convention.

- **New FFL code must meet that threshold.** Component tests use Enzyme + Testing Library; data flow tests use Jest mocks of `@bigcommerce/checkout-sdk`.
- **E2E tests use HAR file replays via Playwright + Polly.js.** Run `npm run regenerate-har` after editing HAR files.
- **Don't disable tests to land changes.** If an upstream test fails because of an FFL change, fix the FFL change, not the test.

### PR review expectations

- **Cross-repo PRs link to each other.** A PR that requires a coordinated `automatic-ffl-map` change must reference the map PR in its description, and vice versa.
- **Call out upstream-touching changes.** PRs that modify files outside the scoped FFL paths must explain why the touchpoint is needed and what the upstream-merge implications are.
- **Reviewers verify backwards compatibility.** A PR that changes the dealer payload, the FFL meta keys, or the order-comment format must include a note on which deployed consumers are affected.

### Upstream merging

- **Periodic upstream merges.** Schedule periodic merges from `bigcommerce/checkout-js` `master` to keep the fork close to the source.
- **Resolve conflicts in favor of upstream when in doubt.** The fork's customizations should re-apply over upstream cleanly — if they don't, refactor the customization rather than fighting the merge.

## Part 2 — Customer-Facing UX Guidelines

### Voice and tone for FFL/regulatory copy

The customer is making a legal firearms purchase, not breaking the law. Compliance copy should treat the customer as a partner in the process, not an obstacle.

- **Lead with what's required, not what's prohibited.** "Select an FFL dealer to receive your firearm" beats "You cannot receive firearms at a residential address."
- **Explain why in plain language, once.** A short note like "Federal law requires firearms to be shipped to a licensed dealer" goes once near the dealer picker, not as a recurring banner.
- **Never imply the customer did something wrong.** If their state restricts ammo, say "Ammunition shipments to your state require an FFL dealer" — not "Your state does not allow direct ammunition shipment."
- **Avoid legal jargon.** "Licensed Firearm Dealer (FFL)" on first use, then "FFL dealer" or "dealer" thereafter. Don't introduce additional regulatory acronyms (ATF, BATFE, NICS, etc.) in customer-facing copy.

### Accessibility

The FFL flow is *required* for the customer to complete a regulated purchase. There is no fallback for "skip the dealer picker." That makes accessibility non-negotiable.

- **Every interactive control has a keyboard path.** "Find a Dealer" button, dealer-pick buttons inside the iframe, "Change Dealer" button, address-card edit affordances — all keyboard-operable, all visibly focused.
- **Modal traps focus.** When the dealer iframe modal opens, focus moves to the modal and stays inside until close.
- **Form errors announce.** Required-field errors on the FFL-related shipping fields use `aria-live` and are read by screen readers, not just shown visually.
- **Color is not the only signal.** Selected dealer / restricted state / required field status must be conveyed by text or icon in addition to color.

### Error message patterns

- **Actionable, not blaming.** "Please select an FFL dealer to continue" rather than "FFL dealer is missing."
- **Place errors next to the affected control.** Top-of-form summary errors are acceptable as a duplicate, not as the only signal.
- **One error per field at a time.** Don't stack "FFL required" with "shipping name required" with "phone required" — fix the most blocking one first.
- **Recoverable copy.** Tell the customer what to do next, not just what failed.

### Dealer card visual hierarchy

When a dealer is selected, the customer needs to confirm at a glance that "this is where my firearm is going."

- **Lead with the dealer's business name.** Then address, then phone. License number is metadata, not the headline.
- **Phone numbers are tappable on mobile.** `tel:` links, formatted consistently.
- **A clear "Change Dealer" affordance is always visible** when a dealer is selected. The customer should never feel locked into a choice they didn't intend.
- **The customer's own name is preserved on the shipping address.** The dealer holds the package; the dealer releases it to the customer by name. The displayed shipping address should reflect both: customer name + dealer address.

### Compliance copy placement

- **Once near the dealer picker** — explain why an FFL is needed.
- **Confirmation in the order summary** — "Shipping to: [dealer name and address]" so the customer sees the regulatory routing before placing the order.
- **In the order email** (handled outside this repo, but the dealer fields surface there via order comments) — license number, expiration, dealer business name.

### Mobile considerations

A meaningful share of firearms checkouts happen on mobile. The dealer iframe modal must be usable at small viewport widths.

- **Modal content scrolls within the modal**, not the body behind it.
- **Map pins are tappable at finger-friendly sizes** (managed by `automatic-ffl-map`, but verify when the iframe is integrated).
- **Address fields don't overflow** on small screens.
