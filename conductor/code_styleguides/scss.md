# SCSS Style Guide

Conventions for `.scss` files in this BigCommerce Checkout JS fork. The repo's Stylelint config (`stylelint.config.js` + `stylelint-config-standard-scss` + `stylelint-order`) is the authoritative source — this guide explains the conventions and project-specific overlays.

## Linting

- **Stylelint 15** is enforced via `stylelint-webpack-plugin` during builds.
- PRs must pass `stylelint` checks.
- **No casual reformatting** of upstream SCSS files. Whitespace-only diffs inflate merge conflicts.

## Structure

- **CSS Modules** are the default for component-scoped styles. Use `*.module.scss` next to the component.
- **Global styles** live in shared style files imported at the app root. Don't add to global stylesheets unless the rule genuinely applies cross-cutting (e.g., reset rules, design tokens).
- **One stylesheet per component** when the component is non-trivial. Keep it next to the component file.

## Property ordering

`stylelint-order` enforces a deterministic property order. Don't fight it; let the linter sort. Common order:

1. Positioning (`position`, `top`, `right`, `bottom`, `left`, `z-index`)
2. Display & box model (`display`, `flex`, `grid`, `width`, `height`, `padding`, `margin`)
3. Typography (`font`, `line-height`, `color`, `text-*`)
4. Visual (`background`, `border`, `box-shadow`, `opacity`)
5. Animation (`transition`, `transform`, `animation`)
6. Misc (`cursor`, `pointer-events`, `user-select`)

## Naming

- **CSS Module class names:** camelCase. The `.module.scss` file is imported as a JS object — class names become object keys.
- **Global class names:** kebab-case. BC's existing global styles use kebab-case (`.checkout-step`, `.shipping-address`). Match the surrounding file's convention.
- **Avoid utility-style classes** in component SCSS. Don't reinvent `.flex-center` etc. — compose at the React level.
- **No leading underscores or BEM hacks.** If you need element/modifier scoping, use CSS Modules nesting.

## Selectors

- **Avoid deep nesting (>3 levels).** If you find yourself nesting deeper, the component probably needs to be decomposed.
- **No tag selectors at the top level** (`div { ... }`, `button { ... }`). Always scope to a class.
- **No `!important`** unless overriding a third-party widget that hard-codes specificity. If used, comment why.
- **Don't target BigCommerce internal classes** in style overrides. The same private-class concern that applies to JS DOM lookups (`product-guidelines.md` cross-repo notes) applies here.

## Variables & design tokens

- **Use `@bigcommerce/citadel` design tokens** where available. Don't define one-off color/spacing values in component SCSS.
- **Local variables** (`$component-padding: 16px;`) are fine for component-scoped values. Define at the top of the file.
- **No magic numbers** in production styles. If you need an exact pixel value, name it via a variable.
- **Color values** should reference Citadel tokens or shared color variables, not raw hex codes.

## Responsive

- **Mobile-first.** Base styles target the smallest viewport; `@media (min-width: ...)` adds desktop styles.
- **Use BC's existing breakpoint variables** when present. Don't define new breakpoint values per-file.
- **The dealer iframe modal must work at small viewports** — see `product-guidelines.md` Mobile considerations.

## Animations

- **Respect `prefers-reduced-motion`.** Wrap non-essential animations in:
  ```scss
  @media (prefers-reduced-motion: no-preference) {
      transition: ...;
  }
  ```
- **Keep transitions short** (150–250ms). Long transitions on form interactions feel laggy.

## Don'ts

- **Don't import another component's `.module.scss`** to reuse styles. Each component owns its own scope. Promote shared styles to a sibling `_shared.scss` partial or a UI package.
- **Don't add SCSS that duplicates Citadel design tokens.** If a token exists, use it.
- **Don't override upstream BC component styles in place** — wrap or compose at the React level instead, and add a small override SCSS scoped to your wrapper.
- **Don't use `:has()` for layout** until BC raises its browser baseline to confirm support is universal across the merchant target audience. (For functional behavior only, where degraded UX is acceptable, `:has()` is fine.)
- **No vendor prefixes by hand.** The build pipeline handles autoprefixing.
