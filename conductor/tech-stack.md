# Tech Stack

## Language
- **TypeScript 4.9** — Strict mode enabled with null checks. ES5 compilation target for broad browser compatibility.

## UI Framework
- **React 17** with ReactDOM 17

## State Management
- **@bigcommerce/checkout-sdk** — BigCommerce's proprietary Redux-free state management SDK for checkout data, cart state, and payment orchestration.

## Forms & Validation
- **Formik 1.5.8** — Form state management and submission handling
- **Yup 0.26.6** — Schema-based form validation

## Styling
- **SCSS with CSS Modules** — Component-scoped styles using Sass 1.60 and sass-loader 13.2
- **Classnames 2.3.2** — Conditional CSS class composition

## Build Tools
- **Webpack 5.94** — Production bundler with content-hashed output, code splitting, and minification (Terser)
- **SWC 1.3.59** — Fast TypeScript/JavaScript compilation
- **Nx 13.10** — Monorepo orchestration, build caching, and task dependency management

## Testing
- **Jest 26.6** — Unit test runner with ts-jest transformer
- **Enzyme 3.10** — React component shallow/mount rendering
- **React Testing Library 12.1** — DOM-based component testing
- **Playwright 1.25** — End-to-end browser testing
- **Polly.js 6.0** — HAR-based network replay for E2E test mocking
- **Coverage threshold:** 80% (branches, functions, lines, statements)

## Linting & Formatting
- **ESLint 8.19** with @bigcommerce/eslint-config and TypeScript ESLint plugin
- **Stylelint 15.10** with SCSS configuration
- **Prettier 2.7**

## Error Tracking
- **Sentry 7.11** (@sentry/browser) — Client-side error monitoring

## CI/CD
- **CircleCI** — Continuous integration and deployment pipeline

## Key Libraries
- **Reselect 4.1** — Memoized selector functions
- **Lodash 4.17** — Utility functions
- **DOMPurify** — XSS protection for HTML sanitization
- **@peacechen/google-maps-react** — Google Maps integration (used in FFL dealer map context)
- **React Modal 3.8** — Accessible modal dialogs
- **Downshift 7.6** — Headless UI components (autocomplete, dropdowns)

## Architecture
- **Nx Monorepo** — 41 packages with enforced module boundaries:
  - `scope:core` — Main checkout app, depends only on `scope:shared`
  - `scope:shared` — Utility packages, depends only on `scope:shared`
  - `scope:integration` — 27 payment provider integrations, depends only on `scope:shared`
- **Entry Points:** `checkout.js` (main), `auto-loader.js`, `loader.js`
