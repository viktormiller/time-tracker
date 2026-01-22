# Quick Test Guide

## Run All Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## Test Coverage

### Backend: 2 test files, 25+ test cases
✅ Timezone conversion (Seoul, Berlin, NYC, LA, India)
✅ UTC storage verification
✅ Cross-day handling
✅ DST transitions
✅ Duration calculation
✅ API integration

### Frontend: 2 test files, 20+ test cases
✅ Timezone utilities (get/set/clear)
✅ Duration calculation
✅ Browser timezone detection
✅ Timezone persistence
✅ Edge cases & precision

## Key Test Scenarios Covered

### 1. Seoul Time (UTC+9)
```
Input:  2026-01-22 11:00 (Seoul)
Stored: 2026-01-22 02:00 (UTC)
Display:
  - Seoul: 11:00
  - Berlin: 03:00
```

### 2. Cross-Day Entries
```
Input:  2026-01-22 23:00 (LA)
Stored: 2026-01-23 07:00 (UTC)
Display:
  - LA: 23:00 (Jan 22)
  - Seoul: 16:00 (Jan 23)
```

### 3. Duration Calculation
```
11:00 → 11:30 = 0.5 hours
09:17 → 12:43 = 3.43 hours
09:00 → 17:00 = 8.0 hours
```

## Watch Mode (Auto-rerun on changes)

```bash
# Backend
cd backend && npm run test:watch

# Frontend
cd frontend && npm run test:watch
```

See `TESTING.md` for full documentation.
