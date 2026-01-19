# Codebase Structure

**Analysis Date:** 2026-01-19

## Directory Layout

```
time-tracker/
├── backend/                    # Backend API server
│   ├── prisma/                # Database schema and migrations
│   │   ├── migrations/        # Prisma migration history
│   │   ├── schema.prisma      # Database schema definition
│   │   └── dev.db             # SQLite database file
│   ├── src/                   # Backend source code
│   │   ├── adapters/          # CSV parsing adapters
│   │   ├── services/          # External API integration services
│   │   └── server.ts          # Main server file with routes
│   ├── package.json           # Backend dependencies
│   ├── tsconfig.json          # TypeScript configuration (CommonJS)
│   ├── .env                   # Environment variables (gitignored)
│   ├── tempo_cache.json       # Tempo API response cache
│   └── toggl_cache.json       # Toggl API response cache
├── frontend/                  # Frontend React application
│   ├── public/                # Static assets
│   ├── src/                   # Frontend source code
│   │   ├── assets/            # Images, icons
│   │   ├── App.tsx            # Main application component (610 lines)
│   │   ├── App.css            # Component styles
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Global styles (Tailwind)
│   ├── package.json           # Frontend dependencies
│   ├── vite.config.ts         # Vite bundler configuration
│   ├── tsconfig.json          # TypeScript root config
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   └── index.html             # HTML entry point
├── .planning/                 # GSD planning documents
│   └── codebase/              # Codebase analysis documents
├── .gitignore                 # Git ignore rules
└── AGEND.md                   # Project agenda
```

## Directory Purposes

**backend/:**
- Purpose: Node.js API server with Fastify
- Contains: TypeScript source, Prisma ORM setup, cache files
- Key files: `src/server.ts` (main entry), `prisma/schema.prisma` (data model)

**backend/src/adapters/:**
- Purpose: CSV format transformation adapters
- Contains: Adapter interface and concrete implementations for Toggl/Tempo
- Key files: `import-adapter.interface.ts`, `toggl-csv.adapter.ts`, `tempo-csv.adapter.ts`

**backend/src/services/:**
- Purpose: External API integration logic
- Contains: Service classes for Toggl and Tempo APIs
- Key files: `toggl.service.ts`, `tempo.service.ts`

**backend/prisma/:**
- Purpose: Database schema and migration management
- Contains: Prisma schema, migration files, SQLite database
- Key files: `schema.prisma`, `dev.db`, `migrations/`

**frontend/:**
- Purpose: React SPA with Vite
- Contains: TypeScript/TSX components, styles, build configuration
- Key files: `src/main.tsx` (entry), `src/App.tsx` (main UI), `vite.config.ts`

**frontend/src/:**
- Purpose: All React application code
- Contains: Single-file application component, styles, assets
- Key files: `App.tsx` (all UI logic and state), `main.tsx` (React root render)

**.planning/codebase/:**
- Purpose: GSD-generated codebase analysis documents
- Contains: Architecture and structure documentation
- Key files: `ARCHITECTURE.md`, `STRUCTURE.md`

## Key File Locations

**Entry Points:**
- `backend/src/server.ts`: Backend HTTP server entry point
- `frontend/src/main.tsx`: Frontend React application entry point
- `frontend/index.html`: HTML document root

**Configuration:**
- `backend/tsconfig.json`: TypeScript config (CommonJS, target ES2020)
- `frontend/vite.config.ts`: Vite dev server with API proxy to port 3000
- `backend/prisma/schema.prisma`: Database schema (SQLite)
- `backend/.env`: Environment variables (API tokens)
- `frontend/tailwind.config.js`: Tailwind CSS configuration

**Core Logic:**
- `backend/src/server.ts`: All REST API routes and business logic
- `backend/src/services/toggl.service.ts`: Toggl API integration
- `backend/src/services/tempo.service.ts`: Tempo API integration
- `frontend/src/App.tsx`: All frontend UI components and state

**Testing:**
- Not detected

## Naming Conventions

**Files:**
- Services: `*.service.ts` (e.g., `toggl.service.ts`)
- Adapters: `*.adapter.ts` (e.g., `toggl-csv.adapter.ts`)
- Interfaces: `*.interface.ts` (e.g., `import-adapter.interface.ts`)
- React components: PascalCase with `.tsx` extension (e.g., `App.tsx`)
- Configuration: kebab-case or dotfiles (e.g., `vite.config.ts`, `.env`)

**Directories:**
- Lowercase, plural for collections: `adapters/`, `services/`, `migrations/`
- Lowercase singular for single-purpose: `backend/`, `frontend/`, `prisma/`

## Where to Add New Code

**New Feature:**
- Primary code: `backend/src/server.ts` for new API routes
- Tests: Not currently structured - would need test directory setup

**New Component/Module:**
- Backend service: `backend/src/services/[name].service.ts`
- Backend adapter: `backend/src/adapters/[name].adapter.ts`
- Frontend component: Currently monolithic - extract from `frontend/src/App.tsx` or create alongside it

**Utilities:**
- Shared helpers: No dedicated utils directory - create `backend/src/utils/` or `frontend/src/utils/` as needed

**Database Changes:**
- Schema modifications: Edit `backend/prisma/schema.prisma`, run `prisma migrate dev`
- Migrations: Auto-generated in `backend/prisma/migrations/` via Prisma CLI

**External API Integration:**
- New service: Add to `backend/src/services/`
- New CSV format: Add adapter to `backend/src/adapters/`
- Cache files: Root of `backend/` directory as `[service]_cache.json`

## Special Directories

**backend/node_modules/:**
- Purpose: Backend npm dependencies
- Generated: Yes (npm install)
- Committed: No

**frontend/node_modules/:**
- Purpose: Frontend npm dependencies
- Generated: Yes (npm install)
- Committed: No

**backend/prisma/migrations/:**
- Purpose: Version-controlled database schema changes
- Generated: Yes (prisma migrate dev)
- Committed: Yes

**backend/dist/:**
- Purpose: Compiled TypeScript output for production
- Generated: Yes (npm run build)
- Committed: No

**.planning/:**
- Purpose: GSD planning and analysis documents
- Generated: Yes (via /gsd commands)
- Committed: Yes

---

*Structure analysis: 2026-01-19*
