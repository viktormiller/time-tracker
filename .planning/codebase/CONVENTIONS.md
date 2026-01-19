# Coding Conventions

**Analysis Date:** 2026-01-19

## Naming Patterns

**Files:**
- TypeScript files use `.ts` extension for backend
- TypeScript React files use `.tsx` extension for frontend components
- Adapter pattern files: `{name}.adapter.ts` (e.g., `tempo-csv.adapter.ts`, `toggl-csv.adapter.ts`)
- Service pattern files: `{name}.service.ts` (e.g., `tempo.service.ts`, `toggl.service.ts`)
- Interface files: `{name}.interface.ts` (e.g., `import-adapter.interface.ts`)
- Config files use kebab-case: `vite.config.ts`, `eslint.config.js`, `tailwind.config.js`

**Functions:**
- Async functions: `async functionName()` pattern
- Arrow functions for handlers: `const handleEvent = () => {}`
- camelCase for all function names: `fetchData`, `deleteEntry`, `syncToggl`, `getPresetRange`
- Async arrow functions for component methods: `const updateEntry = async (entry: TimeEntry) => {}`

**Variables:**
- camelCase for local variables: `entries`, `loading`, `filterSource`, `dateRange`
- UPPER_SNAKE_CASE for constants: `API_URL`, `CACHE_FILE`, `CACHE_DURATION_MS`
- State variables use descriptive names with `is`, `has`, or `show` prefixes for booleans: `isCustomSync`, `usedCache`, `showSyncModal`
- Temporal state uses gerunds: `loading`, `uploading`, `syncing`

**Types:**
- PascalCase for interfaces: `TimeEntry`, `DailyStats`, `ImportResult`, `ImportAdapter`
- PascalCase for type aliases: `SortKey`, `SortDirection`, `DatePreset`
- Type aliases for unions: `type DatePreset = 'TODAY' | 'WEEK' | ...`

**Classes:**
- PascalCase: `TogglService`, `TempoService`, `TempoCsvAdapter`, `TogglCsvAdapter`, `PrismaClient`
- Service suffix for service classes: `{Name}Service`
- Adapter suffix for adapter pattern: `{Name}Adapter`

## Code Style

**Formatting:**
- No Prettier configuration detected
- Indentation: 2 spaces (frontend) and 4 spaces (backend - inconsistent)
- Semicolons: Not enforced consistently (some present, some absent)
- String quotes: Single quotes preferred in most places
- Template literals used for string interpolation: `` `${variable}` ``

**Linting:**
- Tool: ESLint v9.39.1 (frontend only)
- Config: `frontend/eslint.config.js`
- Rules:
  - `@eslint/js` recommended config
  - TypeScript ESLint recommended config
  - React Hooks rules (flat config)
  - React Refresh rules for Vite
- Backend: No ESLint configuration detected
- Target: ES2020 (backend), ES2022 (frontend)

**TypeScript:**
- Strict mode enabled in both frontend and backend
- Frontend-specific compiler options:
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noFallthroughCasesInSwitch: true`
  - Module resolution: `bundler` (frontend), `node` (backend)
- Backend uses CommonJS (`module: "commonjs"`)
- Frontend uses ESNext modules (`module: "ESNext"`)

## Import Organization

**Order:**
1. External dependencies (npm packages)
2. Internal relative imports (adapters, services, interfaces)
3. CSS imports (last)

**Frontend Example:**
```typescript
import { useEffect, useState } from 'react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
```

**Backend Example:**
```typescript
import 'dotenv/config';  // Config imports first
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { TogglService } from './services/toggl.service';
import { ImportAdapter, ImportResult } from './import-adapter.interface';
```

**Path Aliases:**
- None configured - all imports use relative paths (`./`, `../`)

**Type-only Imports:**
- Use `type` keyword for type-only imports: `import { type DateRange } from 'react-day-picker'`

## Error Handling

**Patterns:**
- Try-catch blocks with inline catch for simple operations
- Inline try-catch: `try { ... } catch (e) { alert('Error') }`
- Axios errors checked with type guard: `if (axios.isAxiosError(error))`
- Error messages accessed via: `error.response?.data?.error` or `(error as Error).message`
- Backend uses Fastify logger: `req.log.error(error)` and `app.log.error(err)`
- Frontend uses `console.error()` for logging errors

**Error Responses (Backend):**
- HTTP 400 for bad requests: `reply.code(400).send({ error: 'message' })`
- HTTP 500 for server errors: `reply.code(500).send({ error: 'message' })`
- Return error objects with `{ error: string }` structure

**User Feedback (Frontend):**
- Alert dialogs for errors: `alert('Fehler beim Löschen')`
- Confirm dialogs for destructive actions: `confirm('Möchtest du diesen Eintrag wirklich löschen?')`

## Logging

**Framework:**
- Backend: Fastify built-in logger (`app.log`, `req.log`)
- Frontend: Native `console` methods

**Patterns:**
- Prefix log messages with context: `[Toggl]`, `[Tempo]`, `[API Route]`, `[Toggl DB]`
- Use structured logging for debugging: `console.log('[Context] Message:', data)`
- Debug logs include detailed state: `JSON.stringify(entries[0], null, 2)`
- Backend logs requests and API interactions extensively
- Frontend uses minimal logging (mostly errors and debug)

**When to Log:**
- API requests and responses
- Cache hits/misses
- Database operations (entry counts)
- Error conditions
- Custom sync operations with parameters

## Comments

**When to Comment:**
- Workarounds and fixes: `// FIX: 'type DateRange' verhindert den Absturz`
- Section headers: `// --- STATE ---`, `// --- API CALLS ---`
- Complex logic explanations
- API format descriptions in adapters
- German comments are prevalent throughout the codebase

**JSDoc/TSDoc:**
- Not used in this codebase
- No function documentation comments

**Inline Comments:**
- Explain WHY not WHAT
- Mark sections with visual separators: `// ---`
- Label numbered steps: `// 1. Cache Prüfung`, `// 2. API Abruf`

## Function Design

**Size:**
- Component functions can be large (App.tsx ~600+ lines)
- Service methods are medium-sized (20-100 lines)
- Adapter methods are focused (single responsibility)

**Parameters:**
- Optional parameters use `?` syntax: `customStart?: string`
- Default values in function signature: `forceRefresh = false`
- Destructuring for object parameters: `const { startDate, endDate } = req.body || {}`

**Return Values:**
- Explicit return types on interfaces only
- Async functions return Promises implicitly
- Success responses return objects: `{ message: string, count: number }`
- Void returns for handlers and side effects

**Async/Await:**
- Preferred over Promise chains
- Used consistently throughout codebase
- Try-catch blocks wrap async operations

## Module Design

**Exports:**
- Named exports for classes: `export class TogglService`
- Default export for React components: `export default defineConfig`
- Interface exports: `export interface ImportAdapter`

**Barrel Files:**
- Not used in this codebase
- Direct imports from specific files

**File Organization:**
- One class/component per file
- Interfaces can be co-located or separate
- Helper functions defined in same file as usage (e.g., `getPresetRange` in `App.tsx`)

---

*Convention analysis: 2026-01-19*
