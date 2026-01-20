# Phase 2: Containerization & Deployment - Research

**Researched:** 2026-01-21
**Domain:** Docker containerization, deployment infrastructure, Hetzner
**Confidence:** HIGH

## Summary

This research investigates the containerization and deployment requirements for deploying the time-tracker application (React frontend + Fastify backend + PostgreSQL database) to a single Hetzner server using Docker Compose. The project currently uses SQLite which will need to migrate to PostgreSQL for production.

The standard approach for this architecture is:
1. **Multi-stage Docker builds** for both frontend (Node build -> Nginx serve) and backend (TypeScript compile -> Node runtime)
2. **Docker Compose** with health checks and proper startup ordering
3. **Nginx** as reverse proxy serving static frontend files and proxying `/api` requests to the backend
4. **Docker Secrets** for production credential management with `.env` fallback for development
5. **PostgreSQL** with volume persistence and proper health checks

**Primary recommendation:** Use `node:22-slim` (not Alpine) for the backend due to bcrypt native module compatibility issues with musl libc. Use `nginx:alpine` for serving the frontend since it has no native module concerns.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Docker Engine | 24.x+ | Container runtime | Industry standard, Hetzner pre-install available |
| Docker Compose | 2.17+ | Multi-container orchestration | Native health check support, secrets management |
| PostgreSQL | 16/17 | Production database | SQLite not suitable for containerized production |
| Nginx | 1.25+ (alpine) | Reverse proxy + static files | Lightweight, proven SPA support |
| Node.js | 22-slim | Backend runtime | LTS, Debian-based avoids musl issues |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| pg_isready | PostgreSQL health check | Container startup ordering |
| curl | Backend health check | Verify API availability |
| openssl | Secret generation | Initial secret creation |

### Alternatives Considered
| Standard | Alternative | Tradeoff |
|----------|-------------|----------|
| node:22-slim | node:22-alpine | Alpine is 30% smaller but has bcrypt/musl compatibility issues |
| Nginx | Caddy | Caddy has auto-TLS but Nginx has better SPA documentation |
| Docker Compose | Docker Swarm | Swarm for multi-node, Compose sufficient for single server |

**Installation (on Hetzner server):**
```bash
# Docker pre-installed with Hetzner Cloud App Docker
# Or manual install:
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
```

## Architecture Patterns

### Recommended Project Structure
```
project-root/
├── docker/
│   ├── backend/
│   │   └── Dockerfile           # Multi-stage backend build
│   ├── frontend/
│   │   ├── Dockerfile           # Multi-stage frontend build
│   │   └── nginx.conf           # SPA routing config
│   └── secrets/                 # Production secrets (gitignored)
│       ├── jwt_secret
│       ├── session_secret
│       ├── admin_password_hash
│       └── db_password
├── docker-compose.yml           # Development configuration
├── docker-compose.prod.yml      # Production overrides
├── .dockerignore                # Build context exclusions
├── backend/
│   └── prisma/
│       └── schema.prisma        # Changed to postgresql provider
└── frontend/
```

### Pattern 1: Multi-Stage Backend Dockerfile
**What:** Separate build stage from runtime to reduce image size
**When to use:** Always for TypeScript/compiled applications
**Example:**
```dockerfile
# Source: Docker official best practices
# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

# Stage 2: Production
FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
USER node
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

### Pattern 2: Multi-Stage Frontend Dockerfile with Nginx
**What:** Build React app, serve with Nginx
**When to use:** Production frontend deployment
**Example:**
```dockerfile
# Source: Docker/Nginx official docs
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Pattern 3: Nginx SPA Configuration
**What:** Handle client-side routing with try_files fallback
**When to use:** Any React Router SPA
**Example:**
```nginx
# Source: Nginx official documentation + SPA best practices
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing - fallback to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://backend:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Auth routes (same backend)
    location /auth/ {
        proxy_pass http://backend:3000/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Pattern 4: Docker Compose with Health Checks
**What:** Service dependencies with health-based startup ordering
**When to use:** Multi-container applications with database dependencies
**Example:**
```yaml
# Source: Docker Compose official documentation
services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U timetracker -d timetracker"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets:
      - db_password
    environment:
      POSTGRES_USER: timetracker
      POSTGRES_DB: timetracker
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

  backend:
    build:
      context: ./backend
      dockerfile: ../docker/backend/Dockerfile
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    secrets:
      - jwt_secret
      - session_secret
      - admin_password_hash
      - db_password
    environment:
      DATABASE_URL: postgresql://timetracker:${DB_PASSWORD}@db:5432/timetracker

  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/frontend/Dockerfile
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "80:80"

