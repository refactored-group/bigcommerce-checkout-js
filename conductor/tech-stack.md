# Tech Stack: BigCommerce Checkout for FFL

## Language
- **TypeScript 4.9** — Primary language for application code, types, and tests.

## Runtime
- **Node.js v20** (pinned via `.nvmrc` and `.tool-versions`)
- **npm v9** (enforced via `engines.npm` and `preinstall` `check-node-version`)
- **Unix-based development environment** (or WSL on Windows)

## Frontend Framework
- **React 17** (with `react-dom`, `react-modal`, `react-popper`, `react-transition-group`, `react-datepicker`, `react-media`)
- **Forms:** Formik 1.5 + Yup 0.26 for schema-based validation

## Checkout State Management
- **`@bigcommerce/checkout-sdk`** — drives all checkout state, consignment management, and order submission. The application is Redux-less; the SDK is the single source of state truth.

## Build Tooling
- **Webpack 5** (`webpack-cli` 4)
- **Loaders:** `babel-loader`, `ts-loader`, `css-loader`, `style-loader`, `sass-loader`, `file-loader`, `image-webpack-loader`, `source-map-loader`
- **Plugins:** `mini-css-extract-plugin`, `terser-webpack-plugin`, `webpack-assets-manifest`, `circular-dependency-plugin`, `webpack-inject-plugin`, `stylelint-webpack-plugin`
- **Compiler helpers:** `@swc/core` and `@swc/helpers` for fast transformations
- **Outputs:** content-hashed bundles to `dist/` (production), `build/` (dev)
- **Entry points:** `checkout.js` (main app), `auto-loader.js`, `loader.js`

## Monorepo
- **Nx 13** workspace (`@nrwl/cli`, `@nrwl/devkit`, `@nrwl/jest`, `@nrwl/js`, `@nrwl/linter`, `@nrwl/nx-plugin`, `@nrwl/workspace`)
- **40+ packages** organized into:
    - `packages/core/` — main checkout React application (FFL customizations live here)
    - `packages/payment-integration-api/` — payment provider extension API
    - `packages/ui/` — reusable UI components
    - `packages/locale/` — i18n / localization
    - `packages/analytics/` — analytics integration
    - `packages/*-integration/` — 27 payment provider integrations (Stripe, Braintree, PayPal, Klarna, Affirm, Bolt, Adyen, Apple Pay, Google Pay, etc.)
    - `packages/test-framework/`, `packages/test-mocks/`, `packages/test-utils/` — shared testing utilities
- **ESLint-enforced scope boundaries:**
    - `scope:core` may depend on `scope:shared` only
    - `scope:shared` may depend on `scope:shared` only
    - `scope:integration` may depend on `scope:shared` only

## Styling
- **SCSS** (`sass` 1.60, `sass-loader` 13.2) with CSS Modules

## Linting & Formatting
- **ESLint 8** with `@bigcommerce/eslint-config`, `@nrwl/eslint-plugin-nx`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jest-dom`, `eslint-plugin-testing-library`
- **Prettier** (config sourced from `@bigcommerce/eslint-config/prettier`)
- **Stylelint 15** with `stylelint-config-standard-scss` and `stylelint-order`

## Testing

### Unit tests
- **Jest 26** with `ts-jest`
- **Enzyme 3** + `@wojtekmaj/enzyme-adapter-react-17`
- **Testing Library:** `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/react-hooks`, `@testing-library/user-event`
- **Snapshots:** `enzyme-to-json`, `react-test-renderer`
- **Coverage threshold:** 80% (branches, functions, lines, statements) — required for all packages
- **Patterns:** unit tests co-located with source as `*.spec.ts` / `*.test.tsx`
- **Mocking:** MSW 1.2 for HTTP mocks in integration tests; `@faker-js/faker` for mock data
- **Configs:** root `jest.config.js`, per-package configs (e.g. `packages/core/jest.config.js`), shared preset `jest.preset.js`

### E2E tests
- **Playwright 1.25** (`@playwright/test`)
- **HAR-based network replay** via `@pollyjs/core`, `@pollyjs/adapter`, `@pollyjs/persister-fs`, `@pollyjs/node-server`, `polly-adapter-playwright`, `setup-polly-jest`
- **Regenerate IDs after editing HAR files:** `npm run regenerate-har`

## Maps
- **`@peacechen/google-maps-react`** and `@types/googlemaps` for Google Maps integration in checkout flows

## Error Tracking
- **Sentry** (`@sentry/browser`, `@sentry/integrations`)

## Utilities (Notable)
- `lodash` — data manipulation
- `classnames` — class composition
- `dompurify` — HTML sanitization
- `downshift` — accessible combobox / select primitives
- `reselect` — memoized selectors
- `object-hash` — stable object hashing
- `local-storage-fallback` — persistent storage with cookie fallback
- `card-validator` + `credit-card-type` — payment input validation
- `@bigcommerce/citadel` — BC design tokens / patterns
- `@bigcommerce/form-poster`, `@bigcommerce/memoize`, `@bigcommerce/request-sender`, `@bigcommerce/script-loader` — BC shared SDK utilities

## CI/CD & Release
- **CircleCI** — automatic builds on PR merge to `master`; release jobs require manual approval by a person with write access
- **`standard-version`** — automated changelog generation on tagged releases
- **Prerelease publishing:** `npm run release:alpha` produces alpha tags for integration testing
- **Bower manifest** (`bower.json`) — legacy distribution channel

## External API Dependencies
- **AutomaticFFL Map iframe** (`automatic-ffl-map`) — hosts the dealer search/selection UI; communicates via `postMessage`. Cross-repo contract documented in `product-guidelines.md`.
- **BigCommerce APIs** — accessed via `@bigcommerce/checkout-sdk` (cart, checkout, customer, order, payment endpoints)
- **AutomaticFFL backend API** — accessed indirectly via the iframe

## Compatibility
- **Browsers:** modern evergreen browsers (no IE11 support — uses `:has()`, modern ES, Webpack 5 dynamic imports)
- **Mobile:** responsive checkout; iframe modal must work at small viewports
- **BigCommerce platform:** requires Optimized One-Page Checkout enabled, configured to load this fork as a Custom Checkout

## Project-Specific Conventions
- **FFL code lives in scoped paths only** (see `product-guidelines.md`)
- **Cross-repo dealer payload contract** with `automatic-ffl-map` (see `product-guidelines.md`)
- **No new top-level packages without justification** — most FFL work belongs in `packages/core/`
