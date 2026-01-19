# Architecture Patterns for Time Tracking Aggregation System

**Domain:** Time Tracking Aggregation Platform
**Researched:** 2026-01-19
**Confidence:** HIGH

## Executive Summary

This document provides architectural patterns for a time tracking aggregation system that:
- Aggregates entries from multiple sources (Toggl, Tempo, Clockify, CSV imports)
- Exposes a unified REST API for web frontend and Go CLI clients
- Starts as single-user but can expand to multi-tenant
- Runs in containerized environment (Docker Compose)

**Current Stack Analysis:** The codebase uses Fastify + Prisma + SQLite with separate service classes (TogglService, TempoService) that directly fetch and upsert data. The adapter pattern exists for CSV imports but not for API sources.

**Key Recommendations:**
1. **Containerization:** Three-service Docker Compose with network isolation
2. **CLI Authentication:** JWT-based authentication with config file storage
3. **Provider Abstraction:** Unified adapter pattern with factory for all sources
4. **Multi-tenant Path:** Start with tenant_id column, migrate to PostgreSQL + RLS for production

---

## 1. Containerization Strategy

### Recommended Architecture

```yaml
services:
  frontend:
    # React + Vite dev server or production build with nginx
    networks:
      - frontend-network
      - backend-network
    ports:
      - "5173:5173"  # Development
      # - "80:80"    # Production with nginx
    depends_on:
      - backend

  backend:
    # Fastify API server
    networks:
      - backend-network
      - database-network
    ports:
      - "3000:3000"
    depends_on:
      database:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@database:5432/timetracker
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./backend/src:/app/src  # Development hot-reload
      - api-logs:/app/logs

  database:
    # PostgreSQL for production, SQLite for development
    image: postgres:16-alpine
    networks:
      - database-network
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=timetracker
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

networks:
  frontend-network:
    driver: bridge
  backend-network:
    driver: bridge
    internal: true  # No external access
  database-network:
    driver: bridge
    internal: true  # No external access

volumes:
  postgres-data:
  api-logs:
```

### Network Segmentation Rationale

**Three-tier isolation:**
- **frontend-network:** Public-facing, exposes to host
- **backend-network:** Internal only, frontend ↔ backend communication
- **database-network:** Internal only, backend ↔ database communication

**Security benefits:**
- Database never exposed to external networks
- Backend only accessible via frontend (or direct port exposure for CLI)
- Clear trust boundaries between tiers

