# Architecture

**Analysis Date:** 2026-01-19

## Pattern Overview

**Overall:** Monorepo with separate client-server architecture

**Key Characteristics:**
- Backend: RESTful API using Fastify with Prisma ORM
- Frontend: React SPA with Vite
- Database: SQLite via Prisma
- External API integration with Toggl and Tempo time tracking services

## Layers

**API Layer (Backend):**
- Purpose: HTTP request handling, routing, and response formatting
- Location: `backend/src/server.ts`
- Contains: REST endpoints, Fastify plugins (CORS, multipart)
- Depends on: Services, Adapters, Prisma Client
- Used by: Frontend via HTTP requests

**Service Layer:**
- Purpose: Business logic for external API synchronization and data transformation
- Location: `backend/src/services/`
- Contains: `toggl.service.ts`, `tempo.service.ts` for external API integration
- Depends on: Prisma Client, axios, file system (for caching)
- Used by: API routes in server.ts

**Adapter Layer:**
- Purpose: Data transformation between different CSV formats and internal models
- Location: `backend/src/adapters/`
- Contains: CSV parsing adapters (`toggl-csv.adapter.ts`, `tempo-csv.adapter.ts`)
- Depends on: csv-parse library, date-fns, Prisma types
- Used by: Upload endpoint for CSV file processing

**Data Access Layer:**
- Purpose: Database operations and schema management
- Location: `backend/prisma/`
- Contains: Prisma schema, migrations, generated client
- Depends on: SQLite database
- Used by: Services and API routes via PrismaClient

**Presentation Layer (Frontend):**
- Purpose: User interface rendering and client-side state management
- Location: `frontend/src/`
- Contains: React components, primarily in `App.tsx`
- Depends on: Backend API via axios
- Used by: End users via browser

## Data Flow

**CSV Upload Flow:**

1. User uploads CSV file via frontend
2. Frontend POST to `/api/upload` with multipart/form-data
3. Backend detects CSV format (Toggl vs Tempo) based on filename/content
4. Appropriate adapter parses CSV into TimeEntry objects
5. Prisma upserts entries into database using `source + externalId` as unique key
6. Response returns count of imported entries and errors

**External API Sync Flow:**

1. User triggers sync (Toggl or Tempo) via frontend
2. Frontend POST to `/api/sync/toggl` or `/api/sync/tempo`
3. Service checks cache file (10-minute TTL) unless force refresh requested
4. If cache miss: fetch data from external API (Toggl/Tempo)
5. Transform API response to TimeEntry format
6. Upsert entries into database
7. Update cache file with fresh data
8. Return sync statistics to frontend

**Data Retrieval Flow:**

1. Frontend requests data via GET `/api/stats`
2. Backend queries all TimeEntry records via Prisma
3. Returns entries ordered by date descending
4. Frontend aggregates by date and source for visualization

**State Management:**
- Backend: Stateless except for file-based caching (JSON cache files)
- Frontend: Local component state with useState hooks
- Database: Single source of truth for time entries

## Key Abstractions

**TimeEntry (Data Model):**
- Purpose: Unified representation of time tracking data from any source
- Examples: `backend/prisma/schema.prisma`
- Pattern: Single table with `source` field for multi-tenancy

**ImportAdapter (Interface):**
- Purpose: Strategy pattern for different CSV formats
- Examples: `backend/src/adapters/import-adapter.interface.ts`, `toggl-csv.adapter.ts`, `tempo-csv.adapter.ts`
- Pattern: Interface-based adapter with async parse method

**Service Classes:**
- Purpose: Encapsulation of external API integration logic
- Examples: `backend/src/services/toggl.service.ts`, `backend/src/services/tempo.service.ts`
- Pattern: Class-based services with PrismaClient dependency injection

## Entry Points

**Backend Server:**
- Location: `backend/src/server.ts`
- Triggers: `npm run dev` (via nodemon + ts-node) or `npm start` (compiled)
- Responsibilities: Initialize Fastify, register plugins, define routes, start HTTP server on port 3000

**Frontend Application:**
- Location: `frontend/src/main.tsx`
- Triggers: Loaded by `frontend/index.html` via Vite dev server
- Responsibilities: Render React root component (App.tsx) into DOM

**Database Migrations:**
- Location: `backend/prisma/migrations/`
- Triggers: Manual via `prisma migrate dev` or `prisma migrate deploy`
- Responsibilities: Schema evolution tracking

## Error Handling

**Strategy:** Explicit try-catch with HTTP status codes

**Patterns:**
- Backend routes use try-catch blocks, return 500 status codes with error messages
- Services throw errors that propagate to route handlers
- Adapters collect parsing errors in `ImportResult.errors` array without throwing
- Frontend logs errors to console, displays error states in UI

## Cross-Cutting Concerns

**Logging:** Fastify built-in logger (Pino), console.log statements for debugging

**Validation:** Minimal - basic null checks, reliance on TypeScript types and Prisma schema validation

**Authentication:** None - open API endpoints

---

*Architecture analysis: 2026-01-19*
