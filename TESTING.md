# Testing Guide

This document describes the testing setup and how to run tests for the time-tracker application.

## Test Coverage

### Backend Tests
Location: `backend/src/__tests__/`

**Timezone Conversion Tests** (`timezone.test.ts`)
- Manual entry creation with different timezones (Seoul, Berlin, New York, LA)
- UTC storage verification
- Cross-day handling (midnight and late evening)
- Duration calculation
- Round-trip timezone conversion
- Daylight Saving Time (DST) transitions

**API Integration Tests** (`entries-api.test.ts`)
- POST /api/entries - Manual entry creation with timezone
- PUT /api/entries/:id - Manual entry updates with timezone
- Display conversion (UTC to user timezone)
- Edge cases (UTC timezone, partial hour timezones like India UTC+5:30)

### Frontend Tests
Location: `frontend/src/lib/__tests__/`

**Timezone Utilities** (`timezone.test.ts`)
- `getTimezone()` - Get user's timezone preference
- `setTimezone()` - Store timezone preference
- `clearTimezone()` - Remove timezone preference
- `getBrowserTimezone()` - Get browser detected timezone
- Timezone persistence across sessions
- SSR handling (server-side rendering)

**Duration Calculation** (`duration.test.ts`)
- Standard work hours (9-5, half day, etc.)
- Fractional hours (30min, 15min, 45min)
- Irregular times (09:17 to 12:43)
- Edge cases (1 minute, nearly full day, midnight)
- Precision testing

## Running Tests

### Backend Tests

#### Install dependencies (first time only)
```bash
cd backend
npm install --legacy-peer-deps
```

#### Run all tests
```bash
cd backend
npm test
```

#### Run tests in watch mode (auto-rerun on file changes)
```bash
cd backend
npm run test:watch
```

#### Run specific test file
```bash
cd backend
npx vitest run src/__tests__/timezone.test.ts
```

### Frontend Tests

#### Install dependencies (first time only)
```bash
cd frontend
npm install
```

#### Run all tests
```bash
cd frontend
npm test
```

#### Run tests in watch mode
```bash
cd frontend
npm run test:watch
```

#### Run specific test file
```bash
cd frontend
npx vitest run src/lib/__tests__/timezone.test.ts
```

## Test Framework

Both backend and frontend use **Vitest** as the test framework.

**Why Vitest?**
- Fast execution with native ESM support
- TypeScript-first design
- Compatible with Vite build tool
- Jest-compatible API
- Built-in code coverage

### Backend Stack
- **Vitest**: Test runner
- **Node environment**: Tests run in Node.js

### Frontend Stack
- **Vitest**: Test runner
- **@testing-library/react**: Component testing utilities
- **happy-dom**: Lightweight DOM implementation
- **@testing-library/user-event**: User interaction simulation

## Key Test Scenarios

### Timezone Behavior

#### Creating entries in Seoul (UTC+9)
```typescript
// User enters 11:00 Seoul time
// Backend stores as 02:00 UTC (11:00 - 9 hours)
// When displayed in Seoul: shows 11:00
// When displayed in Berlin (UTC+1): shows 03:00
```

#### Cross-day scenarios
```typescript
// User in LA enters 23:00 on Jan 22
// Stored as 07:00 UTC on Jan 23
// When displayed in Seoul (UTC+9): shows 16:00 on Jan 23
```

#### DST transitions
- Tests verify correct handling when timezones shift between standard and daylight saving time
- Berlin: UTC+1 (winter) → UTC+2 (summer)
- New York: UTC-5 (winter) → UTC-4 (summer)

### Duration Calculation
```typescript
calculateDuration('11:00', '11:30')  // Returns 0.5 (30 minutes)
calculateDuration('09:00', '17:00')  // Returns 8.0 (8 hours)
calculateDuration('09:17', '12:43')  // Returns 3.43 (3 hours 26 minutes)
```

## Running Tests in CI/CD

To run tests as part of a CI/CD pipeline:

```bash
# Backend
cd backend && npm install --legacy-peer-deps && npm test

# Frontend
cd frontend && npm install && npm test
```

## Running Tests in Docker (Optional)

To run tests during Docker build, uncomment the test line in the Dockerfile:

```dockerfile
# In docker/backend/Dockerfile
RUN npm run test
```

This will fail the build if tests don't pass.

## Code Coverage

### Generate coverage report
```bash
# Backend
cd backend
npx vitest run --coverage

# Frontend
cd frontend
npx vitest run --coverage
```

Coverage reports will be generated in:
- Backend: `backend/coverage/`
- Frontend: `frontend/coverage/`

Open `coverage/index.html` in a browser to view the detailed coverage report.

## Writing New Tests

### Backend Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { fromZonedTime } from 'date-fns-tz';

describe('My Feature', () => {
  it('should convert timezone correctly', () => {
    const utcDate = fromZonedTime('2026-01-22T11:00:00', 'Asia/Seoul');
    expect(utcDate.getUTCHours()).toBe(2);
  });
});
```

### Frontend Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { getTimezone } from '../timezone';

describe('Timezone Utils', () => {
  it('should return stored timezone', () => {
    localStorage.setItem('user_timezone_preference', 'Asia/Seoul');
    expect(getTimezone()).toBe('Asia/Seoul');
  });
});
```

## Troubleshooting

### Tests fail with "Cannot find module"
- Ensure dependencies are installed: `npm install`
- Check import paths are correct

### Tests hang in watch mode
- Press 'q' to quit
- Check for infinite loops in test code

### Coverage reports are empty
- Ensure you're running tests with `--coverage` flag
- Check that test files are in the correct location

## Best Practices

1. **Test timezone-sensitive code thoroughly**: Always test with multiple timezones including edge cases
2. **Test DST transitions**: Verify behavior around daylight saving time changes
3. **Use descriptive test names**: Describe what the test verifies, not what it does
4. **Keep tests focused**: One assertion per test when possible
5. **Mock external dependencies**: Don't rely on actual API calls in unit tests
6. **Test edge cases**: Midnight, cross-day, minimal durations, etc.

## Future Enhancements

- Integration tests with actual database
- E2E tests with Playwright
- Visual regression tests
- Performance benchmarks
- Mutation testing
