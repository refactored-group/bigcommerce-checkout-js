# Development Workflow

## Overview
This document defines the development workflow for the BigCommerce Checkout for FFL fork, managed by Conductor.

## Task Execution Methodology

### Implementation Flow
For each task in a track's `plan.md`, follow this sequence:

1. **Understand** — Read the task description and related spec requirements.
2. **Implement** — Write the code changes required by the task.
3. **Verify** — Manually verify the implementation works as expected. The repo's existing Jest test suite (`npm test`) runs at 80% coverage; track tasks may include unit/E2E tests where appropriate but Conductor itself does not enforce test coverage.
4. **Record** — Add a brief git note summarizing the task (see Task Summaries below).

### Test Coverage
This Conductor workflow does NOT enforce test coverage thresholds at the task level. Two separate considerations apply:
- **Repo-level CI** — the BC fork's CI still runs `npm test` and the existing 80% Jest threshold continues to apply to merged code. Don't disable tests to land changes.
- **Track-level tests** — individual tracks may include test tasks when the spec calls for them. Otherwise, manual verification is the primary gate.

## Version Control

### Commit Frequency
- **Commit after each phase, not each task.** When all tasks in a phase are marked `[x]` in `plan.md` and the Phase Completion Verification has been performed, create a single commit covering the phase's work.
- This is a deliberate choice for this project — phase-level commits keep the upstream-merge-friendly fork history compact, while still preserving meaningful checkpoints.

### Commit Message Format
```
conductor(<track_id>): complete phase '<phase_name>'

<short summary of what the phase delivered>
```

### Task Summaries via Git Notes
- Use **Git Notes** to record per-task summaries against the phase commit.
- After each task within a phase is completed, attach a git note that describes what was done, key decisions, and any follow-ups.
- Format: `git notes append -m "<summary>"`
- The phase commit ends up with multiple notes attached — one per task — preserving the granular trail without inflating the commit history.

## Code Style
- Follow the code style guides in `conductor/code_styleguides/`:
    - **TypeScript / React:** `code_styleguides/typescript-react.md` — covers `.ts` and `.tsx` files, BC/Nx conventions, FFL fork hygiene
    - **SCSS:** `code_styleguides/scss.md` — covers `.scss` files, Stylelint conventions, design token usage
- The repo's `eslint`, `prettier`, and `stylelint` configs are the authoritative source — the style guides explain conventions and project-specific overlays.

## Fork Hygiene Checklist (per track)

Before completing any track that touches application code:
- [ ] FFL changes confined to `packages/core/src/app/checkout/dealer/` and/or `packages/core/src/app/order/appendFFLtoCheckoutNotes.ts` (or explicit justification for any other touchpoint)
- [ ] No casual reformatting of upstream BC files
- [ ] Cross-repo dealer-payload changes coordinated with `automatic-ffl-map` (see `product-guidelines.md`)
- [ ] No new top-level `packages/*` without explicit justification
- [ ] Lint passes: `npm run lint`
- [ ] Type check passes (part of lint)

## Phase Completion Verification and Checkpointing Protocol

At the end of each phase, the following verification steps MUST be performed:

1. **Review all tasks** — Confirm every task in the phase is marked `[x]` in `plan.md`.
2. **Manual verification** — The user must manually verify the phase's functionality works as expected in a BC test environment. For phases that involve checkout flow changes, this means running `npm run dev:server` and testing the relevant checkout path against a BC sandbox store.
3. **Lint pass** — Run `npm run lint` and confirm no new errors. Fix lint errors before proceeding.
4. **Update metadata** — Update the track's `metadata.json` with the current timestamp in `updated_at`.
5. **Phase commit** — Create a single commit covering all of the phase's work:
   ```
   conductor(<track_id>): complete phase '<phase_name>'
   ```
6. **Attach per-task git notes** — For each completed task in the phase, run `git notes append -m "<summary>"` against the phase commit, summarizing what the task delivered.
7. **User sign-off** — The user must explicitly confirm the phase is complete before proceeding to the next phase.

## File Modification Rules
- Follow existing patterns in the codebase — match the style of surrounding code.
- Prefer editing existing files over creating new ones when the change fits naturally.
- New TypeScript files use `.ts` for type/utility-only modules and `.tsx` for files containing JSX.
- New SCSS files use `.module.scss` for component-scoped styles.
- Do not add new top-level `packages/*` packages without explicit justification.

## Cross-Repo Coordination

This fork shares a `postMessage` payload contract with `automatic-ffl-map`. Tracks that touch the dealer payload must:

1. Identify the matching change required in `automatic-ffl-map`.
2. Open a coordinated PR (or note the dependency in the track's spec).
3. Stage rollouts so neither repo deploys a contract-breaking change ahead of the other.

When in doubt about whether a change is cross-repo, default to treating it as such and coordinate.

## Upstream Merging

- **Periodic upstream merges from `bigcommerce/checkout-js`** are part of fork maintenance, not part of any individual Conductor track unless explicitly scoped.
- When a track requires features from an upstream version, schedule the upstream merge as a prerequisite track.
