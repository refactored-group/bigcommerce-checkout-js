# Conductor Context

This project uses [Conductor](https://github.com/gagarinyury/claude_conductor) for spec-driven development.

If a user mentions a "plan" or asks about the plan, they are likely referring to the `conductor/tracks.md` file or one of the track plans (`conductor/tracks/<track_id>/plan.md`).

## Universal File Resolution Protocol

**PROTOCOL: How to locate files.**
To find a file (e.g., "**Product Definition**") within a specific context (Project Root or a specific Track):

1.  **Identify Index:** Determine the relevant index file:
    -   **Project Context:** `conductor/index.md`
    -   **Track Context:**
        a. Resolve and read the **Tracks Registry** (via Project Context).
        b. Find the entry for the specific `<track_id>`.
        c. Follow the link provided in the registry to locate the track's folder. The index file is `<track_folder>/index.md`.
        d. **Fallback:** If the track is not yet registered (e.g., during creation) or the link is broken:
            1. Resolve the **Tracks Directory** (via Project Context).
            2. The index file is `<Tracks Directory>/<track_id>/index.md`.

2.  **Check Index:** Read the index file and look for a link with a matching or semantically similar label.

3.  **Resolve Path:** If a link is found, resolve its path **relative to the directory containing the `index.md` file**.
    -   *Example:* If `conductor/index.md` links to `./workflow.md`, the full path is `conductor/workflow.md`.

4.  **Fallback:** If the index file is missing or the link is absent, use the **Default Path** keys below.

5.  **Verify:** You MUST verify the resolved file actually exists on the disk.

**Standard Default Paths (Project):**
- **Product Definition**: `conductor/product.md`
- **Tech Stack**: `conductor/tech-stack.md`
- **Workflow**: `conductor/workflow.md`
- **Product Guidelines**: `conductor/product-guidelines.md`
- **Tracks Registry**: `conductor/tracks.md`
- **Tracks Directory**: `conductor/tracks/`

**Standard Default Paths (Track):**
- **Specification**: `conductor/tracks/<track_id>/spec.md`
- **Implementation Plan**: `conductor/tracks/<track_id>/plan.md`
- **Metadata**: `conductor/tracks/<track_id>/metadata.json`

## Core Rules

1.  **Context First:** Always check `conductor/` files before answering questions about the project domain or tech stack.
2.  **Specs over Chat:** When asked to build a feature, ALWAYS suggest creating a **Track** (`/conductor:new`) first, rather than coding immediately.
3.  **Plan Compliance:** When implementing (`/conductor:implement`), NEVER deviate from the `plan.md` without explicit user approval.
4.  **Workflow Adherence:** Follow the rules in `conductor/workflow.md` (e.g. commit message format) strictly.

## Available Commands

- `/conductor:setup` - Initialize Conductor in a new project
- `/conductor:new <description>` - Create a new feature track
- `/conductor:implement [track_name]` - Execute a track's plan
- `/conductor:status` - View project progress
- `/conductor:revert` - Revert previous work

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BigCommerce Checkout JS is a browser-based React application providing the optimized one-page checkout experience for BigCommerce stores. It's a monorepo using Nx with 40+ packages organized into core application, shared utilities, and payment integrations.

## Common Commands

```bash
npm ci                    # Install dependencies (Node 20, npm 9 required)
npm run dev               # Watch mode development build
npm run dev:server        # Serve dev build at http://127.0.0.1:8080
npm run build             # Production build
npm test                  # Run all unit tests across packages
npm run test:core         # Run tests for core package only
npm run lint              # Run ESLint + TypeScript checks
npm run e2e               # Build and run Playwright E2E tests
npm run regenerate-har    # Regenerate HAR file IDs after manual edits
npm run generate          # Generate auto-exports for core package
```

### Running a Single Test
```bash
npx jest --config packages/core/jest.config.js path/to/test.spec.ts
```

### Running Tests for a Specific Package
```bash
npx nx run <package-name>:test
```

## Architecture

### Package Organization
- **packages/core/** - Main checkout React application
- **packages/payment-integration-api/** - API for payment integrations
- **packages/ui/** - Reusable UI components
- **packages/locale/** - i18n/localization
- **packages/analytics/** - Analytics integration
- **packages/*-integration/** - Payment provider integrations (27 providers: Stripe, Braintree, PayPal, Klarna, etc.)
- **packages/test-framework/**, **test-mocks/**, **test-utils/** - Testing utilities

### Core App Structure (packages/core/src/app/)
- **checkout/** - Main checkout flow and step management
- **customer/** - Customer info and sign-in
- **shipping/** - Shipping address and method selection
- **billing/** - Billing address section
- **payment/** - Payment method selection and forms
- **cart/** - Cart summary display
- **order/** - Order confirmation
- **embeddedCheckout/** - Iframe-based checkout support
- **ui/** - Shared UI components (forms, modals, loading states)

### FFL Dealer Integration

The checkout includes FFL (Federal Firearms License) dealer selection for firearm purchases. Key files:
- **checkout/dealer/** - Dealer selection components and types
- **order/appendFFLtoCheckoutNotes.ts** - Appends FFL info (license, expiration, certificate URL) to order comments

**Critical: Iframe Integration with automatic-ffl-map**

Dealer selection uses an iframe that loads from `STATIC_HOST` (the automatic-ffl-map app). The iframe communicates via `window.postMessage`:

- `DealerMessageListener` in `DealerShipping.tsx` receives `dealerUpdate` messages
- The dealer object structure must match between both codebases
- If new dealer fields are needed (e.g., `uuid` for certificate URLs), they must be added in BOTH:
  1. `automatic-ffl-map`: `src/components/Dealer/components/LocatorMap/utils.ts` (`handleSelect` function)
  2. This repo: `packages/core/src/app/checkout/dealer/types.ts` (DealerSelectionData interface)

### Nx Monorepo Scopes
Enforced by ESLint module boundaries:
- `scope:core` - Core app, can only depend on `scope:shared`
- `scope:shared` - Utilities/APIs, can only depend on `scope:shared`
- `scope:integration` - Payment integrations, can only depend on `scope:shared`

## Tech Stack
- React 17 + TypeScript 4.9
- Formik + Yup for forms
- @bigcommerce/checkout-sdk for state management (Redux-less)
- Webpack 5 for bundling
- Jest 26 + Enzyme + Testing Library for unit tests
- Playwright + Polly.js HAR mocking for E2E tests
- SCSS with CSS Modules

## Testing Patterns
- Unit tests colocated with source (*.spec.ts, *.test.tsx)
- Coverage threshold: 80% (branches, functions, lines, statements)
- E2E tests use HAR files for network replay - run `npm run regenerate-har` after editing HAR files
- Test utilities in packages/test-mocks use Faker.js for mock data

## Build Outputs
- **dist/** - Production build with content-hashed bundles
- **build/** - Development build
- Entry points: checkout.js (main app), auto-loader.js, loader.js
