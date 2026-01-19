# Testing Patterns

**Analysis Date:** 2026-01-19

## Test Framework

**Runner:**
- Not configured
- No test framework detected in project

**Assertion Library:**
- None

**Run Commands:**
```bash
# No test commands available
```

**Status:**
- No testing infrastructure present in either frontend or backend
- No test files exist outside of node_modules dependencies

## Test File Organization

**Location:**
- No test files present

**Naming:**
- Not applicable - no tests

**Structure:**
```
No test directory structure exists
```

## Test Structure

**Suite Organization:**
```typescript
// No test suites defined
```

**Patterns:**
- Not applicable - no testing patterns established

## Mocking

**Framework:**
- None configured

**Patterns:**
```typescript
// No mocking patterns present
```

**What to Mock:**
- No guidelines established

**What NOT to Mock:**
- No guidelines established

## Fixtures and Factories

**Test Data:**
```typescript
// No test fixtures or factories present
```

**Location:**
- Not applicable

## Coverage

**Requirements:**
- None enforced

**View Coverage:**
```bash
# No coverage tooling configured
```

## Test Types

**Unit Tests:**
- Not present
- Would be appropriate for:
  - Adapter parsing logic (`tempo-csv.adapter.ts`, `toggl-csv.adapter.ts`)
  - Date utility functions (`getPresetRange` in `App.tsx`)
  - Duration parsing (`parseDuration` in `toggl-csv.adapter.ts`)

**Integration Tests:**
- Not present
- Would be appropriate for:
  - API routes (`/api/stats`, `/api/upload`, `/api/sync/*`)
  - Service layer (TogglService, TempoService)
  - Database operations (Prisma integration)

**E2E Tests:**
- Not present
- Would be appropriate for:
  - CSV upload flow
  - Sync workflows (Toggl, Tempo)
  - Time entry CRUD operations

## Common Patterns

**Async Testing:**
```typescript
// No async testing patterns established
```

**Error Testing:**
```typescript
// No error testing patterns established
```

## Recommendations for Testing Implementation

**Suggested Test Framework Setup:**

**Backend (Fastify + Prisma):**
- Jest or Vitest for test runner
- Supertest for HTTP endpoint testing
- Prisma test database setup with SQLite in-memory
- Mock Axios for external API calls (Toggl, Tempo)

**Frontend (React + Vite):**
- Vitest (already compatible with Vite config)
- React Testing Library for component testing
- MSW (Mock Service Worker) for API mocking

**Priority Test Targets:**

1. **Critical Path Testing:**
   - CSV parsing adapters (high complexity, data transformation)
   - API sync services (external dependencies, caching logic)
   - Database upsert operations (deduplication logic)

2. **Edge Cases:**
   - Invalid CSV formats
   - Missing environment variables
   - API timeout/error responses
   - Cache expiration logic

3. **Data Integrity:**
   - Synthetic ID generation for CSV imports
   - Date parsing across different formats
   - Duration conversion (seconds to hours, HH:MM:SS to decimal)

---

*Testing analysis: 2026-01-19*
