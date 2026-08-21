# Implementation Plan

## Phase 1: Lean coordinator refactor

- [x] Preserve and verify the existing ammo-only address-normalization fix.
- [x] Add a feature-local coordinator with latest-intent-wins scheduling, canonical SDK selector flow, native assignment/unassignment, final ownership verification, sequential clear-all, and disposal.
- [x] Add focused coordinator tests for no-op routing, address normalization, item movement, canonical selector chaining, supersession, disposal, clear-all failure, and invalid plans.
- [x] Route dealer, customer, ammunition, missing-recipient, manual, and bypass mutations through the coordinator.
- [x] Remove obsolete queue, revision, consignment cache, dealer-drain, manual update/delete arithmetic, and reload-recovery plumbing.
- [x] Preserve existing UI state and error wrappers; add only targeted component regression coverage.
- [x] Run focused tests, formatting, lint/type checks, build, and diff review.

### Phase Completion Verification

- [x] Focused automated verification passes; pre-existing repository lint and standard Jest bootstrap blockers are recorded.
- [x] Original guest ammo-only unrestricted checkout succeeds after BigCommerce normalizes the address.
- [x] Restricted/unrestricted routing, rapid dealer/address changes, manual mode, bypass, and notice dismissal are manually verified in the BigCommerce test store.
- [x] User signs off before the phase commit.