volumes:
  postgres_data:

secrets:
  jwt_secret:
    file: ./docker/secrets/jwt_secret
  session_secret:
    file: ./docker/secrets/session_secret
  admin_password_hash:
    file: ./docker/secrets/admin_password_hash
  db_password:
    file: ./docker/secrets/db_password
```

### Pattern 5: Docker Secrets Usage in Node.js
**What:** Read secrets from /run/secrets/ with environment fallback
**When to use:** Production credentials management
**Example:**
```typescript
// Source: Already implemented in backend/src/plugins/auth.ts
export function loadSecret(name: string): string {
  try {
    // Docker Secrets path (production)
    return fs.readFileSync(`/run/secrets/${name}`, 'utf8').trim();
  } catch (err) {
    // Environment variable fallback (development)
    const envName = name.toUpperCase();
    const envValue = process.env[envName];
    if (!envValue) {
      throw new Error(`Secret ${name} not found`);
    }
    return envValue;
  }
}
```

### Anti-Patterns to Avoid
- **Environment variables for secrets in production:** Use Docker Secrets with file mounts instead
- **Alpine for backend with bcrypt:** Use slim images to avoid musl libc issues
- **No health checks:** Always define health checks for proper startup ordering
- **Root user in containers:** Run as non-root user for security
- **Building in production compose:** Use pre-built images or separate build step
- **Hardcoded connection strings:** Use environment variables with secrets references

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service startup ordering | Sleep/retry scripts | `depends_on: condition: service_healthy` | Native Docker Compose support since v2.17 |
| Secret management | Environment variables | Docker Secrets + /run/secrets/ | Encrypted at rest, not in logs/inspect |
| SPA routing | Custom redirect logic | Nginx `try_files $uri /index.html` | Standard, well-documented pattern |
| Database health | Custom TCP checks | `pg_isready` command | Built into PostgreSQL image |
| Reverse proxy | Node.js proxy middleware | Nginx reverse proxy | More efficient, handles static files |
| Image layer caching | Manual optimization | Multi-stage builds + .dockerignore | Docker BuildKit handles automatically |
| Container restart | Supervisor/init | Docker restart policies | Native container orchestration |

**Key insight:** Docker Compose 2.17+ has native support for health-based dependencies, secrets management, and proper orchestration. Don't implement custom solutions for these problems.

## Common Pitfalls

### Pitfall 1: bcrypt Native Module with Alpine
**What goes wrong:** Build fails or runtime crashes when using bcrypt on Alpine images
**Why it happens:** Alpine uses musl libc instead of glibc; bcrypt has native bindings that expect glibc
**How to avoid:** Use `node:22-slim` (Debian-based) for any container with bcrypt dependency
**Warning signs:** `Pre-built binaries not found for bcrypt`, segmentation faults at runtime

### Pitfall 2: SQLite in Docker Volumes
**What goes wrong:** Database corruption, locking issues, data loss
**Why it happens:** SQLite not designed for networked/shared filesystem access in containers
**How to avoid:** Migrate to PostgreSQL for production containerized deployment
**Warning signs:** `database is locked` errors, corrupted database files

### Pitfall 3: Prisma Migration Timing
**What goes wrong:** Application starts before database migrations complete
**Why it happens:** Running migrations in Dockerfile RUN step happens at build time, not deploy time
**How to avoid:** Run `prisma migrate deploy` in CMD before starting the application
**Warning signs:** Schema mismatch errors, missing tables

### Pitfall 4: SPA 404 on Refresh
**What goes wrong:** Direct URL access or page refresh returns 404
**Why it happens:** Nginx looks for file at path instead of serving index.html
**How to avoid:** Configure `try_files $uri $uri/ /index.html;` in Nginx
**Warning signs:** Routes work via navigation but 404 on refresh

### Pitfall 5: Container File Permissions
**What goes wrong:** Files copied with COPY are owned by root
**Why it happens:** COPY doesn't respect USER directive by default
**How to avoid:** Use `COPY --chown=node:node` when copying to non-root user
**Warning signs:** Permission denied errors, application can't write logs

### Pitfall 6: depends_on Without Health Check
**What goes wrong:** Backend starts before database is ready to accept connections
**Why it happens:** `depends_on` only waits for container to start, not service readiness
**How to avoid:** Use `depends_on: condition: service_healthy` with healthcheck defined
**Warning signs:** Connection refused on startup, then works after manual restart

### Pitfall 7: Secrets in Build Context
**What goes wrong:** Secrets end up in Docker image layers
**Why it happens:** .env files not in .dockerignore, or secrets in COPY commands
**How to avoid:** Add all secret files to .dockerignore, use Docker Secrets at runtime
**Warning signs:** Secrets visible in `docker history`, leaked to registry

### Pitfall 8: CORS Configuration in Production
**What goes wrong:** API requests blocked by browser CORS policy
**Why it happens:** CORS origin hardcoded to localhost, not updated for production domain
**How to avoid:** Use environment variable for CORS origin, update for production
**Warning signs:** `blocked by CORS policy` in browser console

## Code Examples

Verified patterns from official sources:

### .dockerignore for Node.js
```
# Source: Docker best practices for Node.js
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
Dockerfile*
docker-compose*
.dockerignore
dist/
coverage/
logs/
*.log
.npmrc
.DS_Store
*.md
.planning/
```

### Health Endpoint for Backend
```typescript
// Add to server.ts before protected routes
// Source: Fastify health check patterns
app.get('/health', async (request, reply) => {
  try {
    // Optional: Add database connectivity check
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    reply.code(503).send({ status: 'unhealthy', error: 'Database connection failed' });
  }
});
```

### Prisma Schema for PostgreSQL
```prisma
// Source: Prisma documentation - provider switch
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Model definitions remain the same
model TimeEntry {
  id          String   @id @default(uuid())
  source      String
  externalId  String?
  date        DateTime
  duration    Float
  project     String?
  description String?
  createdAt   DateTime @default(now())

  @@unique([source, externalId])
  @@index([date])
}
```

### Secret Generation Script
```bash
#!/bin/bash
# Source: OpenSSL documentation
# Generate production secrets

