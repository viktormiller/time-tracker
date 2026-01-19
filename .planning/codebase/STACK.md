# Technology Stack

**Analysis Date:** 2026-01-19

## Languages

**Primary:**
- TypeScript 5.x - Backend and frontend codebase
  - Backend: TypeScript ~5.5.4 targeting ES2020
  - Frontend: TypeScript ~5.9.3 targeting ES2022

**Secondary:**
- JavaScript - Configuration files (Vite, ESLint, Tailwind, PostCSS)

## Runtime

**Environment:**
- Node.js (v25.2.1 detected on system)

**Package Manager:**
- npm (lockfileVersion: 3)
- Lockfiles present:
  - `/Users/vmiller/projects/time-tracker/backend/package-lock.json`
  - `/Users/vmiller/projects/time-tracker/frontend/package-lock.json`

## Frameworks

**Core:**
- Fastify 4.28.1 - Backend REST API framework
- React 19.2.0 - Frontend UI library
- Vite 7.2.4 - Frontend build tool and dev server
- Prisma 5.19.1 - ORM and database toolkit

**Testing:**
- Not detected

**Build/Dev:**
- ts-node 10.9.2 - TypeScript execution for development
- nodemon 3.1.4 - Backend auto-reload during development
- Vite 7.2.4 - Frontend bundler with HMR
- TypeScript compiler (tsc) - Production builds

## Key Dependencies

**Critical:**
- @prisma/client 5.19.1 - Database client generated from schema
- axios 1.13.2 - HTTP client for external API calls (Toggl, Tempo)
- dotenv 17.2.3 - Environment variable management
- react-dom 19.2.0 - React rendering

**Infrastructure:**
- @fastify/cors 9.0.1 - CORS support for API
- @fastify/multipart 8.3.0 - File upload handling
- date-fns 3.6.0 (backend), 4.1.0 (frontend) - Date manipulation
- csv-parse 5.5.6 - CSV file parsing for imports

**Frontend UI:**
- tailwindcss 3.4.17 - Utility-first CSS framework
- recharts 3.5.1 - Charting library for visualizations
- lucide-react 0.555.0 - Icon library
- react-day-picker 9.11.3 - Date picker component
- clsx 2.1.1 - Conditional class names
- tailwind-merge 3.4.0 - Tailwind class merging utility

**Development:**
- eslint 9.39.1 (frontend) - Code linting
- typescript-eslint 8.46.4 - TypeScript ESLint integration
- autoprefixer 10.4.22 - CSS vendor prefixing
- postcss 8.5.6 - CSS processing

## Configuration

**Environment:**
- Configured via `.env` file in backend
- Required variables (from `.env.example`):
  - PORT=3000
  - DATABASE_URL="file:./dev.db"
  - TOGGL_API_TOKEN
  - TEMPO_API_TOKEN
- Environment loading: dotenv package in backend

**Build:**
- Backend: `tsconfig.json` - CommonJS modules, ES2020 target, outputs to `dist/`
- Frontend: `tsconfig.app.json` - ESNext modules, bundler resolution, no emit (Vite handles bundling)
- Frontend also has `tsconfig.node.json` for Vite config files
- Vite config: `/Users/vmiller/projects/time-tracker/frontend/vite.config.ts`
- ESLint config: `/Users/vmiller/projects/time-tracker/frontend/eslint.config.js`
- Tailwind config: `/Users/vmiller/projects/time-tracker/frontend/tailwind.config.js`
- PostCSS config: `/Users/vmiller/projects/time-tracker/frontend/postcss.config.js`

## Platform Requirements

**Development:**
- Node.js runtime (no version pinned, currently using v25)
- npm for dependency installation
- SQLite database file (development mode)
- API tokens for Toggl and Tempo services

**Production:**
- Node.js environment for backend server
- Static file hosting for frontend build output
- Environment variables for PORT, DATABASE_URL, API tokens
- SQLite database or alternative Prisma-compatible datasource

---

*Stack analysis: 2026-01-19*
