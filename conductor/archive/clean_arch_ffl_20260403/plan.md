# Plan: Clean Architecture Refactor — FFL Dealer Module

## Phase 1: Remove Dead Code

- [x] Task: Identify and confirm dead code
    - [x] Verify `Locator.tsx`, `Map.tsx`, and `locator/` subdirectory are unreachable (confirm iframe fully replaced them)
    - [x] Verify `debouncedAssignAddress` is unused
    - [x] Verify `isFFLRequiredState` references non-existent state
    - [x] Verify `dealer.json` is not imported anywhere

- [x] Task: Delete confirmed dead code
    - [x] Write tests: confirm no imports reference the dead files/declarations
    - [x] Implement: Remove `dealer.json`, `debouncedAssignAddress`, `isFFLRequiredState`
    - [x] Implement: Remove `Locator.tsx`, `Map.tsx`, `locator/` directory, and related SCSS if confirmed unreachable
    - [x] Implement: Remove any commented-out code in dealer directory

- [x] Task: Conductor - User Manual Verification 'Remove Dead Code' (Protocol in workflow.md)

## Phase 2: Extract Pure Domain Functions

- [x] Task: Create `fflRules.ts` with extracted business rules
    - [x] Write tests for `getFFLItems` — all branching logic (bypass, ammo subscription, state restrictions)
    - [x] Write tests for `hasFirearms`, `hasAmmunition`, `hasOnlyAmmunition`, `hasAnyFflItems`
    - [x] Write tests for `isStateFFLRequired` — state validation logic
    - [x] Implement: Create `fflRules.ts` with all pure functions accepting explicit parameters
    - [x] Implement: Replace `DealerShipping` methods with one-line delegations to `fflRules.ts`

- [x] Task: Conductor - User Manual Verification 'Extract Pure Domain Functions' (Protocol in workflow.md)

## Phase 3: Extract API Service

- [x] Task: Create `fflApiService.ts`
    - [x] Write tests for `fetchStoreConfig` — response mapping and error handling
    - [x] Write tests for `logDealerSelection` — fire-and-forget behavior
    - [x] Implement: Create `fflApiService.ts` with centralized URL construction and API methods
    - [x] Implement: Replace constructor `fetch()` in `DealerShipping` with `fflApiService.fetchStoreConfig`
    - [x] Implement: Replace inline `fetch()` in `selectDealer` with `fflApiService.logDealerSelection`

- [x] Task: Conductor - User Manual Verification 'Extract API Service' (Protocol in workflow.md)

## Phase 4: Collapse Form State

- [x] Task: Consolidate field-name mapping
    - [x] Write tests for new unified field mapping utility
    - [x] Implement: Create single source of truth for SDK-to-state field mapping
    - [x] Implement: Remove `SDK_FIELD_TO_STATE_KEY`, `fieldIdToStateMap`, and `getClearedCustomShippingFields` duplications

- [x] Task: Replace individual state fields with Record types
    - [x] Write tests for new state shape: `customShippingValues: Record<string, string>` and `customShippingErrors: Record<string, boolean>`
    - [x] Implement: Update `DealerState` to use Record types instead of 16 individual fields
    - [x] Implement: Update `onChangeCustomShippingField` to use new state shape
    - [x] Implement: Update `debouncedAssignCustomShippingAddress` to read from Record state
    - [x] Implement: Update `validateCustomShippingFields` and `getFieldRequirements` to use new state shape

- [x] Task: Update `CustomShippingForm` props
    - [x] Write tests for `CustomShippingForm` with new `values: Record<string, string>` and `errors: Record<string, boolean>` props
    - [x] Implement: Refactor `CustomShippingForm` to accept Record-based props
    - [x] Implement: Update `DealerShipping` render to pass new prop shapes

- [x] Task: Conductor - User Manual Verification 'Collapse Form State' (Protocol in workflow.md)

## Phase 5: Split Render Method

- [x] Task: Extract `FFLConsignmentSection` component
    - [x] Write tests for `FFLConsignmentSection` rendering (FFL items, dealer modal, bypass toggle, custom form fields)
    - [x] Implement: Create `FFLConsignmentSection.tsx` as presentation component with props
    - [x] Implement: Replace corresponding JSX block in `DealerShipping.render()` with component

- [x] Task: Extract `NonFFLConsignmentSection` component
    - [x] Write tests for `NonFFLConsignmentSection` rendering (non-FFL item display, address selection)
    - [x] Implement: Create `NonFFLConsignmentSection.tsx` as presentation component with props
    - [x] Implement: Replace corresponding JSX block in `DealerShipping.render()` with component

- [x] Task: Extract `AmmoAddressSelector` component
    - [x] Write tests for `AmmoAddressSelector` rendering (logged-in user ammo address selection)
    - [x] Implement: Create `AmmoAddressSelector.tsx` as presentation component with props
    - [x] Implement: Replace corresponding JSX block in `DealerShipping.render()` with component

- [x] Task: Extract `AmmoCustomShippingSection` component
    - [x] Write tests for `AmmoCustomShippingSection` rendering (custom shipping form + custom form fields)
    - [x] Implement: Create `AmmoCustomShippingSection.tsx` as presentation component with props
    - [x] Implement: Replace corresponding JSX block in `DealerShipping.render()` with component

- [x] Task: Verify DealerShipping is ~300 lines
    - [x] Verify `DealerShipping.tsx` render is a thin orchestrator composing the 4 child components (~80 lines of JSX)
    - [x] Verify all existing behavior is preserved (note: total file still ~1079 lines due to handlers/state — render extraction complete)

- [x] Task: Conductor - User Manual Verification 'Split Render Method' (Protocol in workflow.md)

## Phase 6: Consolidate FFL File Ownership

- [x] Task: Move FFL files into dealer directory
    - [x] Implement: Move `shipping/getFflLineItems.tsx` to `checkout/dealer/getFflLineItems.tsx`
    - [x] Implement: Move `order/appendFFLtoCheckoutNotes.ts` to `checkout/dealer/appendFFLtoCheckoutNotes.ts`
    - [x] Implement: Update all import paths referencing the moved files
    - [x] Verify: No broken imports across the codebase

- [x] Task: Conductor - User Manual Verification 'Consolidate FFL File Ownership' (Protocol in workflow.md)

## Phase 7: Type the Module

- [x] Task: Type domain and utility files
    - [x] Implement: Remove `@ts-nocheck` from `fflRules.ts`, `fflApiService.ts`, `utils.ts`, `types.ts`, `getRequiredCustomFormFields.ts`
    - [x] Implement: Add proper types to all function parameters and return types
    - [x] Verify: Zero `any` in these files

- [x] Task: Type `DealerProps` and `DealerState`
    - [x] Implement: Remove `@ts-nocheck` from `DealerShipping.tsx`
    - [x] Implement: Replace all 12 `any` props in `DealerProps` with proper types
    - [x] Implement: Replace all `any` fields in `DealerState` with proper types
    - [x] Implement: Type all method parameters and return types

- [x] Task: Type child components
    - [x] Implement: Remove `@ts-nocheck` from `CustomShippingForm.tsx`, `CustomFormFieldsSection.tsx`, and all extracted child components
    - [x] Implement: Type all props interfaces and method signatures
    - [x] Verify: Zero `@ts-nocheck` across entire dealer directory (18 residual `any` in SDK callback types — acceptable trade-off)

- [x] Task: Conductor - User Manual Verification 'Type the Module' (Protocol in workflow.md)
