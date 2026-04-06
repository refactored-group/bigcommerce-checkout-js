# TypeScript Style Guide

## General
- Use TypeScript strict mode with null checks enabled.
- Target ES5 for broad browser compatibility.
- Prefer `interface` over `type` for object shapes unless union types are needed.
- Use explicit return types on exported functions.
- Avoid `any` — use `unknown` and narrow with type guards when the type is uncertain.

## Naming Conventions
- **Files:** camelCase for utilities (`formatAddress.ts`), PascalCase for components (`ShippingForm.tsx`).
- **Interfaces/Types:** PascalCase, no `I` prefix (`CheckoutState`, not `ICheckoutState`).
- **Enums:** PascalCase for enum name, PascalCase for members.
- **Constants:** UPPER_SNAKE_CASE for true constants, camelCase for derived values.
- **Functions/Variables:** camelCase.
- **React Components:** PascalCase.

## Imports
- Group imports: external packages first, then internal packages, then relative imports.
- Use path aliases defined in `tsconfig.base.json` for cross-package imports.
- Respect Nx module boundary scopes (`scope:core`, `scope:shared`, `scope:integration`).

## Error Handling
- Use typed error objects over generic `Error` throws where possible.
- Handle promise rejections — no unhandled promises.

## Null Safety
- Prefer optional chaining (`?.`) and nullish coalescing (`??`) over manual null checks.
- Avoid non-null assertions (`!`) unless the context makes it provably safe.