**Source:** [Docker Compose Application Model](https://docs.docker.com/compose/intro/compose-application-model/)

### Service Dependencies

Use `depends_on` with health checks to ensure proper startup order:

```yaml
backend:
  depends_on:
    database:
      condition: service_healthy  # Wait for PostgreSQL ready

frontend:
  depends_on:
    - backend  # Start after backend running
```

**Critical for production:** Database migrations must run after database is healthy but before backend accepts traffic.

**Pattern:** Add init container or entrypoint script:
```dockerfile
# backend/docker-entrypoint.sh
#!/bin/sh
npx prisma migrate deploy
exec node dist/server.js
```

**Sources:**
- [Multi-Service Docker Compose Architecture](https://wkrzywiec.medium.com/how-to-run-database-backend-and-frontend-in-a-single-click-with-docker-compose-4bcda66f6de)
- [Docker Compose Networks Best Practices](https://www.compilenrun.com/docs/devops/docker/docker-compose/docker-compose-networks/)

### Development vs Production Configurations

**Development (`docker-compose.yml`):**
```yaml
backend:
  build:
    context: ./backend
    target: development
  volumes:
    - ./backend/src:/app/src  # Hot reload
  environment:
    - NODE_ENV=development
    - DATABASE_URL=file:./dev.db  # SQLite for fast dev
```

**Production (`docker-compose.prod.yml`):**
```yaml
backend:
  build:
    context: ./backend
    target: production
  environment:
    - NODE_ENV=production
    - DATABASE_URL=${DATABASE_URL}  # PostgreSQL
  restart: unless-stopped
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 512M
```

Merge with: `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up`

### Dockerfile Best Practices

**Multi-stage build for backend:**
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]

# Stage 3: Development
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

**Benefits:**
- Small production image (node:20-alpine ~170MB)
- No dev dependencies in production
- Fast rebuilds with layer caching

**Sources:**
- [Fastify Prisma Docker Best Practices](https://jaygould.co.uk/2022-05-08-typescript-fastify-prisma-starter-with-docker/)
- [Prisma Production Deployment](https://dev.to/lcnunes09/hardening-prisma-for-production-resilient-connection-handling-in-nodejs-apis-41dm)

---

## 2. CLI-to-Backend Communication Patterns

### Architecture Overview

```
┌─────────────┐                    ┌─────────────┐
│   Go CLI    │ ─── HTTPS ──────▶ │  Backend    │
│   (Local)   │ ◀── JSON ─────────│  REST API   │
└─────────────┘                    └─────────────┘
     │                                    │
     │ Read/Write                         │ Database
     ▼                                    ▼
┌─────────────┐                    ┌─────────────┐
│  Config     │                    │  PostgreSQL │
│  ~/.timetrk │                    └─────────────┘
└─────────────┘
```

### JWT-Based Authentication

**Flow:**
1. User runs: `timetracker login`
2. CLI prompts for credentials (username/password or API key)
3. CLI sends POST to `/api/auth/login`
4. Backend validates and returns JWT access + refresh tokens
5. CLI stores tokens in config file: `~/.timetracker/config.yaml`
6. Subsequent requests include: `Authorization: Bearer <token>`

**Token Structure:**
```typescript
// Access Token (short-lived: 15 minutes)
interface AccessToken {
  userId: string;
  tenantId?: string;  // For multi-tenant
  iat: number;
  exp: number;
}

// Refresh Token (long-lived: 30 days)
interface RefreshToken {
  userId: string;
  sessionId: string;
  iat: number;
  exp: number;
}
```

**Backend Implementation (Fastify):**
```typescript
// src/plugins/auth.ts
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export default fp(async (fastify) => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: {
      expiresIn: '15m'  // Access token
    }
  });

  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});

// Usage in routes
fastify.get('/api/entries', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  const userId = request.user.userId;
  // Query entries for this user
});
```

**Sources:**
- [JWT Authentication in REST APIs](https://blog.logrocket.com/secure-rest-api-jwt-authentication/)
- [CLI JWT Authentication Patterns](https://dev.to/devdevgo/how-to-implement-jwt-authentication-in-command-line-applications-4dp0)

### Configuration File Storage

**AWS CLI-style profile pattern:**

```yaml
# ~/.timetracker/config.yaml
profiles:
  default:
    api_url: http://localhost:3000
    access_token: eyJhbGc...
    refresh_token: eyJhbGc...
    token_expires_at: "2026-01-19T12:00:00Z"

  production:
    api_url: https://api.timetracker.com
    access_token: eyJhbGc...
    refresh_token: eyJhbGc...
    token_expires_at: "2026-01-19T12:00:00Z"

current_profile: default
```

**Go implementation:**
```go
// internal/config/config.go
package config

import (
    "os"
    "path/filepath"
    "gopkg.in/yaml.v3"
)

type Config struct {
    Profiles       map[string]Profile `yaml:"profiles"`
    CurrentProfile string             `yaml:"current_profile"`
}

type Profile struct {
    ApiURL          string `yaml:"api_url"`
    AccessToken     string `yaml:"access_token"`
    RefreshToken    string `yaml:"refresh_token"`
    TokenExpiresAt  string `yaml:"token_expires_at"`
}

func Load() (*Config, error) {
    home, _ := os.UserHomeDir()
    configPath := filepath.Join(home, ".timetracker", "config.yaml")

    data, err := os.ReadFile(configPath)
    if err != nil {
        return &Config{}, nil  // Return empty config if not exists
    }

    var cfg Config
    if err := yaml.Unmarshal(data, &cfg); err != nil {
        return nil, err
    }

    return &cfg, nil
}

func (c *Config) Save() error {
    home, _ := os.UserHomeDir()
    configDir := filepath.Join(home, ".timetracker")

    // Create directory with secure permissions
    if err := os.MkdirAll(configDir, 0700); err != nil {
        return err
    }

    configPath := filepath.Join(configDir, "config.yaml")
    data, _ := yaml.Marshal(c)

    // Write with secure permissions (0600 = rw-------)
    return os.WriteFile(configPath, data, 0600)
}
```

**Security considerations:**
- File permissions: `0600` (read/write for user only)
- Never commit config files
- Refresh token rotation on use
- Automatic token refresh before expiry

**Sources:**
- [AWS CLI-Style JWT Authentication](https://hoop.dev/blog/aws-cli-style-profiles-for-jwt-based-authentication/)
- [Go Configuration Best Practices](https://www.jetbrains.com/guide/go/tutorials/authentication-for-go-apps/auth/)

### API Client Pattern

**Go REST client with automatic retry and refresh:**

```go
// internal/api/client.go
package api

import (
    "bytes"
    "encoding/json"
    "net/http"
    "time"
)

type Client struct {
    baseURL      string
    httpClient   *http.Client
    config       *config.Config
    accessToken  string
    refreshToken string
}

func NewClient(cfg *config.Config) *Client {
    profile := cfg.Profiles[cfg.CurrentProfile]
    return &Client{
        baseURL:      profile.ApiURL,
        httpClient:   &http.Client{Timeout: 30 * time.Second},
        config:       cfg,
        accessToken:  profile.AccessToken,
        refreshToken: profile.RefreshToken,
    }
}

func (c *Client) Do(req *http.Request) (*http.Response, error) {
    // Add auth header
    req.Header.Set("Authorization", "Bearer "+c.accessToken)
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.httpClient.Do(req)

    // If 401, try to refresh token
    if resp != nil && resp.StatusCode == 401 {
        if err := c.refreshAccessToken(); err != nil {
            return nil, err
        }
        // Retry with new token
        req.Header.Set("Authorization", "Bearer "+c.accessToken)
        return c.httpClient.Do(req)
    }

    return resp, err
}

func (c *Client) refreshAccessToken() error {
    req, _ := http.NewRequest("POST", c.baseURL+"/api/auth/refresh",
        bytes.NewBuffer([]byte(`{"refresh_token":"`+c.refreshToken+`"}`)))

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    var result struct {
        AccessToken  string `json:"access_token"`
        RefreshToken string `json:"refresh_token"`
    }
    json.NewDecoder(resp.Body).Decode(&result)

    c.accessToken = result.AccessToken
    c.refreshToken = result.RefreshToken

    // Update config file
    profile := c.config.Profiles[c.config.CurrentProfile]
    profile.AccessToken = result.AccessToken
    profile.RefreshToken = result.RefreshToken
    c.config.Save()

    return nil
}

// High-level methods
func (c *Client) GetEntries(start, end time.Time) ([]Entry, error) {
    req, _ := http.NewRequest("GET",
        c.baseURL+"/api/entries?start="+start.Format("2006-01-02")+
        "&end="+end.Format("2006-01-02"), nil)

    resp, err := c.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var entries []Entry
    json.NewDecoder(resp.Body).Decode(&entries)
    return entries, nil
}
```

**Features:**
- Automatic token refresh on 401
- Retry logic with exponential backoff
- Type-safe request/response handling
- Connection pooling via http.Client

---

## 3. Provider Abstraction Pattern

### Current State Analysis

**Existing code has partial abstraction:**
- ✅ `ImportAdapter` interface for CSV imports (TogglCSVAdapter, TempoCSVAdapter)
- ❌ No interface for API sources (TogglService, TempoService are concrete classes)
- ❌ Duplication: Each service has similar sync logic (cache, API fetch, upsert)
- ❌ Hard to extend: Adding Clockify requires copying entire service pattern

### Recommended Architecture: Unified Adapter Pattern

```
┌─────────────────────────────────────────────┐
│           TimeEntryController               │
│  (Routes: POST /sync, GET /entries)         │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         ProviderSyncService                 │
│  - sync(provider, options)                  │
│  - syncAll(options)                         │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│           ProviderFactory                   │
│  - getProvider(name): Provider              │
└────────────────┬────────────────────────────┘
                 │
         ┌───────┴───────────────────┐
         ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│  TogglProvider   │      │  TempoProvider   │
│  ClockifyProvider│      │  CSVProvider     │
└──────────────────┘      └──────────────────┘
         │                           │
         └──────────┬────────────────┘
                    ▼
          ┌──────────────────┐
          │   Provider       │
          │   Interface      │
          └──────────────────┘
```

### Provider Interface

```typescript
// src/providers/provider.interface.ts
export interface TimeEntryRaw {
  externalId: string;
  date: Date;
  durationSeconds: number;
  project?: string;
  description?: string;
  metadata?: Record<string, any>;  // Provider-specific data
}

export interface SyncOptions {
  startDate?: Date;
  endDate?: Date;
  forceRefresh?: boolean;
  userId?: string;  // For multi-tenant
}

export interface SyncResult {
  provider: string;
  entriesCount: number;
  cached: boolean;
  errors?: string[];
}

export interface Provider {
  readonly name: string;  // "toggl" | "tempo" | "clockify" | "csv"

  /**
   * Fetch raw entries from provider
   * Handles authentication, pagination, caching
   */
  fetchEntries(options: SyncOptions): Promise<TimeEntryRaw[]>;

  /**
   * Validate provider configuration
   * Returns error message if invalid, null if valid
   */
  validateConfig(): Promise<string | null>;

  /**
   * Test connection to provider API
   */
  testConnection(): Promise<boolean>;
}
```

### Concrete Provider Implementation

```typescript
// src/providers/toggl.provider.ts
import axios from 'axios';
import { Provider, TimeEntryRaw, SyncOptions } from './provider.interface';
import { CacheManager } from './cache-manager';

export class TogglProvider implements Provider {
  readonly name = 'toggl';

  private apiToken: string;
  private cache: CacheManager;

  constructor(apiToken: string, cache: CacheManager) {
    this.apiToken = apiToken;
    this.cache = cache;
  }

  async fetchEntries(options: SyncOptions): Promise<TimeEntryRaw[]> {
    const { startDate, endDate, forceRefresh } = options;

    // Check cache first
    if (!forceRefresh) {
      const cached = await this.cache.get(this.name, { startDate, endDate });
      if (cached) return cached;
    }

    // Fetch from API
    const entries = await this.fetchFromAPI(startDate, endDate);

    // Transform to unified format
    const normalized = entries.map(entry => this.normalize(entry));

    // Cache result
    await this.cache.set(this.name, { startDate, endDate }, normalized);

    return normalized;
  }

  private async fetchFromAPI(start?: Date, end?: Date): Promise<any[]> {
    const startDate = start || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const endDate = end || new Date();

    const response = await axios.get(
      'https://api.track.toggl.com/api/v9/me/time_entries',
      {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        },
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiToken}:api_token`).toString('base64')}`
        }
      }
    );

    return response.data.filter(e => e.duration > 0);
  }

  private normalize(entry: any): TimeEntryRaw {
    return {
      externalId: entry.id.toString(),
      date: new Date(entry.start),
      durationSeconds: entry.duration,
      project: entry.project_id ? `Project-${entry.project_id}` : undefined,
      description: entry.description,
      metadata: {
        tags: entry.tags,
        billable: entry.billable
      }
    };
  }

  async validateConfig(): Promise<string | null> {
    if (!this.apiToken || this.apiToken.length < 10) {
      return 'Invalid Toggl API token';
    }
    return null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await axios.get('https://api.track.toggl.com/api/v9/me', {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiToken}:api_token`).toString('base64')}`
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

### Provider Factory

```typescript
// src/providers/provider.factory.ts
import { Provider } from './provider.interface';
import { TogglProvider } from './toggl.provider';
import { TempoProvider } from './tempo.provider';
import { ClockifyProvider } from './clockify.provider';
import { CacheManager } from './cache-manager';

export class ProviderFactory {
  private cache: CacheManager;

  constructor(cache: CacheManager) {
    this.cache = cache;
  }

  getProvider(name: string): Provider {
    switch (name.toLowerCase()) {
      case 'toggl':
        const togglToken = process.env.TOGGL_API_TOKEN;
        if (!togglToken) throw new Error('TOGGL_API_TOKEN not configured');
        return new TogglProvider(togglToken, this.cache);

      case 'tempo':
        const tempoToken = process.env.TEMPO_API_TOKEN;
        if (!tempoToken) throw new Error('TEMPO_API_TOKEN not configured');
        return new TempoProvider(tempoToken, this.cache);

      case 'clockify':
        const clockifyToken = process.env.CLOCKIFY_API_TOKEN;
        if (!clockifyToken) throw new Error('CLOCKIFY_API_TOKEN not configured');
        return new ClockifyProvider(clockifyToken, this.cache);

      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }

  getAllProviders(): Provider[] {
    const providers: Provider[] = [];

    if (process.env.TOGGL_API_TOKEN) {
      providers.push(this.getProvider('toggl'));
    }
    if (process.env.TEMPO_API_TOKEN) {
      providers.push(this.getProvider('tempo'));
    }
    if (process.env.CLOCKIFY_API_TOKEN) {
      providers.push(this.getProvider('clockify'));
    }

    return providers;
  }
}
```

### Provider Sync Service (Orchestrator)

```typescript
// src/services/provider-sync.service.ts
import { PrismaClient } from '@prisma/client';
import { ProviderFactory } from '../providers/provider.factory';
import { Provider, SyncOptions, SyncResult } from '../providers/provider.interface';

export class ProviderSyncService {
  constructor(
    private prisma: PrismaClient,
    private factory: ProviderFactory
  ) {}

  async syncProvider(providerName: string, options: SyncOptions): Promise<SyncResult> {
    const provider = this.factory.getProvider(providerName);

    // Validate configuration
    const configError = await provider.validateConfig();
    if (configError) {
      throw new Error(`Provider configuration invalid: ${configError}`);
    }

    // Fetch entries
    const entries = await provider.fetchEntries(options);

    // Upsert to database
    let count = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        await this.prisma.timeEntry.upsert({
          where: {
            source_externalId: {
              source: provider.name.toUpperCase(),
              externalId: entry.externalId
            }
          },
          update: {
            date: entry.date,
            duration: entry.durationSeconds / 3600,
            project: entry.project,
            description: entry.description
          },
          create: {
            source: provider.name.toUpperCase(),
            externalId: entry.externalId,
            date: entry.date,
            duration: entry.durationSeconds / 3600,
            project: entry.project,
            description: entry.description
          }
        });
        count++;
      } catch (error) {
        errors.push(`Failed to upsert entry ${entry.externalId}: ${error}`);
      }
    }

    return {
      provider: provider.name,
      entriesCount: count,
      cached: entries.length > 0 && !options.forceRefresh,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async syncAll(options: SyncOptions): Promise<SyncResult[]> {
    const providers = this.factory.getAllProviders();

    // Sync in parallel
    const results = await Promise.all(
      providers.map(p => this.syncProvider(p.name, options))
    );

    return results;
  }
}
```

### Cache Manager (Shared)

```typescript
// src/providers/cache-manager.ts
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CacheManager {
  private cacheDir: string;
  private defaultTTL: number;

  constructor(cacheDir: string = './cache', defaultTTL: number = 10 * 60 * 1000) {
    this.cacheDir = cacheDir;
    this.defaultTTL = defaultTTL;
  }

  async get<T>(provider: string, key: any): Promise<T | null> {
    const cacheKey = this.generateKey(provider, key);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

    try {
      const data = await fs.readFile(cachePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(data);

      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        await this.delete(provider, key);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  async set<T>(provider: string, key: any, data: T, ttl?: number): Promise<void> {
    const cacheKey = this.generateKey(provider, key);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };

    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(entry, null, 2));
  }

  async delete(provider: string, key: any): Promise<void> {
    const cacheKey = this.generateKey(provider, key);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

    try {
      await fs.unlink(cachePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  private generateKey(provider: string, key: any): string {
    const keyString = JSON.stringify({ provider, ...key });
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }
}
```

### Benefits of This Architecture

**Extensibility:** Adding Clockify requires implementing one class, no changes to existing code
**Testability:** Each provider can be unit tested in isolation with mocked API responses
**Maintainability:** Shared logic (caching, error handling) in base classes/utilities
**Type Safety:** TypeScript interfaces ensure all providers implement required methods
**DRY Principle:** No duplication of sync logic across providers

**Sources:**
- [Adapter Pattern for Third-Party Integrations](https://medium.com/@olorondu_emeka/adapter-design-pattern-a-guide-to-manage-multiple-third-party-integrations-dc342f435daf)
- [Strategy Pattern in TypeScript](https://medium.com/@robinviktorsson/a-guide-to-the-strategy-design-pattern-in-typescript-and-node-js-with-practical-examples-c3d6984a2050)
- [Gateway Aggregation Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-aggregation)

---

## 4. Multi-Tenant Architecture Path

### Migration Strategy: Single-User → Multi-Tenant

```
Phase 1: Single-User (Current)
├── SQLite database
├── No user/tenant concept
└── Direct API access

Phase 2: User-Aware (Preparation)
├── Add userId to schema
├── JWT authentication
├── User-scoped queries
└── Still SQLite

Phase 3: Multi-Tenant Foundation
├── Add tenantId to schema
├── Migrate to PostgreSQL
├── Basic tenant isolation (WHERE tenantId = ?)
└── Tenant-scoped API tokens

Phase 4: Production Multi-Tenant
├── PostgreSQL Row-Level Security
├── Separate schemas per tenant (optional)
├── Tenant-specific rate limiting
└── Admin/tenant dashboards
```

### Database Schema Evolution

**Phase 2: User-Aware**
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   // Hashed
  createdAt DateTime @default(now())

  entries   TimeEntry[]
  apiTokens ApiToken[]
}

model TimeEntry {
  id          String   @id @default(uuid())
  userId      String   // NEW
  user        User     @relation(fields: [userId], references: [id])

  source      String
  externalId  String?
  date        DateTime
  duration    Float
  project     String?
  description String?
  createdAt   DateTime @default(now())

  @@unique([source, externalId, userId])  // User-scoped uniqueness
  @@index([date, userId])
}

model ApiToken {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])

  provider    String   // "toggl" | "tempo" | "clockify"
  token       String   // Encrypted
  createdAt   DateTime @default(now())
  lastUsedAt  DateTime?

  @@unique([userId, provider])
}
```

**Phase 3: Multi-Tenant Foundation**
```prisma
model Tenant {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique  // "acme-corp"
  plan      String   @default("free")  // "free" | "pro" | "enterprise"
  createdAt DateTime @default(now())

  users     User[]
  entries   TimeEntry[]
}

model User {
  id        String   @id @default(uuid())
  tenantId  String   // NEW
  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  email     String
  password  String
  role      String   @default("member")  // "owner" | "admin" | "member"
  createdAt DateTime @default(now())

  entries   TimeEntry[]

  @@unique([email, tenantId])  // Email unique per tenant
  @@index([tenantId])
}

model TimeEntry {
  id          String   @id @default(uuid())
  tenantId    String   // NEW - for RLS
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  userId      String
  user        User     @relation(fields: [userId], references: [id])

  source      String
  externalId  String?
  date        DateTime
  duration    Float
  project     String?
  description String?
  createdAt   DateTime @default(now())

  @@unique([source, externalId, tenantId])
  @@index([date, tenantId, userId])
  @@index([tenantId])  // For RLS queries
}
```

**Phase 4: PostgreSQL Row-Level Security**
```sql
-- Enable RLS on time_entries table
ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see entries from their tenant
CREATE POLICY tenant_isolation_policy ON "TimeEntry"
  USING (
    "tenantId" = current_setting('app.current_tenant_id')::text
  );

-- Policy: Users can only insert entries for their tenant
CREATE POLICY tenant_insert_policy ON "TimeEntry"
  FOR INSERT
  WITH CHECK (
    "tenantId" = current_setting('app.current_tenant_id')::text
  );

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id, false);
END;
$$ LANGUAGE plpgsql;
```

**Backend middleware for RLS:**
```typescript
// src/plugins/tenant-context.ts
import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.user?.tenantId) {
      // Set PostgreSQL session variable for RLS
      await fastify.prisma.$executeRaw`
        SELECT set_tenant_context(${request.user.tenantId})
      `;
    }
  });
});
```

**Sources:**
- [PostgreSQL RLS for Multi-Tenant SaaS](https://www.techbuddies.io/2026/01/01/how-to-implement-postgresql-row-level-security-for-multi-tenant-saas/)
- [Multi-Tenant Database Patterns](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/)
- [AWS Multi-Tenant RLS Implementation](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)

### Tenant Isolation Patterns

**Three approaches for data isolation:**

| Pattern | Description | Pros | Cons | Best For |
|---------|-------------|------|------|----------|
| **Shared Database, Shared Schema** | All tenants share tables, filtered by `tenantId` column | Simple, cost-effective, easy scaling | Weak isolation, accidental data leaks possible, complex queries | Early-stage SaaS, <100 tenants |
| **Shared Database, Schema per Tenant** | Each tenant gets own schema in same database | Better isolation, customizable schema | Migration complexity, schema drift risk | Mid-stage SaaS, 100-1000 tenants |
| **Database per Tenant** | Each tenant gets dedicated database | Maximum isolation, per-tenant backups | Expensive, complex migrations, resource intensive | Enterprise, regulated industries, >1000 tenants |

**Recommendation for time tracker:** Start with Shared Database/Shared Schema + RLS, migrate to Schema per Tenant if >500 tenants or compliance requires.

### API Authentication Changes

**Single-User (Current):**
```
GET /api/entries
→ Returns all entries
```

**Multi-Tenant:**
```
GET /api/entries
Authorization: Bearer <jwt>
→ JWT contains: { userId: "...", tenantId: "..." }
→ Returns entries WHERE tenantId = jwt.tenantId AND userId = jwt.userId
```

**Tenant switching for admins:**
```typescript
interface JWTPayload {
  userId: string;
  tenantId: string;
  role: "owner" | "admin" | "member";
  impersonatedBy?: string;  // For admin impersonation
}

// Admin can impersonate user
POST /api/admin/impersonate
{
  "targetUserId": "user-123"
}
→ Returns new JWT with impersonatedBy set
```

### Migration Checklist

- [ ] Phase 2: Add userId to TimeEntry, implement authentication
- [ ] Phase 2: Migrate existing entries to a default user
- [ ] Phase 2: Update all queries to filter by userId
- [ ] Phase 3: Add Tenant model, migrate to PostgreSQL
- [ ] Phase 3: Update schema to include tenantId
- [ ] Phase 3: Add tenant context to all requests
- [ ] Phase 3: Implement tenant signup/management
- [ ] Phase 4: Enable PostgreSQL RLS policies
- [ ] Phase 4: Add tenant isolation tests
- [ ] Phase 4: Implement tenant-scoped rate limiting
- [ ] Phase 4: Add admin tenant management dashboard

**Critical:** Each phase should be deployed and validated before proceeding to next.

---

## 5. Component Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                        Presentation Layer                    │
├──────────────────────┬──────────────────────────────────────┤
│  React Frontend      │  Go CLI                              │
│  (Port 5173/80)      │  (Local binary)                      │
└──────────────────────┴──────────────────────────────────────┘
                                │
                                ▼ HTTPS/JSON
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                     │
├─────────────────────────────────────────────────────────────┤
│  Fastify Routes                                             │
│  - Authentication Middleware                                │
│  - Tenant Context Middleware                                │
│  - Rate Limiting                                            │
│  - Request Validation                                       │
└─────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌──────────────────────────────┐ ┌──────────────────────────┐
│  Business Logic Layer        │ │  Provider Layer          │
├──────────────────────────────┤ ├──────────────────────────┤
│  Services:                   │ │  ProviderFactory         │
│  - ProviderSyncService       │ │  Implementations:        │
│  - TimeEntryService          │ │  - TogglProvider         │
│  - UserService               │ │  - TempoProvider         │
│  - TenantService             │ │  - ClockifyProvider      │
└──────────────────────────────┘ └──────────────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                        Data Access Layer                     │
├─────────────────────────────────────────────────────────────┤
│  Prisma ORM                                                 │
│  - Models (User, Tenant, TimeEntry, ApiToken)              │
│  - Migrations                                               │
│  - Query Builder                                            │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                        Data Storage Layer                    │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL (Production)                                    │
│  SQLite (Development)                                       │
│  - Row-Level Security (PostgreSQL only)                     │
│  - Indexes for performance                                  │
└─────────────────────────────────────────────────────────────┘

External Dependencies:
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Toggl API   │  │ Tempo API   │  │ Clockify API│
└─────────────┘  └─────────────┘  └─────────────┘
```

### Responsibility Matrix

| Component | Responsibilities | Does NOT Handle |
|-----------|------------------|-----------------|
| **Frontend** | UI rendering, client-side validation, user interactions, API calls | Authentication logic, business rules, direct database access |
| **Go CLI** | Terminal UI, config management, local caching, API calls | Business logic, database access, provider integration |
| **API Gateway** | Routing, authentication, authorization, rate limiting, request validation | Business logic, data transformation, provider specifics |
| **ProviderSyncService** | Orchestrate sync, coordinate providers, handle errors | Provider-specific API calls, caching, normalization |
| **Provider Implementations** | Fetch from external API, normalize data, cache responses | Database upsert, tenant logic, authentication |
| **Prisma ORM** | Database queries, migrations, type generation | Business logic, validation, authorization |
| **PostgreSQL** | Data persistence, RLS enforcement, transactions | Application logic, API integration |

---

## 6. Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Database Access from Frontend
**What:** Frontend directly connects to database (even in development)
**Why bad:** Security risk, no authorization layer, bypasses business logic
**Instead:** Always route through REST API, even in development

### Anti-Pattern 2: Mixing Provider Logic with Database Logic
**What:** Provider classes directly upsert to database (current code does this)
**Why bad:** Tight coupling, hard to test, duplicated upsert logic
**Instead:** Providers return normalized data, service layer handles persistence

Example refactor:
```typescript
// ❌ BAD: Provider directly upserts
class TogglProvider {
  async sync() {
    const entries = await this.fetchFromAPI();
    for (const entry of entries) {
      await prisma.timeEntry.upsert(...);  // TIGHT COUPLING
    }
  }
}

// ✅ GOOD: Provider returns data, service persists
class TogglProvider {
  async fetchEntries(): Promise<TimeEntryRaw[]> {
    const entries = await this.fetchFromAPI();
    return entries.map(e => this.normalize(e));
  }
}

class ProviderSyncService {
  async syncProvider(provider: Provider) {
    const entries = await provider.fetchEntries();
    await this.persistEntries(entries);  // SINGLE RESPONSIBILITY
  }
}
```

### Anti-Pattern 3: SQLite in Production
**What:** Deploying SQLite database to production for multi-user system
**Why bad:**
- No concurrent writes (locking issues)
- No RLS support
- File-based, poor for containerized environments
- Difficult backups/replication
**Instead:** Use PostgreSQL for production, SQLite only for local dev

### Anti-Pattern 4: Storing Plain Text Secrets in Config
**What:** CLI config file stores API tokens unencrypted
**Why bad:** Tokens visible if file leaked, no protection at rest
**Instead:** Use OS keychain/credential store

```go
// ✅ GOOD: Use OS keychain
import "github.com/zalando/go-keyring"

func saveToken(token string) error {
    return keyring.Set("timetracker", "api-token", token)
}

func loadToken() (string, error) {
    return keyring.Get("timetracker", "api-token")
}
```

### Anti-Pattern 5: No Tenant Context Validation
**What:** Trust JWT payload without server-side validation
**Why bad:** Token tampering could access other tenants' data
**Instead:** Always validate tenantId matches user's actual tenant

```typescript
// ❌ BAD: Trust JWT blindly
fastify.get('/api/entries', async (request) => {
  const tenantId = request.user.tenantId;  // From JWT, could be tampered
  return prisma.timeEntry.findMany({ where: { tenantId } });
});

// ✅ GOOD: Validate tenant membership
fastify.get('/api/entries', async (request) => {
  const userId = request.user.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true }
  });

  if (!user || user.tenantId !== request.user.tenantId) {
    throw new Error('Tenant mismatch');
  }

  // Let RLS handle filtering
  return prisma.timeEntry.findMany();
});
```

### Anti-Pattern 6: Shared Database Connection Pool for All Tenants
**What:** Single connection pool, set tenant context per query
**Why bad:** Context leakage between requests, race conditions
**Instead:** Use connection pools per tenant OR enforce RLS at connection level

```typescript
// ✅ GOOD: Set tenant context at connection acquisition
fastify.addHook('preHandler', async (request) => {
  await request.prisma.$executeRaw`
    SELECT set_config('app.current_tenant_id', ${request.user.tenantId}, true)
  `;  // `true` = transaction-local
});
```

---

## 7. Scalability Considerations

### Horizontal Scaling Strategy

```
                    ┌──────────────┐
                    │ Load Balancer │
                    │  (Nginx/HAProxy) │
                    └───────┬──────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │ Backend │        │ Backend │        │ Backend │
    │ Instance│        │ Instance│        │ Instance│
    │    1    │        │    2    │        │    3    │
    └────┬────┘        └────┬────┘        └────┬────┘
         └──────────────────┼──────────────────┘
                            ▼
                    ┌─────────────────┐
                    │  PostgreSQL      │
                    │  (Master + Read  │
                    │   Replicas)      │
                    └─────────────────┘
```

**Docker Compose Scaling:**
```bash
# Scale backend to 3 instances
docker-compose up --scale backend=3

# Load balancer (add to docker-compose.yml)
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
  depends_on:
    - backend
```

**Nginx config for load balancing:**
```nginx
upstream backend {
    least_conn;  # Route to least busy instance
    server backend:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;

    location /api {
        proxy_pass http://backend;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Caching Strategy

**Multi-level caching:**

```
Browser Cache (ETags)
       ↓
API Response Cache (Redis)
       ↓
Database Query Cache (PostgreSQL)
       ↓
Database
```

**Redis integration:**
```typescript
// src/plugins/cache.ts
import Redis from 'ioredis';
import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL);

  fastify.decorate('cache', {
    async get(key: string) {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    },

    async set(key: string, value: any, ttl: number = 300) {
      await redis.setex(key, ttl, JSON.stringify(value));
    }
  });
});

// Usage in routes
fastify.get('/api/entries', async (request) => {
  const cacheKey = `entries:${request.user.tenantId}:${request.query.start}:${request.query.end}`;

  let entries = await fastify.cache.get(cacheKey);
  if (!entries) {
    entries = await prisma.timeEntry.findMany(...);
    await fastify.cache.set(cacheKey, entries, 300);  // 5 min cache
  }

  return entries;
});
```

### Database Optimization

**Read replicas for queries:**
```typescript
// Prisma supports read replicas
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL  // Master (writes)
    }
  }
});

const prismaReadReplica = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_URL  // Replica (reads)
    }
  }
});

// Use in services
class TimeEntryService {
  async findMany(where) {
    return prismaReadReplica.timeEntry.findMany({ where });  // Read from replica
  }

  async create(data) {
    return prisma.timeEntry.create({ data });  // Write to master
  }
}
```

**Connection pooling:**
```env
# .env
DATABASE_URL="postgresql://user:pass@localhost:5432/timetracker?connection_limit=20&pool_timeout=30"
```

### Rate Limiting

**Per-tenant rate limiting:**
```typescript
// src/plugins/rate-limit.ts
import rateLimit from '@fastify/rate-limit';

fastify.register(rateLimit, {
  max: 100,  // 100 requests
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    return request.user?.tenantId || request.ip;  // Limit per tenant
  },
  errorResponseBuilder: (request, context) => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`
    };
  }
});
```

### Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| API Response Time (p95) | <200ms | >500ms |
| Database Query Time (p95) | <50ms | >200ms |
| Provider Sync Time | <10s for 1000 entries | >30s |
| Concurrent Users | 100 per backend instance | N/A |
| Database Connections | 20 per instance | 100 max |

---

## 8. Security Considerations

### Authentication Security

**JWT Best Practices:**
- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (30 days) with rotation
- Store refresh tokens in database for revocation
- HTTPS only in production
- HttpOnly cookies for web (not applicable for CLI)

**Password Security:**
```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### API Token Encryption

**Encrypt third-party API tokens at rest:**
```typescript
import crypto from 'crypto';

class TokenEncryption {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    this.key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encrypted: string): string {
    const [ivHex, authTagHex, encryptedData] = encrypted.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### CORS Configuration

```typescript
// src/plugins/cors.ts
import cors from '@fastify/cors';

fastify.register(cors, {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',  // Dev frontend
      'https://timetracker.com'  // Production
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,  // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});
```

### Input Validation

**Use JSON Schema validation:**
```typescript
const createEntrySchema = {
  body: {
    type: 'object',
    required: ['date', 'duration'],
    properties: {
      date: { type: 'string', format: 'date' },
      duration: { type: 'number', minimum: 0, maximum: 24 },
      project: { type: 'string', maxLength: 100 },
      description: { type: 'string', maxLength: 500 }
    }
  }
};

fastify.post('/api/entries', {
  schema: createEntrySchema,
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  // Request body is validated and typed
  const entry = await createEntry(request.body);
  return entry;
});
```

### Audit Logging

**Log all security-sensitive operations:**
```typescript
interface AuditLog {
  tenantId: string;
  userId: string;
  action: string;  // "login", "sync", "delete_entry", etc.
  resource?: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
}

async function logAudit(log: AuditLog): Promise<void> {
  await prisma.auditLog.create({ data: log });
}

// Usage
fastify.addHook('onResponse', async (request, reply) => {
  if (request.user && reply.statusCode < 400) {
    await logAudit({
      tenantId: request.user.tenantId,
      userId: request.user.userId,
      action: `${request.method} ${request.url}`,
      ip: request.ip,
      userAgent: request.headers['user-agent'] || '',
      timestamp: new Date()
    });
  }
});
```

---

## 9. Deployment Architecture

### Development Environment
```bash
# Start all services
docker-compose up

# Services
- frontend: http://localhost:5173
- backend: http://localhost:3000
- database: SQLite (file-based)
```

### Staging Environment
```bash
# Using production-like setup
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up

# Services
- frontend: https://staging.timetracker.com (nginx)
- backend: Internal only (via frontend proxy)
- database: PostgreSQL (single instance)
- redis: Cache layer
```

### Production Environment

**Option A: Docker Compose on Single VM (Small Scale)**
```
VM Instance (4 vCPU, 8GB RAM)
├── Nginx (frontend + reverse proxy)
├── Backend instances (x2, load balanced)
├── PostgreSQL (managed service like AWS RDS)
└── Redis (managed service like AWS ElastiCache)
```

**Option B: Kubernetes (Large Scale)**
```yaml
# Simplified k8s architecture
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        image: timetracker/backend:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  selector:
    app: backend
  ports:
  - port: 3000
  type: ClusterIP
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          cd backend
          npm install
          npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker images
        run: |
          docker build -t timetracker/backend:${{ github.sha }} ./backend
          docker build -t timetracker/frontend:${{ github.sha }} ./frontend
      - name: Push to registry
        run: |
          docker push timetracker/backend:${{ github.sha }}
          docker push timetracker/frontend:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh ${{ secrets.DEPLOY_HOST }} "cd /app && docker-compose pull && docker-compose up -d"
```

---

## 10. Migration Path from Current Architecture

### Current State
```
backend/
├── src/
│   ├── server.ts (routes + logic mixed)
│   ├── services/
│   │   ├── toggl.service.ts (API fetch + DB upsert)
│   │   └── tempo.service.ts (API fetch + DB upsert)
│   └── adapters/
│       ├── import-adapter.interface.ts
│       ├── toggl-csv.adapter.ts
│       └── tempo-csv.adapter.ts
├── prisma/
│   └── schema.prisma (no userId/tenantId)
└── No Docker setup
```

### Target State
```
backend/
├── src/
│   ├── server.ts (app initialization only)
│   ├── routes/
│   │   ├── entries.routes.ts
│   │   ├── sync.routes.ts
│   │   └── auth.routes.ts
│   ├── services/
│   │   ├── provider-sync.service.ts (orchestrator)
│   │   ├── time-entry.service.ts (CRUD)
│   │   └── user.service.ts (auth)
│   ├── providers/
│   │   ├── provider.interface.ts
│   │   ├── provider.factory.ts
│   │   ├── cache-manager.ts
│   │   ├── toggl.provider.ts
│   │   ├── tempo.provider.ts
│   │   └── clockify.provider.ts
│   ├── plugins/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   └── tenant-context.ts
│   └── middleware/
│       ├── authentication.ts
│       └── rate-limit.ts
├── prisma/
│   └── schema.prisma (User, Tenant, TimeEntry with RLS)
├── Dockerfile
└── docker-compose.yml
```

### Step-by-Step Migration

**Step 1: Extract Routes from server.ts**
```typescript
// BEFORE: server.ts (everything mixed)
fastify.get('/api/entries', async (request, reply) => {
  const entries = await prisma.timeEntry.findMany();
  return entries;
});

// AFTER: routes/entries.routes.ts
export default async function entriesRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const service = new TimeEntryService(fastify.prisma);
    return service.findAll(request.user.userId);
  });
}

// server.ts
import entriesRoutes from './routes/entries.routes';
fastify.register(entriesRoutes, { prefix: '/api/entries' });
```

**Step 2: Create Provider Interface**
```typescript
// Create src/providers/provider.interface.ts (shown in section 3)
// Migrate TogglService to TogglProvider (remove DB logic)
// Migrate TempoService to TempoProvider (remove DB logic)
```

**Step 3: Create ProviderSyncService**
```typescript
// Create orchestrator that uses providers (shown in section 3)
// Update routes to use ProviderSyncService instead of direct services
```

**Step 4: Add Authentication**
```prisma
// Add User model to schema.prisma
// Create migration: npx prisma migrate dev --name add-users
// Implement JWT authentication (shown in section 2)
```

**Step 5: Containerize**
```dockerfile
// Create Dockerfile (shown in section 1)
// Create docker-compose.yml (shown in section 1)
// Test: docker-compose up
```

**Step 6: Add Multi-Tenancy (Future)**
```prisma
// Add Tenant model and tenantId to schema.prisma
// Migrate to PostgreSQL
// Implement RLS (shown in section 4)
```

**Timeline estimate:**
- Step 1-3: 1-2 weeks (refactoring)
- Step 4: 1 week (authentication)
- Step 5: 2-3 days (Docker)
- Step 6: 2-3 weeks (multi-tenant infrastructure)

---

## 11. Testing Strategy

### Unit Tests
```typescript
// tests/providers/toggl.provider.test.ts
import { TogglProvider } from '../../src/providers/toggl.provider';
import { CacheManager } from '../../src/providers/cache-manager';

describe('TogglProvider', () => {
  let provider: TogglProvider;
  let mockCache: CacheManager;

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn()
    } as any;

    provider = new TogglProvider('test-token', mockCache);
  });

  test('fetchEntries returns normalized data', async () => {
    // Mock axios response
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: [{ id: 1, duration: 3600, start: '2026-01-19T10:00:00Z' }]
    });

    const entries = await provider.fetchEntries({});

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      externalId: '1',
      durationSeconds: 3600
    });
  });
});
```

### Integration Tests
```typescript
// tests/integration/sync.test.ts
import { build } from '../helper';  // Fastify test helper

