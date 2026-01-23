# Time Tracker

A full-stack time tracking application designed to aggregate time entries from different sources like Toggl and Tempo.

## Architecture

- **Frontend**: React + Vite + TypeScript with Tailwind CSS and Recharts
- **Backend**: Node.js + Fastify + TypeScript RESTful API
- **Database**: PostgreSQL (production) / SQLite (development) managed with Prisma ORM

## Key Features

- **Unified Dashboard**: Displays aggregated time entries from all sources in a single view
- **Data Visualization**: Interactive charts showing daily work hours
- **CSV Import**: Supports importing time entries from Toggl and Tempo CSV files
- **API Synchronization**: Direct sync with Toggl and Tempo APIs
- **CRUD Operations**: Create, read, update, and delete time entries
- **Filtering and Sorting**: Filter by source, project, date range, and sort data

## Development Setup

### Prerequisites

- Node.js 23.x
- npm 11.x

### Backend (Port 3000)

```bash
cd backend

# Install dependencies
npm install

# Initialize database (SQLite for development)
npx prisma migrate dev

# Start development server
npm run dev

# View database with Prisma Studio
npx prisma studio
```

The backend API will be available at `http://localhost:3000`.

### Frontend (Port 5173)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`. API requests to `/api` are automatically proxied to the backend on port 3000.

### Development Conventions

- **Code Style**: Prettier for code formatting
- **Linting**: ESLint (`npm run lint` in frontend directory)
- **Type Safety**: TypeScript with strict mode enabled
- **Database Migrations**: Managed using Prisma Migrate

## Production Deployment

### Prerequisites

- Docker
- Docker Compose

### Environment Configuration

**Production** uses Docker Secrets exclusively (no `.env.prod` needed).

**Development** uses a single `backend/.env` file.

Configure your environment by creating the appropriate secret files (production) or environment variables (development).

### Docker Secrets Setup

Production deployment uses Docker secrets for ALL sensitive data (no environment variables needed). Create the following files in `docker/secrets/`:

```bash
# Create secrets directory if it doesn't exist
mkdir -p docker/secrets

# Generate JWT secret (32 bytes = 64 hex chars)
openssl rand -hex 32 > docker/secrets/jwt_secret

# Generate session secret (32 bytes = 64 hex chars)
openssl rand -hex 32 > docker/secrets/session_secret

# Set database password (use a strong password)
echo "your_secure_db_password" > docker/secrets/db_password

# Generate admin password hash (requires bcrypt, cost 10)
npx bcrypt-cli hash "your_admin_password" > docker/secrets/admin_password_hash

# Add Toggl API token (get from https://track.toggl.com/profile)
echo "your_toggl_api_token" > docker/secrets/toggl_api_token

# Add Tempo API token (get from Jira Tempo settings)
echo "your_tempo_api_token" > docker/secrets/tempo_api_token
```

**Required secret files:**

| File | Purpose | How to Generate |
|------|---------|-----------------|
| `jwt_secret` | JWT token signing | `openssl rand -hex 32` |
| `session_secret` | Session encryption | `openssl rand -hex 32` |
| `db_password` | PostgreSQL password | Choose a strong password |
| `admin_password_hash` | Admin login (bcrypt) | `npx bcrypt-cli hash "password"` |
| `toggl_api_token` | Toggl API access | From Toggl settings |
| `tempo_api_token` | Tempo API access | From Tempo settings |

**Important:**
- Never commit these files to git (`.gitignore` prevents this)
- The secrets must be 32 bytes (64 hex chars) for JWT and session
- API tokens are optional - only needed if using those integrations

### Build and Deploy

```bash
# Build all production Docker images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start all services in production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check service status
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Stop all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

### Production Services

| Service | Image Size | Ports | Description |
|---------|-----------|-------|-------------|
| **Frontend** | 62.3MB | 8088 | Nginx serving built React app |
| **Backend** | 1.43GB | 3000 (internal) | Fastify API server |
| **Database** | ~100MB | 5432 | PostgreSQL 17 |

### Access Points

- **Frontend**: http://localhost:8088 (use nginx reverse proxy for ports 80/443)
- **Backend API**: http://localhost:8088/api (proxied through frontend)
- **Database**: localhost:5432 (external access)

### Database Migrations

Database migrations run automatically on container startup via the backend's CMD:

```bash
npx prisma migrate deploy && node dist/server.js
```

To run migrations manually:

```bash
docker exec time-tracker-backend-1 npx prisma migrate deploy
```

### Health Checks

The backend includes automatic health checks:
- **Endpoint**: `/health`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

Check container health status:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

### Image Optimization

The production backend image is optimized:
- Production-only dependencies (excludes devDependencies like TypeScript, vitest, nodemon)
- System Chromium instead of bundled version (required for PDF generation via Puppeteer)
- Multi-stage build to minimize final image size

### Troubleshooting

**View backend logs**:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend
```

**View all logs**:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
```

**Restart a specific service**:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend
```

**Rebuild after code changes**:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Access database directly**:
```bash
# Connect to PostgreSQL
docker exec -it time-tracker-db-1 psql -U timetracker -d timetracker
```

**Reset everything (WARNING: Deletes all data)**:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
```

## Database (Prisma ORM)

The application uses **Prisma ORM** to manage the database schema and queries. Prisma is used in both development and production.

**Schema location:** `backend/prisma/schema.prisma`

**Key models:**
- `TimeEntry`: Time tracking entries with source, project, duration, and metadata
- `User`: User authentication and profiles

### Development vs Production

| Environment | Database | Migration Command |
|-------------|----------|-------------------|
| Development | SQLite | `npx prisma migrate dev` |
| Production | PostgreSQL | `npx prisma migrate deploy` (runs automatically on container start) |

**Development workflow** (local only):
```bash
cd backend
# Create a new migration after schema changes
npx prisma migrate dev --name your_migration_name

# View database with GUI
npx prisma studio
```

**Production:** Migrations run automatically when the backend container starts. To run manually:
```bash
docker exec time-tracker-backend-1 npx prisma migrate deploy
```

## API Documentation

The backend API is available at `/api` with the following main endpoints:

- `GET /api/entries` - List all time entries
- `POST /api/entries` - Create a new time entry
- `GET /api/entries/:id` - Get a specific entry
- `PUT /api/entries/:id` - Update an entry
- `DELETE /api/entries/:id` - Delete an entry
- `GET /api/entries/summary/today` - Get today's summary
- `GET /api/stats` - Get statistics
- `POST /api/import/csv` - Import from CSV

For detailed API documentation, see `backend/src/server.ts`.

## License

This project is open source and available under the [MIT License](LICENSE).
