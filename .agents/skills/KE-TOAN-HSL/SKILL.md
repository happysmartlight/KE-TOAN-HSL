```markdown
# KE-TOAN-HSL Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill covers the core development patterns and conventions used in the `KE-TOAN-HSL` TypeScript codebase. It documents file organization, code style, commit practices, and testing patterns to help contributors maintain consistency and quality in the project.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userService.ts`, `invoiceManager.ts`

### Import Style
- Use **relative imports** for referencing other modules.
  - Example:
    ```typescript
    import { calculateTax } from './taxUtils';
    ```

### Export Style
- Use **named exports** for functions, classes, or constants.
  - Example:
    ```typescript
    // taxUtils.ts
    export function calculateTax(amount: number): number {
      // ...
    }
    ```

### Commit Patterns
- Commit messages are **freeform**, sometimes prefixed (e.g., `security:`).
- Average commit message length: **76 characters**.
  - Example:
    ```
    security: update dependencies to address vulnerability in lodash
    ```

## Workflows

_No automated workflows detected in this repository._

## Testing Patterns

- Test files follow the pattern: `*.test.*`
  - Example: `userService.test.ts`
- Testing framework is **unknown** (not detected).
- To write a test:
  1. Create a test file alongside the module, using the `.test.ts` suffix.
  2. Use your preferred testing library (e.g., Jest, Mocha).
  3. Structure tests clearly and use descriptive names.

  Example:
  ```typescript
  // userService.test.ts
  import { getUser } from './userService';

  describe('getUser', () => {
    it('returns user data for a valid ID', () => {
      // test implementation
    });
  });
  ```

## Commands

| Command | Purpose |
|---------|---------|
| /test   | Run all test files matching `*.test.*` pattern |
| /lint   | Lint the codebase for style and errors (if linter is configured) |
| /commit | Commit changes following the repository's commit message conventions |
```
