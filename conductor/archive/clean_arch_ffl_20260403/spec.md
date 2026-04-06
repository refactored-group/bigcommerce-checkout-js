# Spec: Clean Architecture Refactor — FFL Dealer Module

## Overview
Refactor the FFL dealer checkout module (`packages/core/src/app/checkout/dealer/`) to address critical architectural issues identified in review. The module's central component `DealerShipping.tsx` (1,423 lines) is a god component that owns data fetching, domain logic, form state, address building, consignment orchestration, and rendering. This refactor decomposes it into focused, testable units following clean architecture principles while preserving all existing behavior.

## Functional Requirements

### 1. Remove Dead Code
- Delete `dealer.json` (17KB fixture in production source tree).
- Remove `debouncedAssignAddress` (declared but never assigned or used).
- Remove `isFFLRequiredState` (references non-existent `ammoFFLRequiredStates` state).
- Investigate `Locator.tsx`, `Map.tsx`, and `locator/` subdirectory — confirm if they are reachable after the iframe replacement. If unreachable, remove them.
- Remove any commented-out code in the dealer directory.

### 2. Extract Pure Domain Functions (`fflRules.ts`)
- Extract the following business rules from `DealerShipping.tsx` into pure functions in a new `fflRules.ts` file:
  - `getFFLItems(params)` — determines which cart items require FFL shipping
  - `hasFirearms(fflItems)` — checks if cart contains firearms
  - `hasAmmunition(stateRestrictedItems)` — checks if cart contains ammo
  - `hasOnlyAmmunition(fflItems, stateRestrictedItems)` — checks ammo-only cart
  - `hasAnyFflItems(fflItems)` — checks for any FFL items
  - `isStateFFLRequired(params)` — determines if a state requires FFL for ammo
- All functions must be pure (no `this.state`, no `this.props` — accept inputs as arguments).
- `DealerShipping` methods become one-line delegations to these functions.

### 3. Extract API Service (`fflApiService.ts`)
- Create `fflApiService.ts` that centralizes all external API calls:
  - `fetchStoreConfig(storeHash)` — replaces the constructor `fetch()` call
  - `logDealerSelection(storeHash, dealerId)` — replaces the inline `fetch()` in `selectDealer`
- Centralize URL construction using `process.env.HOST` in one location.
- `DealerShipping` calls the service instead of making direct `fetch()` calls.

### 4. Collapse Form State
- Replace the 16 individual `customXxxInput`/`customXxxInputError` state fields with:
  - `customShippingValues: Record<string, string>`
  - `customShippingErrors: Record<string, boolean>`
- Eliminate the triple-duplicated field-name mappings (`SDK_FIELD_TO_STATE_KEY`, `fieldIdToStateMap` in `onChangeCustomShippingField`, `getClearedCustomShippingFields`). Consolidate into a single mapping.
- Update `CustomShippingForm` to accept `values: Record<string, string>` and `errors: Record<string, boolean>` props.

### 5. Split Render Method into Child Components
- Extract the 4 marked JSX sections into focused presentation components:
  - `FFLConsignmentSection` — FFL item display, dealer selection modal, bypass toggle, custom form fields
  - `NonFFLConsignmentSection` — address selection for non-FFL items in multi-shipment
  - `AmmoAddressSelector` — logged-in user ammo address selection
  - `AmmoCustomShippingSection` — guest ammo custom shipping form + custom form fields
- Each component receives state and handlers via props from `DealerShipping`.
- `DealerShipping` becomes a thin orchestrator (~300 lines) composing these sections.

### 6. Consolidate FFL File Ownership
- Move `packages/core/src/app/shipping/getFflLineItems.tsx` into `checkout/dealer/`.
- Move `packages/core/src/app/order/appendFFLtoCheckoutNotes.ts` into `checkout/dealer/`.
- Update all import paths in files that reference these moved modules.
- Keep the directory name as `dealer/`.

### 7. Type the Module
- Remove `@ts-nocheck` directives from all files in the dealer directory.
- Replace `any` types in `DealerProps` with proper types (12 of 13 props are `any`).
- Replace `any` types in `DealerState` (5 fields are `any`).
- Type all function parameters and return types across the module.
- Target: zero `any` usage in the dealer directory.

## Non-Functional Requirements
- All existing checkout behavior must be preserved — this is a pure refactor with no feature changes.
- Each migration step must leave the codebase in a working state (no intermediate broken builds).
- The standard (non-FFL) checkout flow must remain completely unaffected.

## Acceptance Criteria
1. `dealer.json`, unused declarations, and confirmed dead code are removed.
2. All FFL business rules exist as pure functions in `fflRules.ts` with no React dependencies.
3. All external API calls are centralized in `fflApiService.ts`.
4. Custom shipping form state uses `Record<string, string>` — no individual `customXxxInput` fields.
5. `DealerShipping.tsx` is ~300 lines, composing 4 focused child components.
6. `getFflLineItems.tsx` and `appendFFLtoCheckoutNotes.ts` live in `checkout/dealer/`.
7. Zero `@ts-nocheck` directives and zero `any` types in the dealer directory.
8. FFL checkout flow works identically to before the refactor (firearms, ammo, bypass, custom fields).

## Out of Scope
- Renaming the `dealer/` directory to `ffl/`.
- Introducing React Context or other state management patterns.
- Changing the FFL checkout UX or behavior.
- Refactoring code outside the dealer module (except updating import paths for moved files).
- Migrating from class components to functional components.