mkdir -p docker/secrets

# JWT secret (64 bytes, base64 encoded)
openssl rand -base64 64 | tr -d '\n' > docker/secrets/jwt_secret

# Session secret (32 bytes, hex encoded for libsodium)
openssl rand -hex 32 > docker/secrets/session_secret

# Database password (32 random characters)
openssl rand -base64 32 | tr -d '\n' > docker/secrets/db_password

# Admin password hash (prompt user)
echo "Enter admin password:"
read -s ADMIN_PASSWORD
node -e "require('bcrypt').hash('$ADMIN_PASSWORD', 12).then(h => console.log(h))" > docker/secrets/admin_password_hash

chmod 600 docker/secrets/*
echo "Secrets generated in docker/secrets/"
```

### Development vs Production Compose
```yaml
# docker-compose.yml (development base)
services:
  backend:
    build: ./backend
    environment:
      - NODE_ENV=development
    volumes:
      - ./backend:/app
      - /app/node_modules
    ports:
      - "3000:3000"

---
# docker-compose.prod.yml (production overrides)
services:
  backend:
    build:
      context: ./backend
      dockerfile: ../docker/backend/Dockerfile
    environment:
      - NODE_ENV=production
    volumes: []  # No source mounts
    ports: []    # Not exposed directly
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `depends_on` (start order only) | `depends_on: condition: service_healthy` | Compose 2.17 (2023) | Proper service dependencies |
| Environment variables for secrets | Docker Secrets file mounts | Docker 17.06+ | Secrets not in logs/inspect |
| glibc/Alpine workarounds | Use slim images for native deps | Ongoing | Simpler builds, fewer issues |
| docker-compose (v1 Python) | docker compose (v2 Go) | 2021 | Integrated CLI, better performance |
| Manual restart logic | `restart: unless-stopped` | Docker 1.2+ | Native container lifecycle |

**Deprecated/outdated:**
- `links:` directive - use networks for service discovery instead
- Version specification in compose files - no longer required with Compose v2
- `container_name` for service discovery - use service names directly

## Open Questions

Things that couldn't be fully resolved:

1. **SSL/TLS Certificate Management**
   - What we know: Nginx can terminate TLS, Let's Encrypt is standard
   - What's unclear: Phase 2 scope doesn't mention HTTPS setup
   - Recommendation: Consider this for a separate phase or add to scope

2. **Database Migration Data Transfer**
   - What we know: Schema migration from SQLite to PostgreSQL is straightforward
   - What's unclear: Whether existing data needs to be migrated or fresh start
   - Recommendation: Clarify with user; if data needed, use manual export/import

3. **Backup Strategy**
   - What we know: Volume persistence keeps data across restarts
   - What's unclear: Backup requirements not specified in requirements
   - Recommendation: Add pg_dump cron job or Hetzner backup service

## Sources

### Primary (HIGH confidence)
- [Docker Compose Use Secrets](https://docs.docker.com/compose/how-tos/use-secrets/) - Official secrets documentation
- [Docker Compose Startup Order](https://docs.docker.com/compose/how-tos/startup-order/) - Health check dependencies
- [Prisma Docker Guide](https://www.prisma.io/docs/guides/docker) - Official Prisma Docker setup
- [Choosing Node.js Docker Image (Snyk)](https://snyk.io/blog/choosing-the-best-node-js-docker-image/) - Alpine vs Slim analysis

### Secondary (MEDIUM confidence)
- [Multi-Stage Builds for Node.js (OneUptime)](https://oneuptime.com/blog/post/2026-01-06-nodejs-multi-stage-dockerfile/view) - Current best practices
- [React Vite Docker Deployment (buildwithmatija)](https://www.buildwithmatija.com/blog/production-react-vite-docker-deployment) - Frontend containerization
- [Hetzner Docker Tutorial](https://community.hetzner.com/tutorials/deploy-nodejs-with-docker/) - Hetzner-specific guidance
- [Docker Compose Health Checks (Last9)](https://last9.io/blog/docker-compose-health-checks/) - Health check patterns

### Tertiary (LOW confidence)
- WebSearch results on bcrypt/Alpine compatibility - historical issues confirmed but bcrypt 6 specifics not verified
- Restart policy recommendations - general consensus from multiple sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Well-documented, official sources
- Architecture: HIGH - Established patterns with official documentation
- Pitfalls: HIGH - Verified through project analysis (bcrypt in package.json) and documented issues

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable technologies)

---

## Critical Project-Specific Notes

### bcrypt Dependency Warning
The project uses `bcrypt@6.0.0` (verified in `backend/package.json`). This package has native bindings that are incompatible with Alpine Linux's musl libc. **MUST use `node:22-slim` instead of `node:22-alpine` for the backend Dockerfile.**

### Existing loadSecret() Pattern
The project already has the Docker Secrets pattern implemented in `backend/src/plugins/auth.ts`. The `loadSecret()` function reads from `/run/secrets/` with environment variable fallback. This pattern should be extended for the database password.

### CORS Configuration
Current `server.ts` hardcodes CORS origin to `process.env.FRONTEND_URL || 'http://localhost:5173'`. Production deployment needs to update `FRONTEND_URL` environment variable to the production domain.

### Database Migration Required
Current schema uses SQLite (`provider = "sqlite"` in `backend/prisma/schema.prisma`). Must change to `postgresql` and generate new migrations. SQLite data will need manual export if preservation is required.
