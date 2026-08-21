# Specification

Replace `DealerShipping`'s overlapping AutoFFL consignment queues, selector cache, and stale-ID recovery with one feature-local coordinator that schedules complete AutoFFL routing intents around BigCommerce's public checkout SDK.

## Requirements

- Route dealer, customer, ammunition, manual-mode cleanup, and bypass mutations through the same latest-intent-wins scheduler.
- Treat selectors returned by BigCommerce as canonical after every mutation; keep no cross-transaction consignment cache.
- Use native `assignItemsToAddress`, `unassignItemsToAddress`, and `deleteConsignment` operations only.
- Verify final ownership using destination equivalence limited to observed BigCommerce normalization.
- Preserve existing policy, validation, UI state, notices, analytics, and explicit dealer identity behavior.
- Keep the existing ammo-only normalization fix and its regression coverage.
- Make bypass sequential and fail closed.
- Do not add custom reload recovery, a new UI status model, a generic queue framework, or cross-repo changes.