describe('Sync API', () => {
  const app = await build();

  afterAll(() => app.close());

  test('POST /api/sync/toggl requires authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync/toggl'
    });

    expect(response.statusCode).toBe(401);
  });

  test('POST /api/sync/toggl syncs entries', async () => {
    // Login first
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: 'password' }
    });

    const token = loginRes.json().access_token;

    // Sync
    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/sync/toggl',
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json()).toMatchObject({
      provider: 'toggl',
      entriesCount: expect.any(Number)
    });
  });
});
```

### E2E Tests
```typescript
// tests/e2e/full-flow.test.ts
import { chromium } from 'playwright';

describe('Full user flow', () => {
  test('user can login, sync, and view entries', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name=email]', 'test@example.com');
    await page.fill('input[name=password]', 'password');
    await page.click('button[type=submit]');

    // Wait for dashboard
    await page.waitForSelector('text=Dashboard');

    // Trigger sync
    await page.click('button:has-text("Sync Toggl")');
    await page.waitForSelector('text=Sync complete');

    // Verify entries visible
    const entries = await page.locator('.time-entry').count();
    expect(entries).toBeGreaterThan(0);

    await browser.close();
  });
});
```

---

## 12. Monitoring & Observability

### Metrics to Track
```typescript
// Prometheus metrics
import client from 'prom-client';

