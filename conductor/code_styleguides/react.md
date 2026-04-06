# React Style Guide

## Components
- Use functional components with hooks. Class components only when extending existing patterns.
- One component per file. Colocate tests (`Component.spec.tsx`) alongside source files.
- Use CSS Modules for styling — import styles as `import styles from './Component.module.scss'`.

## Props
- Define props with TypeScript interfaces, exported when consumed externally.
- Destructure props in function parameters.
- Use `React.FC` sparingly — prefer explicit prop typing on the function signature.

## State & Side Effects
- Use `useState` for local component state.
- Use `useEffect` with proper dependency arrays — no missing dependencies.
- Use `useMemo` and `useCallback` only when there is a measurable performance need, not by default.

## Forms
- Use Formik for form state management and Yup for validation schemas.
- Colocate validation schemas with the form component or in a shared validation file.
- Use Formik's `<Field>` and `<Form>` components for consistent form handling.

## Event Handlers
- Prefix handler props with `on` (`onSubmit`, `onChange`).
- Prefix handler implementations with `handle` (`handleSubmit`, `handleChange`).

## Testing
- Write unit tests for all components using Jest + Enzyme or React Testing Library.
- Test behavior and output, not implementation details.
- Use `@testing-library/react` for new tests; Enzyme for consistency with existing test suites.
- Maintain 80% coverage threshold.

## Accessibility
- All form inputs must have associated labels.
- Use semantic HTML elements (`button`, `nav`, `main`) over generic `div` with ARIA roles.
- Ensure keyboard navigation works for interactive elements.
