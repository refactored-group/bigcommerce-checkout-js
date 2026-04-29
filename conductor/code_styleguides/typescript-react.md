# TypeScript & React Style Guide

Conventions for `.ts` and `.tsx` files in this BigCommerce Checkout JS fork. The repo's ESLint config (`@bigcommerce/eslint-config`) is the authoritative source — this guide explains the conventions and the project-specific overlays.

## Linting & formatting

- **`npm run lint`** runs ESLint + TypeScript checks across all packages. PRs must pass it.
- **Prettier config** comes from `@bigcommerce/eslint-config/prettier`. Don't override per-file.
- **No casual reformatting of upstream files.** Whitespace-only diffs inflate merge conflicts when pulling from `bigcommerce/checkout-js`.

## TypeScript

- **Target version:** TypeScript 4.9. Don't use TS 5.x features (decorators, `using` declarations, etc.).
- **Avoid `any`.** Use `unknown` for genuinely-unknown types and narrow at the boundary. If you must use `any`, leave a comment explaining why.
- **Prefer `interface` over `type` for object shapes** unless you need union/intersection composition.
- **Type-only imports:** use `import type { X } from '...';` to avoid runtime imports for types.
- **Public API types** (e.g., `DealerSelectionData` in `packages/core/src/app/checkout/dealer/types.ts`) are part of the cross-repo contract. Field changes there require coordinated rollout (see `product-guidelines.md`).
- **Don't reach into `@bigcommerce/checkout-sdk` internals.** Use only its exported types and SDK methods.

## React 17 conventions

- **Function components by default.** Use class components only when matching an existing class in the same file or when an upstream BC component is already a class.
- **Hooks over HOCs.** `useEffect`, `useCallback`, `useMemo`, `useState`, `useRef`. The `legacy-hoc` package exists for upstream BC compatibility — don't add new HOCs unless the surrounding code already uses them.
- **Effect dependencies are exhaustive.** `react-hooks/exhaustive-deps` is enforced by ESLint. Don't suppress it without a comment explaining why.
- **No direct DOM manipulation in components.** Use refs, not `document.querySelector`. Exception: when interfacing with non-React widgets (e.g., the dealer iframe modal), keep DOM manipulation isolated to a single effect or imperative handler.
- **Component file naming:** PascalCase for components (`DealerShipping.tsx`, `CustomShippingForm.tsx`). One component per file when the component is non-trivial.

## Forms (Formik + Yup)

- **Use Formik's `<Form>`, `<Field>`, and `useFormikContext`** — don't roll your own form state management.
- **Yup schemas live alongside the component or in a sibling `*.validationSchema.ts` file.** Keep schemas declarative; avoid imperative validation in component bodies.
- **Field IDs and labels match.** `id` on input must match `htmlFor` on label for accessibility (per `product-guidelines.md`).

## State management

- **`@bigcommerce/checkout-sdk` is the source of truth** for cart, checkout, customer, consignment, and order state. The app is intentionally Redux-less.
- **Don't introduce client-side state caches** that duplicate SDK state. Use the SDK's selectors and `subscribe`.
- **Local component state (`useState`)** is fine for UI-only concerns (modal open/closed, form toggles, transient input).

## File organization (FFL fork-specific)

All FFL customizations live in:

- `packages/core/src/app/checkout/dealer/` — components, types, utilities, locator subdirectory
- `packages/core/src/app/order/appendFFLtoCheckoutNotes.ts` — order-comment metadata

Don't add FFL-related files outside these paths without explicit justification (see `product-guidelines.md` Fork hygiene).

## Nx scope boundaries

ESLint enforces:
- `scope:core` may depend only on `scope:shared`
- `scope:shared` may depend only on `scope:shared`
- `scope:integration` may depend only on `scope:shared`

If you need cross-package imports, check the scope tags in `project.json` files. Don't disable the rule.

## Imports

- **Order:** external packages → `@bigcommerce/*` → relative imports. ESLint's `import/order` enforces this.
- **No default exports for types.** Use named exports (`export interface Dealer`, `export type DealerPayload`) to keep type imports unambiguous.
- **Avoid deep relative imports** (`../../../../../`). If you find yourself reaching that deep, consider whether the import target should be promoted to a public package boundary.

## Tests (Jest + Enzyme + Testing Library)

- **Co-located unit tests** as `Component.spec.tsx` or `module.spec.ts` next to source.
- **Coverage threshold:** 80% (branches, functions, lines, statements). New code must hit it.
- **Use Testing Library queries first** (`screen.getByRole`, `screen.getByLabelText`). Fall back to Enzyme `mount`/`shallow` only when matching existing surrounding tests in the same file.
- **Mock `@bigcommerce/checkout-sdk` at the boundary.** Don't mock individual SDK methods inside components.
- **Use `enzyme-to-json` snapshots sparingly.** Prefer behavioral assertions; snapshots tend to rot.
- **Faker (`@faker-js/faker`) for mock data.** Don't hardcode test data when faker would do.

## Error handling

- **Catch SDK errors at the call site.** Surface user-facing errors via the BC error handling pattern (`onUnhandledError` prop or equivalent) rather than `try/catch` in random component bodies.
- **Sentry is wired up** (`@sentry/browser`) — don't add a separate error reporter. Throw `Error` subclasses (e.g., `AssignItemFailedError`) for known error categories.

## Comments

- **Comment WHY, not WHAT.** Explain the non-obvious — workarounds, hidden constraints, cross-repo coordination notes, version compatibility.
- **Cross-repo coordination notes are mandatory** when a comment is the only thing tying two codebases together. Reference both repos by name when applicable.

## Don'ts

- **Don't add new top-level `packages/*` without justification.** FFL work belongs inside `packages/core/`.
- **Don't bypass the lint or type checker** to land a PR. If a rule conflicts with what you're trying to do, discuss before disabling.
- **Don't import from another package's internals.** Each package has a public surface (its `index.ts`). Cross-package imports must go through that surface.
- **Don't use `// @ts-ignore` without a reason.** Prefer `// @ts-expect-error` with a comment explaining the upstream bug or limitation.