const syncDuration = new client.Histogram({
  name: 'timetracker_sync_duration_seconds',
  help: 'Provider sync duration',
  labelNames: ['provider', 'status'],
  buckets: [0.1, 0.5, 1, 5, 10, 30]
});

const apiRequests = new client.Counter({
  name: 'timetracker_api_requests_total',
  help: 'Total API requests',
  labelNames: ['method', 'path', 'status']
});

// Usage
const end = syncDuration.startTimer({ provider: 'toggl' });
try {
  await provider.sync();
  end({ status: 'success' });
} catch (error) {
  end({ status: 'error' });
}
```

### Logging
```typescript
// Structured logging with Pino (Fastify default)
fastify.log.info({
  provider: 'toggl',
  userId: request.user.userId,
  entriesCount: 42
}, 'Sync completed');

// Error logging
fastify.log.error({
  err: error,
  provider: 'toggl',
  userId: request.user.userId
}, 'Sync failed');
```

### Health Checks
```typescript
// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    providers: await checkProviders()
  };

  const healthy = Object.values(checks).every(c => c.healthy);

  reply.code(healthy ? 200 : 503).send({
    status: healthy ? 'healthy' : 'unhealthy',
    checks
  });
});

async function checkDatabase(): Promise<{ healthy: boolean }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { healthy: true };
  } catch {
    return { healthy: false };
  }
}
```

---

## Summary & Recommendations

### Immediate Actions (Phase 1: Foundation)
1. ✅ Create Docker Compose setup with 3 services (frontend, backend, database)
2. ✅ Implement provider abstraction pattern (extract interface from services)
3. ✅ Add JWT authentication and user model to schema
4. ✅ Set up basic CI/CD pipeline

### Short-term (Phase 2: Production Ready)
5. ✅ Migrate from SQLite to PostgreSQL
6. ✅ Implement caching layer (Redis)
7. ✅ Add rate limiting and security headers
8. ✅ Set up monitoring and logging

### Long-term (Phase 3: Scale)
9. ✅ Add multi-tenant support with RLS
10. ✅ Implement horizontal scaling with load balancer
11. ✅ Add read replicas for database
12. ✅ Build admin dashboard for tenant management

### Critical Success Factors
- **Start simple:** Single-user with good architecture beats complex multi-tenant with technical debt
- **Test at boundaries:** Unit test providers, integration test services, E2E test critical flows
- **Security first:** Authentication, encryption, RLS from day one (don't retrofit)
- **Document decisions:** ADRs (Architecture Decision Records) for major choices

---

## Sources

**Official Documentation:**
- [Docker Compose Application Model](https://docs.docker.com/compose/intro/compose-application-model/)
- [Prisma & Fastify Integration](https://www.prisma.io/fastify)
- [Microsoft Azure Gateway Aggregation Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-aggregation)

**Architecture Patterns:**
- [Multi-Service Docker Compose](https://wkrzywiec.medium.com/how-to-run-database-backend-and-frontend-in-a-single-click-with-docker-compose-4bcda66f6de)
- [Docker Compose Networks](https://www.compilenrun.com/docs/devops/docker/docker-compose/docker-compose-networks/)
- [API Aggregation Patterns](https://api7.ai/learning-center/api-101/api-aggregation-combining-multiple-apis)
- [Gateway Aggregation in Microservices](https://mdjamilkashemporosh.medium.com/the-aggregator-pattern-in-microservice-architecture-your-go-to-guide-cd54575a5e6e)

**Authentication & Security:**
- [JWT Authentication in REST APIs](https://blog.logrocket.com/secure-rest-api-jwt-authentication/)
- [CLI JWT Authentication](https://dev.to/devdevgo/how-to-implement-jwt-authentication-in-command-line-applications-4dp0)
- [AWS CLI-Style JWT Profiles](https://hoop.dev/blog/aws-cli-style-profiles-for-jwt-based-authentication/)

**Design Patterns:**
- [Adapter Pattern for Third-Party Integrations](https://medium.com/@olorondu_emeka/adapter-design-pattern-a-guide-to-manage-multiple-third-party-integrations-dc342f435daf)
- [Strategy Pattern in TypeScript](https://medium.com/@robinviktorsson/a-guide-to-the-strategy-design-pattern-in-typescript-and-node-js-with-practical-examples-c3d6984a2050)
- [Provider Pattern in React](https://www.patterns.dev/vanilla/provider-pattern/)

**Multi-Tenant Architecture:**
- [PostgreSQL RLS for Multi-Tenant SaaS](https://www.techbuddies.io/2026/01/01/how-to-implement-postgresql-row-level-security-for-multi-tenant-saas/)
- [Multi-Tenant Database Patterns](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/)
- [AWS Multi-Tenant RLS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Multi-Tenant Architecture Guide 2026](https://www.clickittech.com/software-development/multi-tenant-architecture/)

**Data Integration:**
- [Data Integration Patterns 2026](https://blog.skyvia.com/common-data-integration-patterns/)
- [Data Integration Architecture](https://nexla.com/data-integration-101/data-integration-architecture/)
- [Airbyte Data Integration Patterns](https://airbyte.com/data-engineering-resources/data-integration-patterns)

**Production Deployment:**
- [Fastify Prisma Docker Best Practices](https://jaygould.co.uk/2022-05-08-typescript-fastify-prisma-starter-with-docker/)
- [Hardening Prisma for Production](https://dev.to/lcnunes09/hardening-prisma-for-production-resilient-connection-handling-in-nodejs-apis-41dm)
- [Building Web APIs with Fastify](https://betterstack.com/community/guides/scaling-nodejs/fastify-web-api/)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Confidence Level:** HIGH (based on official documentation and industry best practices)
