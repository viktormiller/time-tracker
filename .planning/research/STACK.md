# Technology Stack Research

**Project:** Time Tracking Dashboard
**Researched:** 2026-01-19
**Confidence:** HIGH

---

## Executive Summary

This research covers authentication libraries for single-user → multi-user Fastify apps, Docker patterns for full-stack deployments, and Go CLI tools for REST API integration. Key findings:

- **Authentication:** Use `@fastify/jwt` (built on fast-jwt) with simple file-based user storage initially, designed to expand to PostgreSQL multi-user later
- **Docker:** Multi-stage builds reduce image sizes from 1GB+ to ~150MB; use health checks for startup orchestration
- **Go CLI:** Cobra + Viper for CLI structure, Resty for HTTP client (most axios-like for Go)

---

## Current Stack Analysis

Based on `package.json` review, the project currently uses:

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Backend Framework | Fastify | ^4.28.1 | **Not Express** - Important for auth library choices |
| Database ORM | Prisma | ^5.19.1 | Already configured |
| Frontend | React 19 + Vite | ^19.2.0 | Modern React with TypeScript |
| Database | SQLite → PostgreSQL | - | Migration planned |
| Deployment | Docker Compose | - | Target: Hetzner server |

**Key Insight:** The backend uses **Fastify**, not Express. This changes authentication library recommendations significantly.

---

## 1. Authentication Libraries (Fastify/Node.js)

### Recommended: @fastify/jwt

**Installation:**
```bash
npm install @fastify/jwt
```

**Version:** v9 (for Fastify v5), v8 for Fastify v4
**Confidence:** HIGH (Official Fastify plugin)

**Why This Choice:**

1. **Official Fastify Plugin** - First-party support, maintained by Fastify core team
2. **Performance** - Uses `fast-jwt` internally (not `jsonwebtoken`), significantly faster
3. **Simple API** - Decorates Fastify instance with `sign`, `verify`, `decode` methods
4. **Built-in Helpers** - Provides `request.jwtVerify()` and `reply.jwtSign()` for routes
5. **Single-User → Multi-User Path** - Works for both scenarios with same implementation

**Basic Usage:**
```javascript
// Register plugin
fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET
})

// Sign tokens
fastify.post('/login', async (req, reply) => {
  const token = fastify.jwt.sign({ userId: 1 })
  reply.send({ token })
})

// Verify tokens (route-level)
fastify.get('/protected', async (req, reply) => {
  await req.jwtVerify()  // Throws if invalid
  return { user: req.user }
})
```

**Single-User → Multi-User Migration Path:**

**Phase 1: Single User (Simple)**
```javascript
// Hardcoded single user validation
fastify.post('/login', async (req, reply) => {
  const { username, password } = req.body

  if (username === process.env.ADMIN_USER &&
      password === process.env.ADMIN_PASS) {
    const token = fastify.jwt.sign({ userId: 1, role: 'admin' })
    return { token }
  }

  throw new Error('Invalid credentials')
})
```

**Phase 2: Multi-User (Database-Backed)**
```javascript
// Database user validation
fastify.post('/login', async (req, reply) => {
  const { username, password } = req.body

  const user = await prisma.user.findUnique({
    where: { username }
  })

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new Error('Invalid credentials')
  }

  const token = fastify.jwt.sign({
    userId: user.id,
    role: user.role
  })

  return { token }
})
```

**Key Advantage:** The JWT signing/verification logic remains identical. Only the credential validation changes.

---

### JWT Library Comparison: jose vs jsonwebtoken

**Note:** @fastify/jwt uses `fast-jwt` internally, but if building custom JWT logic:

| Aspect | jose | jsonwebtoken |
|--------|------|--------------|
| **Modern Standard** | ✅ JOSE standards (2026 recommended) | ❌ Legacy implementation |
| **ESM Support** | ✅ Full ESM, TypeScript native | ❌ CommonJS, ESM issues |
| **Web Crypto API** | ✅ Native Web Crypto | ❌ Older crypto libs |
| **Algorithms** | ✅ EdDSA, RSA-PSS, modern algos | ⚠️ Limited to older algorithms |
| **Encryption** | ✅ JWE support (encrypted tokens) | ❌ Signing only |
| **Bundle Size** | Smaller, tree-shakeable | Larger footprint |
| **Recommendation** | **Use for new projects** | Maintain legacy only |

**Verdict:** For custom JWT implementations, use `jose`. But with Fastify, use `@fastify/jwt` which handles this internally.

