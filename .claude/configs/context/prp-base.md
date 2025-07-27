name: "TCM Platform PRP Template - Context-Rich Implementation"
description: |

## Purpose
Template for implementing new features in the TCM platform with proper context and validation loops.

## Core Principles
1. **Context is King**: Include ALL necessary documentation and examples
2. **Validation Loops**: Provide executable tests the AI can run and fix
3. **Progressive Success**: Start simple, validate, then enhance
4. **Follow Global Rules**: Adhere to all rules in .claude/CLAUDE.md

---

## Goal
[What specific feature/module needs to be built]

## Why
- [Business value in healthcare context]
- [Integration with existing platform features]
- [Problems this solves for users]

## What
[User-visible behavior and technical requirements]

### Success Criteria
- [ ] [Specific measurable outcomes]

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: [path/to/relevant/example.ts]
  why: [Pattern to follow, gotchas to avoid]
  
- url: [External API docs URL]
  why: [Specific sections/methods needed]
  
- file: [path/to/similar/implementation.ts]
  why: [Architecture pattern to mirror]
```

### Current Codebase Structure
```bash
# Run this to see current structure
tree src/ -I node_modules -L 3
```

### Desired Implementation Structure
```bash
# Add new files following existing patterns
src/
├── modules/
│   └── [new-feature]/
│       ├── controllers/
│       ├── services/
│       ├── dto/
│       └── __tests__/
```

### Platform-Specific Gotchas
```typescript
// CRITICAL: [Library/platform specific requirements]
// PATTERN: [How to properly implement in this codebase]
// GOTCHA: [Common mistakes to avoid]
```

## Implementation Blueprint

### Data Models and Structure
```typescript
// Define core data models first
// Examples: Prisma models, DTOs, interfaces
```

### Implementation Tasks (Sequential Order)
```yaml
Task 1:
  CREATE/MODIFY: [specific files]
  PATTERN: [follow this existing pattern]
  CRITICAL: [key requirements]

Task 2:
  CREATE/MODIFY: [specific files]
  PATTERN: [follow this existing pattern]
  CRITICAL: [key requirements]
```

### Integration Points
```yaml
DATABASE:
  - migration: [describe changes needed]
  
AUTH:
  - guards: [authentication requirements]
  
VALIDATION:
  - pipes: [validation requirements]
```

## Validation Loop

### Level 1: Code Quality
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint
npm run type-check
npm run test:unit

# Expected: No errors, meet coverage requirements
```

### Level 2: Integration Test
```typescript
// CREATE integration test following existing patterns
describe('Feature Integration', () => {
  // Test cases for the new feature
});
```

### Level 3: Manual Test
```bash
# Start application and test endpoints
npm run start:dev

# Test command/curl example
curl -X POST http://localhost:3000/api/v1/feature \
  -H "Content-Type: application/json" \
  -d '{"param": "value"}'
```

## Final Validation Checklist
- [ ] All tests pass
- [ ] No linting errors
- [ ] No type errors
- [ ] Manual test successful
- [ ] Integration points working
- [ ] Documentation updated if needed

---

## Anti-Patterns to Avoid
- ❌ Don't create new patterns when existing ones work
- ❌ Don't skip validation steps
- ❌ Don't ignore failing tests
- ❌ Don't bypass existing architecture patterns