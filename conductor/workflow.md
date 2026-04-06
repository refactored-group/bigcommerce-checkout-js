# Development Workflow

## Methodology: Test-Driven Development (TDD)

All feature and bug fix tasks follow a TDD workflow:
1. **Write Tests** — Write failing tests that define the expected behavior.
2. **Implement** — Write the minimum code to make the tests pass.
3. **Refactor** — Clean up the implementation while keeping tests green.

## Code Coverage
- **Required threshold:** 80% (branches, functions, lines, statements)
- Run tests with coverage before marking any task as complete.

## Commit Policy
- **Frequency:** Commit changes after every completed task.
- **Format:** Use conventional commit messages (e.g., `feat:`, `fix:`, `refactor:`, `test:`, `chore:`).
- **Task Summary:** Use Git Notes to record task summaries on commits.

## Task Execution Rules
1. Read the task description and acceptance criteria before starting.
2. For feature tasks, follow the TDD cycle: Write Tests → Implement → Refactor.
3. Run the full test suite for the affected package(s) before committing.
4. Do not modify files outside the scope of the current task without explicit approval.

## Phase Completion Verification and Checkpointing Protocol
At the end of each phase, the following steps MUST be performed:
1. **Verify all tasks** in the phase are marked as completed.
2. **Run the full test suite** for all affected packages and confirm all tests pass.
3. **Run the linter** and confirm no new warnings or errors.
4. **User review** — Present a summary of all changes made in the phase and request explicit user approval before proceeding to the next phase.
5. **Checkpoint** — Once approved, create a commit marking the phase as complete.