---

### Authentication Best Practices (2026)

Based on current security recommendations:

**Token Storage:**
- ✅ Store refresh tokens in HttpOnly Secure cookies
- ❌ Never store tokens in localStorage (XSS vulnerability)
- ✅ Access tokens: short-lived (15 mins), refresh tokens: long-lived (7 days)

**Security Measures:**
- ✅ Use `helmet` for secure HTTP headers
- ✅ Implement token expiration and refresh token rotation
- ✅ Never put sensitive data in JWT payload (it's readable)
- ✅ Store JWT secrets in environment variables, never in code

**Middleware Pattern:**
```javascript
// Global authentication (for all routes)
fastify.addHook('onRequest', async (request, reply) => {
  await request.jwtVerify()
})

// Or route-level authentication
fastify.get('/protected', {
  onRequest: [fastify.authenticate]
}, async (req, reply) => {
  return { user: req.user }
})
```

**Sources:**
- [DigitalOcean: JWT in Express.js](https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs)
- [Corbado: Node.js JWT Authentication](https://www.corbado.com/blog/nodejs-express-postgresql-jwt-authentication-roles)
- [DEV: Securing Express.js with JWT](https://dev.to/hamzakhan/securing-your-expressjs-app-jwt-authentication-step-by-step-aom)
- [GitHub: @fastify/jwt](https://github.com/fastify/fastify-jwt)
- [Medium: jose vs jsonwebtoken](https://joodi.medium.com/jose-vs-jsonwebtoken-why-you-should-switch-4f50dfa3554c)
- [DEV: Why Delete jsonwebtoken in 2025](https://dev.to/silentwatcher_95/why-you-should-delete-jsonwebtoken-in-2025-1o7n)

---

## 2. Docker Patterns (Node.js + React + PostgreSQL)

### Recommended Architecture

**Multi-Stage Builds for Production**

Modern Docker best practice uses 3-stage builds to reduce final image size from 1GB+ to ~150MB.

**Backend Dockerfile (Fastify + TypeScript):**
```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy only production dependencies and built artifacts
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma

USER nodejs

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**Frontend Dockerfile (React + Vite):**
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production (nginx)
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### Docker Compose Configuration

**Recommended docker-compose.yml:**

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
```

---

### Key Docker Best Practices (2026)

**Health Checks:**
- PostgreSQL: Use `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`
- Node.js API: Use curl/wget to check `/health` endpoint
- Parameters: `interval: 30s`, `timeout: 10s`, `retries: 3-5`
- **Why:** Prevents race conditions (API connecting to booting database)
- **Result:** Full stack reaches healthy state in 15-30 seconds

**Dependency Management:**
```yaml
depends_on:
  db:
    condition: service_healthy  # Not just 'depends_on: [db]'
```

**Security Best Practices:**
- ✅ Run containers as non-root user (`USER nodejs`)
- ✅ Use alpine images for smaller attack surface
- ✅ Never embed secrets in images (use env vars or Docker secrets)
- ✅ Proper file ownership (`--chown=nodejs:nodejs`)

**Secrets Management (Production):**

**❌ Don't Do This:**
```yaml
environment:
  - DB_PASSWORD=hardcoded_password  # Bad!
```

**✅ Do This (Development):**
```yaml
env_file:
  - .env  # For local development only
```

**✅ Do This (Production):**
```yaml
secrets:
  - db_password
  - jwt_secret

secrets:
  db_password:
    external: true
  jwt_secret:
    external: true
```

**2026 Security Update:** Environment variables are readable via `/proc/PID/environ`, accessible to child processes, and inspectable by debuggers. For production:

1. **Use Docker Secrets** (Docker Swarm/Compose)
2. **Use External Secret Managers** (HashiCorp Vault, AWS Secrets Manager)
3. **Use File-Based Mounts** (`/run/secrets/<secret_name>`)

Secrets mounted via Docker are stored in tmpfs (never on disk) and never exposed as env vars.

**BuildKit for Build Secrets:**
```dockerfile
# Mount secrets during build (never stored in layers)
RUN --mount=type=secret,id=npm_token \
  NPM_TOKEN=$(cat /run/secrets/npm_token) npm install
```

**Sources:**
- [DEV: Docker Compose Full-Stack](https://dev.to/snigdho611/docker-compose-for-a-full-stack-application-with-react-nodejs-and-postgresql-3kdl)
- [Medium: Dockerize React + Node + Postgres](https://medium.com/@antonio.maccarini/dockerize-a-react-application-with-node-js-postgres-and-nginx-124c204029d4)
- [OneUptime: Multi-Stage Docker Builds](https://oneuptime.com/blog/post/2026-01-06-nodejs-multi-stage-dockerfile/view)
- [Last9: Docker Compose Health Checks](https://last9.io/blog/docker-compose-health-checks/)
- [Docker Docs: Secrets](https://docs.docker.com/engine/swarm/secrets/)
- [GitGuardian: Docker Secrets Best Practices](https://blog.gitguardian.com/how-to-handle-secrets-in-docker/)
- [Security Boulevard: Environment Variables Production Secrets](https://securityboulevard.com/2026/01/why-environment-variables-alone-arent-enough-for-production-secrets/)

---

## 3. Go CLI Tools (REST API Integration)

### Recommended Stack: Cobra + Viper + Resty

**Installation:**
```bash
# Cobra CLI framework
go get -u github.com/spf13/cobra@latest
go install github.com/spf13/cobra-cli@latest

# Viper configuration
go get -u github.com/spf13/viper@latest

# Resty HTTP client
go get -u github.com/go-resty/resty/v2
```

**Versions:**
- Cobra: v1.10.2 (December 2025)
- Resty: v2.17.1 (December 2025) / v3 latest
- Confidence: HIGH (Official releases, 199k+ Cobra dependents, 23k+ Resty adopters)

---

### Cobra: CLI Framework

**What It Does:**
- Creates hierarchical subcommands (e.g., `timetrack start`, `timetrack stop`)
- POSIX-compliant flags (short `-s`, long `--flag`)
- Auto-generated help text, man pages, shell completions
- Smart suggestions ("did you mean...?")

**Pattern:** `APPNAME COMMAND ARG --FLAG`

**Basic Example:**
```go
// cmd/root.go
package cmd

import (
    "github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
    Use:   "timetrack",
    Short: "CLI for time tracking API",
    Long:  "Command-line interface for interacting with the time tracking dashboard API",
}

func Execute() error {
    return rootCmd.Execute()
}

// cmd/start.go
var startCmd = &cobra.Command{
    Use:   "start [description]",
    Short: "Start a new time entry",
    Args:  cobra.ExactArgs(1),
    Run: func(cmd *cobra.Command, args []string) {
        description := args[0]
        // Make API call here
        fmt.Printf("Starting time entry: %s\n", description)
    },
}

func init() {
    rootCmd.AddCommand(startCmd)
    startCmd.Flags().StringP("project", "p", "", "Project name")
}
```

**Scaffolding:**
```bash
# Generate new CLI project
cobra-cli init

# Add commands
cobra-cli add start
cobra-cli add stop
cobra-cli add list
```

**Used By:** Kubernetes (kubectl), Hugo, GitHub CLI, Docker CLI

---

### Viper: Configuration Management

**What It Does:**
- Reads config from files (JSON, YAML, TOML), environment variables, flags
- Precedence order: flags > env vars > config file > defaults
- Single source of truth for configuration

**Why Use It:**
- Users can configure API endpoint, token storage location
- Supports multiple config sources without code changes
- Type-safe config unmarshaling

**Integration with Cobra:**
```go
package cmd

import (
    "fmt"
    "github.com/spf13/cobra"
    "github.com/spf13/viper"
)

var (
    cfgFile string
    apiURL  string
    token   string
)

var rootCmd = &cobra.Command{
    Use: "timetrack",
    PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
        // Initialize config
        if cfgFile != "" {
            viper.SetConfigFile(cfgFile)
        } else {
            viper.AddConfigPath("$HOME/.timetrack")
            viper.SetConfigName("config")
            viper.SetConfigType("yaml")
        }

        // Read environment variables
        viper.SetEnvPrefix("TIMETRACK")
        viper.AutomaticEnv()

        // Read config file
        if err := viper.ReadInConfig(); err == nil {
            fmt.Println("Using config file:", viper.ConfigFileUsed())
        }

        // Bind flags
        viper.BindPFlag("api_url", cmd.Flags().Lookup("api-url"))
        viper.BindPFlag("token", cmd.Flags().Lookup("token"))

        return nil
    },
}

func init() {
    rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.timetrack/config.yaml)")
    rootCmd.PersistentFlags().StringVar(&apiURL, "api-url", "http://localhost:3000", "API endpoint URL")
    rootCmd.PersistentFlags().StringVar(&token, "token", "", "Authentication token")
}
```

**Config File Example (`~/.timetrack/config.yaml`):**
```yaml
api_url: https://timetrack.example.com
token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Best Practices:**
- Use instance-based Viper (not global singleton) for testability
- Use `viper.Unmarshal()` for type-safe config structs
- Use `viper.AllSettings()` for debugging config issues

---

### Resty: HTTP Client (Axios Equivalent)

**What It Does:**
- HTTP/REST client for Go (most axios-like experience)
- Built-in retry logic, circuit breakers, load balancing
- Middleware support, authentication helpers
- Fluent API similar to axios

**Why This Over Standard `net/http`:**
- Cleaner API (no manual request building)
- Built-in retry/timeout logic
- Automatic JSON marshaling/unmarshaling
- Request/response middleware

**Basic Usage:**
```go
package api

import (
    "github.com/go-resty/resty/v2"
)

type Client struct {
    resty *resty.Client
}

func NewClient(apiURL, token string) *Client {
    client := resty.New().
        SetBaseURL(apiURL).
        SetHeader("Authorization", "Bearer "+token).
        SetHeader("Content-Type", "application/json").
        SetRetryCount(3).
        SetRetryWaitTime(5 * time.Second)

    return &Client{resty: client}
}

func (c *Client) StartEntry(description string, project string) error {
    type StartRequest struct {
        Description string `json:"description"`
        Project     string `json:"project"`
    }

    resp, err := c.resty.R().
        SetBody(StartRequest{
            Description: description,
            Project:     project,
        }).
        Post("/entries/start")

    if err != nil {
        return fmt.Errorf("failed to start entry: %w", err)
    }

    if resp.IsError() {
        return fmt.Errorf("API error: %s", resp.Status())
    }

    return nil
}

func (c *Client) ListEntries() ([]Entry, error) {
    var entries []Entry

    resp, err := c.resty.R().
        SetResult(&entries).
        Get("/entries")

    if err != nil {
        return nil, fmt.Errorf("failed to list entries: %w", err)
    }

    if resp.IsError() {
        return nil, fmt.Errorf("API error: %s", resp.Status())
    }

    return entries, nil
}
```

**Full CLI Integration Example:**
```go
// cmd/start.go
var startCmd = &cobra.Command{
    Use:   "start [description]",
    Short: "Start a new time entry",
    Args:  cobra.ExactArgs(1),
    RunE: func(cmd *cobra.Command, args []string) error {
        // Get config from Viper
        apiURL := viper.GetString("api_url")
        token := viper.GetString("token")
        project, _ := cmd.Flags().GetString("project")

        // Create API client
        client := api.NewClient(apiURL, token)

        // Make API call
        if err := client.StartEntry(args[0], project); err != nil {
            return err
        }

        fmt.Println("✓ Time entry started")
        return nil
    },
}
```

**Resty Features Comparison:**

| Feature | Resty | Standard net/http | axios (JS) |
|---------|-------|-------------------|------------|
| Fluent API | ✅ | ❌ | ✅ |
| Auto JSON | ✅ | Manual | ✅ |
| Retry Logic | ✅ Built-in | Manual | Libraries |
| Circuit Breaker | ✅ | Manual | Libraries |
| Middleware | ✅ | Manual | ✅ Interceptors |
| Base URL | ✅ | Manual | ✅ |
| Timeout | ✅ | Manual | ✅ |

---

### Alternative Go HTTP Clients

| Library | Pros | Cons | Use Case |
|---------|------|------|----------|
| **Resty** | Axios-like API, built-in features | Slightly more dependencies | **Recommended for this project** |
| **axios4go** | Direct Axios port | Less mature | Familiar for JS devs |
| **req** | Zero dependencies, axios-inspired | Smaller ecosystem | Minimal dependency requirements |
| **net/http** | Standard library | Verbose, manual everything | Simple one-off requests |

**Verdict:** Resty is the best choice for a production CLI tool with REST API integration.

---

### Go CLI Best Practices (2026)

**Project Structure:**
```
timetrack-cli/
├── cmd/
│   ├── root.go       # Root command + config
│   ├── start.go      # Start command
│   ├── stop.go       # Stop command
│   └── list.go       # List command
├── internal/
│   └── api/
│       └── client.go # Resty client wrapper
├── go.mod
├── go.sum
└── main.go
```

**Configuration Precedence:**
1. CLI flags (highest priority)
2. Environment variables
3. Config file
4. Defaults (lowest priority)

**Error Handling:**
```go
// Use RunE instead of Run for errors
var myCmd = &cobra.Command{
    RunE: func(cmd *cobra.Command, args []string) error {
        // Return errors instead of handling them
        return someFunction()
    },
}
```

**Shell Completions:**
```bash
# Generate completions
timetrack completion bash > /etc/bash_completion.d/timetrack
timetrack completion zsh > ~/.zsh/completions/_timetrack
```

**Debugging Config:**
```go
// Print all config values (debugging)
fmt.Println(viper.AllSettings())
```

**Sources:**
- [OneUptime: Go CLI with Cobra](https://oneuptime.com/blog/post/2026-01-07-go-cobra-cli/view)
- [GitHub: spf13/cobra](https://github.com/spf13/cobra)
- [GitHub: spf13/viper](https://github.com/spf13/viper)
- [GitHub: go-resty/resty](https://github.com/go-resty/resty)
- [Glukhov: Building CLI Apps with Cobra & Viper](https://www.glukhov.org/post/2025/11/go-cli-applications-with-cobra-and-viper/)
- [Web Scraping FYI: Axios vs Resty Comparison](https://webscraping.fyi/lib/compare/go-resty-vs-javascript-axios/)

---

## Quick Start Commands

### Authentication Setup (Fastify Backend)

```bash
# Install JWT plugin
cd backend
npm install @fastify/jwt

# Generate secure secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Add to .env: JWT_SECRET=<generated_secret>
```

### Docker Setup

```bash
# Build and run all services
docker-compose up --build

# Run in background
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down

# Remove volumes (reset database)
docker-compose down -v
```

### Go CLI Setup

```bash
# Initialize new CLI project
mkdir timetrack-cli && cd timetrack-cli
go mod init github.com/yourusername/timetrack-cli
go install github.com/spf13/cobra-cli@latest
cobra-cli init

# Install dependencies
go get -u github.com/spf13/cobra@latest
go get -u github.com/spf13/viper@latest
go get -u github.com/go-resty/resty/v2

# Add commands
cobra-cli add start
cobra-cli add stop
cobra-cli add list

# Build
go build -o timetrack

# Install system-wide
go install
```

---

## Recommended Reading

**Authentication:**
- [Fastify JWT Documentation](https://github.com/fastify/fastify-jwt)
- [JWT Best Practices 2026](https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs)

**Docker:**
- [Docker Compose Health Checks Guide](https://last9.io/blog/docker-compose-health-checks/)
- [Multi-Stage Builds for Node.js](https://oneuptime.com/blog/post/2026-01-06-nodejs-multi-stage-dockerfile/view)

**Go CLI:**
- [Cobra Official Documentation](https://cobra.dev/)
- [Viper Configuration Guide](https://github.com/spf13/viper)
- [Resty Client Examples](https://github.com/go-resty/resty)

---

## Technology Versions Summary

| Technology | Version | Purpose |
|------------|---------|---------|
| @fastify/jwt | v9 (Fastify 5) / v8 (Fastify 4) | JWT authentication |
| fast-jwt | (internal) | JWT implementation (via @fastify/jwt) |
| Node.js | 20-alpine | Backend runtime |
| PostgreSQL | 16-alpine | Production database |
| Cobra | v1.10.2 | Go CLI framework |
| Viper | Latest | Go configuration |
| Resty | v2.17.1 | Go HTTP client |

---

## Migration Path

**Current State → Production-Ready:**

1. **Phase 1: Single-User Auth (Immediate)**
   - Install `@fastify/jwt`
   - Implement hardcoded single-user login
   - JWT-protected routes
   - No database changes needed

2. **Phase 2: Database Migration (Next)**
   - Migrate SQLite → PostgreSQL
   - Update Prisma schema
   - Docker Compose with health checks

3. **Phase 3: Multi-User Support (Future)**
   - Add User model to Prisma
   - Add bcrypt for password hashing
   - Update login route to query database
   - JWT logic stays the same

4. **Phase 4: Production Deployment (Final)**
   - Implement Docker secrets
   - Multi-stage Docker builds
   - Deploy to Hetzner with docker-compose

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|-----------|--------|
| Fastify JWT | HIGH | Official plugin, verified from GitHub source |
| Docker Patterns | HIGH | Multiple 2025-2026 sources, Docker official docs |
| Go CLI Tools | HIGH | Official repos, recent releases, large adoption |
| Security Practices | HIGH | 2026 security recommendations, official Docker docs |

**Overall Confidence: HIGH** - All recommendations based on official documentation, recent sources (2025-2026), and current best practices.
