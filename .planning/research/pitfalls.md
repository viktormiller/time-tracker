# Domain Pitfalls: Time Tracking with Authentication & Multi-Source Aggregation

**Domain:** Time tracking dashboard with single-user authentication
**Tech Stack:** Node.js (Fastify), React, Prisma ORM, SQLite → PostgreSQL, Docker Compose, Hetzner deployment
**Researched:** 2026-01-19
**Overall Confidence:** HIGH (based on official documentation, community reports, and 2025 security advisories)

---

## Executive Summary

Building a time tracking system that aggregates from multiple sources (Toggl, Tempo) while adding authentication and migrating to PostgreSQL presents several critical pitfalls. The most severe risks involve:

1. **Authentication bypass vulnerabilities** in simple single-user systems (CVE-2025-0108 and similar)
2. **Docker secrets exposure** through environment variables
3. **Race conditions in Prisma upsert** with composite unique constraints
4. **Data type incompatibilities** when migrating from SQLite to PostgreSQL
5. **Timezone/DST edge cases** causing duplicate or missing entries
6. **API rate limiting** on Toggl (new limits starting September 2025)

This document categorizes pitfalls by severity and provides concrete prevention strategies.

---

## Critical Pitfalls

Mistakes that cause security breaches, data corruption, or complete system rewrites.

### Pitfall 1: Hardcoded Secrets in Docker Images/Environment Variables

**What goes wrong:**
Secrets (API tokens, database passwords) are stored directly in `docker-compose.yml` environment variables or baked into Docker images. These credentials become permanently exposed when images are pushed to registries or docker-compose files are committed to version control.

**Why it happens:**
Environment variables seem convenient for configuration. Developers test locally with `.env` files and mistakenly use the same pattern in production docker-compose files.

**Consequences:**
- API tokens for Toggl/Tempo exposed forever in Docker Hub/GitHub
- Database passwords leaked in container inspection
- Credentials accessible via `docker inspect` or process environment
- "Environment variables can unintentionally be leaked between containers" (Docker official docs)

**Prevention:**
```yaml
# BAD - Don't do this in production
services:
  backend:
    environment:
      - TOGGL_API_TOKEN=abc123...  # EXPOSED!
      - DATABASE_URL=postgresql://user:password@db:5432/timetracker

# GOOD - Use Docker Secrets
services:
  backend:
    secrets:
      - toggl_api_token
      - tempo_api_token
      - database_password
    environment:
      - DATABASE_URL=postgresql://user@db:5432/timetracker

secrets:
  toggl_api_token:
    file: ./secrets/toggl_token.txt
  tempo_api_token:
    file: ./secrets/tempo_token.txt
  database_password:
    file: ./secrets/db_password.txt
```

In your application code, read from `/run/secrets/<secret_name>`:
```typescript
import fs from 'fs';
const togglToken = fs.readFileSync('/run/secrets/toggl_api_token', 'utf8').trim();
```

**Detection:**
- Run `docker inspect <container>` and check for sensitive data in environment variables
- Audit `docker-compose.yml` for hardcoded credentials
- Use tools like GitGuardian to scan for leaked secrets

**Sources:**
- [Docker Compose Secrets Best Practices](https://docs.docker.com/compose/how-tos/environment-variables/best-practices/)
- [Secrets in Compose](https://docs.docker.com/compose/how-tos/use-secrets/)
- [Managing Secrets in Docker Compose](https://engineerpalsu.medium.com/managing-environment-variables-and-secrets-in-compose-0315c2aa1886)

**Confidence:** HIGH (official Docker documentation)

---

### Pitfall 2: Authentication Bypass Through URL Manipulation or Session Hijacking

**What goes wrong:**
Single-user authentication systems often implement naive checks like "if user logged in, show dashboard". Attackers bypass authentication through:
- URL manipulation (directly accessing `/api/entries` without login)
- Session token not validated on every request
- Session tokens in URLs instead of secure HttpOnly cookies
- No session timeout or absolute expiration

**Why it happens:**
Developers assume "single user = simple auth = less security needed". The system feels private, so authentication is an afterthought. Common pattern:
```typescript
// BAD - Only checks on login route
app.post('/login', async (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.loggedIn = true;
  }
});

// Vulnerable - No auth check!
app.get('/api/entries', async (req, res) => {
  return prisma.timeEntry.findMany(); // Anyone can access this
});
```

**Consequences:**
- Unauthenticated access to time tracking data
- Sensitive project names and time spent exposed
- API tokens visible in responses if not filtered
- Session fixation attacks (reuse of session ID before/after login)

**Real-world example:**
CVE-2025-0108 (Palo Alto Networks): Authentication bypass in management interface allowed unauthenticated attackers to invoke PHP scripts. "Attackers actively exploit these flaws within days of public disclosure."

**Prevention:**

1. **Validate session on EVERY protected route:**
```typescript
// Middleware approach
const requireAuth = async (req, res, next) => {
  if (!req.session?.userId || !req.session?.authenticated) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  // Verify session hasn't expired
  const sessionAge = Date.now() - req.session.createdAt;
  if (sessionAge > SESSION_TIMEOUT_MS) {
    req.session.destroy();
    return res.status(401).send({ error: 'Session expired' });
  }

  next();
};

app.get('/api/entries', requireAuth, async (req, res) => {
  // Now safe
});
```

2. **Regenerate session ID after login:**
```typescript
app.post('/login', async (req, res) => {
  if (await verifyPassword(req.body.password)) {
    // Prevent session fixation
    req.session.regenerate((err) => {
      req.session.userId = 1; // Your single user
      req.session.authenticated = true;
      req.session.createdAt = Date.now();
    });
  }
});
```

3. **Use secure session configuration:**
```typescript
app.register(fastifyCookie);
app.register(fastifySession, {
  secret: process.env.SESSION_SECRET, // 32+ random bytes
  cookie: {
    secure: true,        // HTTPS only
    httpOnly: true,      // Not accessible via JavaScript
    sameSite: 'strict',  // CSRF protection
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  },
  saveUninitialized: false,
  rolling: true // Reset expiry on activity
});
```

4. **Implement absolute and idle timeouts:**
```typescript
const MAX_SESSION_AGE = 1000 * 60 * 60 * 24; // 24 hours absolute
const IDLE_TIMEOUT = 1000 * 60 * 30;          // 30 minutes idle

middleware:
  if (Date.now() - session.createdAt > MAX_SESSION_AGE) {
    // Force re-login after 24 hours
  }
  if (Date.now() - session.lastActivity > IDLE_TIMEOUT) {
    // Force re-login after 30 min inactivity
  }
  session.lastActivity = Date.now();
```

5. **Destroy session on logout (server-side):**
```typescript
app.post('/logout', requireAuth, async (req, res) => {
  req.session.destroy((err) => {
    res.clearCookie('sessionId');
    res.send({ message: 'Logged out' });
  });
});
```

**Detection:**
- Try accessing `/api/entries` without logging in
- Check if session tokens appear in URL or localStorage
- Verify session invalidates after logout
- Test session expiry after timeout period

**Sources:**
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [A Practical Guide to Authentication Vulnerabilities](https://infosecwriteups.com/a-practical-guide-to-authentication-and-session-management-vulnerabilities-517f5412a02a)
- [OWASP Top 10 2025: Authentication Failures](https://owasp.org/Top10/2025/A07_2025-Authentication_Failures/)
- [CVE-2025-0108 PAN-OS Authentication Bypass](https://security.paloaltonetworks.com/CVE-2025-0108)

**Confidence:** HIGH (OWASP official guidance + recent 2025 CVEs)

---

### Pitfall 3: Race Conditions in Prisma Upsert with Composite Unique Constraints

**What goes wrong:**
When multiple sync operations run concurrently (e.g., manual sync while cron job runs), Prisma's `upsert` with composite unique constraints `@@unique([source, externalId])` throws "Unique constraint failed" errors instead of performing atomic upsert.

**Why it happens:**
Prisma's upsert is not always a true database-level atomic operation. From version 4.6.0+, Prisma tries to use database-level upserts, but if the query doesn't meet specific criteria, Prisma handles it in application code:

1. SELECT to check if record exists
2. If not found, INSERT
3. If found, UPDATE

Between steps 1 and 2, another concurrent request can insert the same record, causing a unique constraint violation.

**Your current code is vulnerable:**
```typescript
// From toggl.service.ts and tempo.service.ts
await this.prisma.timeEntry.upsert({
  where: {
    source_externalId: { source: 'TOGGL', externalId: entry.id.toString() }
  },
  // ... create/update
});
```

If two sync operations run simultaneously:
- Request A checks: "Does TOGGL entry 12345 exist?" → No
- Request B checks: "Does TOGGL entry 12345 exist?" → No
- Request A inserts: TOGGL entry 12345
- Request B tries to insert: TOGGL entry 12345 → CRASH! Unique constraint failed

**Consequences:**
- Sync jobs fail with cryptic Prisma errors
- Data not imported despite successful API calls
- Manual sync button unreliable
- Cron jobs appear broken

**Prevention:**

**Strategy 1: Transaction-level locking (PostgreSQL only)**
```typescript
// Use explicit transaction with SELECT FOR UPDATE
await prisma.$transaction(async (tx) => {
  const existing = await tx.timeEntry.findUnique({
    where: { source_externalId: { source: 'TOGGL', externalId: id } }
  });

  if (existing) {
    return tx.timeEntry.update({
      where: { id: existing.id },
      data: { duration, description, project, date }
    });
  } else {
    return tx.timeEntry.create({
      data: { source: 'TOGGL', externalId: id, duration, description, project, date }
    });
  }
}, {
  isolationLevel: 'Serializable' // Strongest isolation
});
```

**Strategy 2: Catch and retry pattern**
```typescript
async function upsertWithRetry(data: TimeEntryData, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await prisma.timeEntry.upsert({
        where: { source_externalId: { source: data.source, externalId: data.externalId } },
        update: { duration: data.duration, description: data.description },
        create: data
      });
    } catch (error) {
      if (error.code === 'P2002' && attempt < maxRetries - 1) {
        // Unique constraint violation - retry
        console.log(`Upsert collision detected, retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1))); // Exponential backoff
        continue;
      }
      throw error; // Give up or different error
    }
  }
}
```

**Strategy 3: Application-level locking**
```typescript
import { Mutex } from 'async-mutex';

class SyncService {
  private syncMutexes = new Map<string, Mutex>();

  private getMutex(source: string): Mutex {
    if (!this.syncMutexes.has(source)) {
      this.syncMutexes.set(source, new Mutex());
    }
    return this.syncMutexes.get(source)!;
  }

  async syncTogglEntries(forceRefresh = false) {
    const mutex = this.getMutex('TOGGL');
    const release = await mutex.acquire();

    try {
      // Your existing sync logic here
      // Now guaranteed single-threaded per source
    } finally {
      release();
    }
  }
}
```

**Strategy 4: Idempotency tokens in schema (best long-term)**
```prisma
model TimeEntry {
  id             String   @id @default(uuid())
  source         String
  externalId     String?
  date           DateTime
  duration       Float
  project        String?
  description    String?
  syncRequestId  String?  // Track which sync operation created this
  createdAt      DateTime @default(now())

  @@unique([source, externalId])
  @@unique([source, externalId, syncRequestId]) // Prevent double-processing same sync
  @@index([date])
}
```

**Detection:**
- Run two sync operations simultaneously: `curl -X POST /api/sync/toggl` (twice in parallel)
- Check logs for Prisma P2002 errors (unique constraint violation)
- Monitor sync success rate in production

**Sources:**
- [Prisma Issue #3242: Upsert race condition](https://github.com/prisma/prisma/issues/3242)
- [Prisma Discussion #24888: Upsert with composite unique constraint](https://github.com/prisma/prisma/discussions/24888)
- [Prisma Issue #14868: Unique constraint failed when using upsert](https://github.com/prisma/prisma/issues/14868)

**Confidence:** HIGH (confirmed Prisma GitHub issues with community workarounds)

---

### Pitfall 4: SQLite to PostgreSQL Data Type Incompatibilities

**What goes wrong:**
Migrating from SQLite to PostgreSQL causes silent data corruption or query failures due to fundamentally different type systems:

1. **Boolean representation**: SQLite stores as 0/1, PostgreSQL has native BOOLEAN
2. **DateTime storage**: SQLite uses TEXT (ISO strings) or INTEGER (unix timestamps), PostgreSQL has TIMESTAMP/TIMESTAMPTZ
3. **Auto-increment**: SQLite uses AUTOINCREMENT, PostgreSQL uses SERIAL/IDENTITY
4. **Type affinity**: SQLite allows storing "hello" in an INTEGER column, PostgreSQL strictly enforces types

**Your current schema (SQLite):**
```prisma
model TimeEntry {
  id          String   @id @default(uuid())  // Works in both
  source      String
  externalId  String?
  date        DateTime // SQLite: stored as TEXT "2025-01-15T10:30:00Z"
  duration    Float
  project     String?
  description String?
  createdAt   DateTime @default(now())

  @@unique([source, externalId])
  @@index([date])
}
```

**Why it happens:**
Developers test with SQLite locally, assuming PostgreSQL "just works". Prisma abstracts some differences, but not all. The codebase stores datetimes as ISO strings, queries filter by date ranges, and comparisons work differently across databases.

**Consequences:**

**Problem 1: DateTime loses timezone information**
```typescript
// Your code (from tempo.service.ts):
date: new Date(entry.startDate) // entry.startDate = "2025-01-15"

// SQLite: Stores as "2025-01-15T00:00:00.000Z" (TEXT)
// PostgreSQL (TIMESTAMP): Stores as "2025-01-15 00:00:00" - NO TIMEZONE!
```

When user in Germany logs 8 hours on Jan 15, PostgreSQL stores it in UTC but has no timezone. When querying by date range, results may shift by one day due to timezone conversion assumptions.

**Problem 2: Date comparisons break**
```sql
-- SQLite: String comparison works
WHERE date >= '2025-01-01' -- Compares TEXT

-- PostgreSQL: Timestamp comparison
WHERE date >= '2025-01-01' -- Implicitly converts, but timezone matters
```

**Problem 3: Boolean fields (future-proofing)**
If you add a `Boolean` field like `isManual`:
```prisma
model TimeEntry {
  isManual Boolean @default(false)
}
```

SQLite stores as 0/1 (INTEGER), PostgreSQL as true/false (BOOLEAN). Queries like `WHERE isManual = 1` work in SQLite, fail in PostgreSQL.

**Prevention:**

**1. Use TIMESTAMPTZ for all datetime fields (PostgreSQL-specific)**
```prisma
model TimeEntry {
  date      DateTime @db.Timestamptz(6) // Stores timezone info
  createdAt DateTime @default(now()) @db.Timestamptz(6)
}
```

**2. Always store dates in UTC, convert in application**
```typescript
// BAD - Ambiguous timezone
const date = new Date(entry.startDate); // What timezone is "2025-01-15"?

// GOOD - Explicit UTC
const date = new Date(entry.startDate + 'T00:00:00Z'); // Force UTC

// BETTER - Use date library
import { parseISO, startOfDay } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

const utcDate = startOfDay(parseISO(entry.startDate)); // Midnight UTC
```

**3. Test migration with real data**
```bash
# Export SQLite data
sqlite3 dev.db ".dump" > backup.sql

# Create PostgreSQL schema
npx prisma migrate deploy --schema=schema.prisma

# Use pgloader for migration (handles type conversions)
pgloader sqlite://dev.db postgresql://user:pass@localhost:5432/timetracker
```

**4. Validate data after migration**
```sql
-- Check for null dates (corruption)
SELECT COUNT(*) FROM "TimeEntry" WHERE date IS NULL;

-- Check date range sanity
SELECT MIN(date), MAX(date) FROM "TimeEntry";

-- Check duration sanity (negative or extreme values)
SELECT * FROM "TimeEntry" WHERE duration < 0 OR duration > 24;
```

**5. Update queries for PostgreSQL dialect**
```typescript
// SQLite-compatible query
const entries = await prisma.timeEntry.findMany({
  where: { date: { gte: new Date('2025-01-01') } }
});

// PostgreSQL-specific (if needed)
const entries = await prisma.$queryRaw`
  SELECT * FROM "TimeEntry"
  WHERE date >= ${'2025-01-01'}::timestamp AT TIME ZONE 'UTC'
`;
```

**Detection:**
- Run `npx prisma db pull` after migration, check for type changes
- Query min/max dates before and after migration, verify consistency
- Test date range filters with known entries
- Check for `undefined` or `null` in datetime fields

**Sources:**
- [SQLite to PostgreSQL Migration Guide](https://render.com/articles/how-to-migrate-from-sqlite-to-postgresql)
- [Prisma DateTime/Timezone Issues with PostgreSQL](https://medium.com/@basem.deiaa/how-to-fix-prisma-datetime-and-timezone-issues-with-postgresql-1c778aa2d122)
- [pgloader SQLite to Postgres documentation](https://pgloader.readthedocs.io/en/latest/ref/sqlite.html)
- [Prisma Issue #27786: DateTime defaults in SQLite can't be read by Prisma](https://github.com/prisma/prisma/issues/27786)

**Confidence:** HIGH (official Prisma docs + community migration guides)

---

### Pitfall 5: Docker Networking Exposes Unnecessary Ports

**What goes wrong:**
Docker containers expose database ports (5432 for PostgreSQL) to the host network, allowing direct database access from outside the Docker network. Attackers on the same network (Hetzner datacenter) or through compromised services can connect directly to PostgreSQL.

**Why it happens:**
Default docker-compose templates expose all ports for convenience:
```yaml
services:
  db:
    image: postgres:16
    ports:
      - "5432:5432"  # EXPOSED TO HOST!
```

Developers think "I need to connect from backend", not realizing backend is on the same Docker network and doesn't need host port exposure.

**Consequences:**
- PostgreSQL accessible from Hetzner host's public IP (if firewall not configured)
- Brute-force attacks on database password
- Database enumeration even if password is strong
- Unnecessary attack surface

**Prevention:**

**1. Don't expose database ports to host**
```yaml
services:
  backend:
    image: node:20
    networks:
      - app-network
    environment:
      - DATABASE_URL=postgresql://user@db:5432/timetracker
    # No ports exposed for DB connection - uses internal network

  db:
    image: postgres:16
    networks:
      - app-network
    # NO "ports:" SECTION!
    # Database only accessible from app-network

  frontend:
    image: nginx:alpine
    ports:
      - "80:80"    # Only expose what users need
      - "443:443"
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

**2. Disable inter-container communication by default**
```yaml
networks:
  app-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_icc: "false"
```

**3. If you need database access for debugging, use SSH tunnel**
```bash
# From your local machine
ssh -L 5432:localhost:5432 user@hetzner-server

# Inside Hetzner server, temporarily expose
docker exec -it timetracker_db psql -U user -d timetracker

# Or use Prisma Studio via SSH tunnel
ssh -L 5555:localhost:5555 user@hetzner-server
npx prisma studio # On server
```

**4. Use Docker's internal DNS**
```typescript
// Backend connects via service name, not host IP
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://user:pass@db:5432/timetracker';
  //                        ^^^ service name, not "localhost" or IP
```

**Detection:**
- Run `docker ps` and check PORTS column for `0.0.0.0:5432->5432/tcp`
- Try connecting to database from host: `psql -h localhost -U user -d timetracker`
- Scan from another machine: `nmap -p 5432 hetzner-server-ip`

**Sources:**
- [Docker Security Best Practices](https://spacelift.io/blog/docker-security)
- [Docker Container Security Vulnerabilities](https://www.aikido.dev/blog/docker-container-security-vulnerabilities)
- [Hetzner Docker Firewall Tutorial](https://community.hetzner.com/tutorials/debian-docker-install-dualstack-firewall/)

**Confidence:** HIGH (official Docker docs + Hetzner community tutorials)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or unreliable behavior.

### Pitfall 6: Timezone and DST Edge Cases in Time Tracking

**What goes wrong:**
Time entries logged near midnight or during Daylight Saving Time transitions appear duplicated, missing, or on the wrong date. Users log 8 hours on March 10, but system shows 7 hours (DST spring forward) or 9 hours (DST fall back).

**Why it happens:**
Your current code stores dates without timezone context:
```typescript
// From toggl.service.ts
date: new Date(entry.start) // entry.start = "2025-03-10T02:30:00-05:00"
```

When DST transitions happen:
- **Spring forward** (March): 2:00 AM becomes 3:00 AM, the hour 2:00-2:59 doesn't exist
- **Fall back** (November): 2:00 AM happens twice (once before, once after)

If user starts timer at 1:45 AM and stops at 2:15 AM on DST spring forward day:
- Start: 1:45 AM EST (valid)
- End: 3:15 AM EDT (2:15 doesn't exist!)
- Duration calculation breaks

**Real-world scenarios:**

**Scenario 1: Duplicate entries near midnight**
```
User in New York (EST) logs time: 11:30 PM - 12:30 AM
Backend stores in UTC: 4:30 AM - 5:30 AM (next day)
Display converts back: Shows on wrong date depending on viewing timezone
```

**Scenario 2: DST transition day shows wrong hours**
```
March 10, 2025 (DST spring forward):
User logs 9 AM - 5 PM (8 hours)
System calculates: Day only had 23 hours
Daily aggregation shows: 7 hours? 8 hours? Depends on calculation
```

**Consequences:**
- Users complain "I logged 8 hours, but chart shows 7"
- Duplicate entries when syncing across DST boundary
- Data aggregation broken for DST transition days
- Week/month summaries don't match detailed view

**Prevention:**

**1. Store all times in UTC (database)**
```typescript
// GOOD - Explicit UTC storage
const utcDate = new Date(entry.start); // Comes with timezone from API
await prisma.timeEntry.create({
  data: {
    date: utcDate, // Prisma stores as UTC TIMESTAMPTZ
    duration: durationSeconds / 3600
  }
});
```

**2. Use date-only fields for aggregation, not timestamps**
```typescript
// BAD - Timestamp-based date comparison
const entries = await prisma.timeEntry.findMany({
  where: {
    date: {
      gte: new Date('2025-01-01T00:00:00'), // Which timezone?
      lt: new Date('2025-01-02T00:00:00')
    }
  }
});

// GOOD - Use date strings for day-based queries
const entries = await prisma.timeEntry.findMany({
  where: {
    date: {
      gte: new Date('2025-01-01T00:00:00Z'), // Explicit UTC
      lt: new Date('2025-01-02T00:00:00Z')
    }
  }
});

// BETTER - Use date-only column if aggregating by date
// Add a computed field in schema
model TimeEntry {
  date      DateTime @db.Timestamptz(6)
  dateOnly  String   // "2025-01-15" - computed from date in user's timezone
}
```

**3. Handle DST explicitly in aggregations**
```typescript
// Don't rely on "24 hours = 1 day"
import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

function getDayRange(dateString: string, userTimezone: string) {
  const localDate = parseISO(dateString); // "2025-03-10"
  const startLocal = startOfDay(localDate);
  const endLocal = endOfDay(localDate);

  // Convert to UTC for database query
  const startUtc = zonedTimeToUtc(startLocal, userTimezone);
  const endUtc = zonedTimeToUtc(endLocal, userTimezone);

  return { startUtc, endUtc };
}

// Usage
const { startUtc, endUtc } = getDayRange('2025-03-10', 'America/New_York');
const entries = await prisma.timeEntry.findMany({
  where: { date: { gte: startUtc, lt: endUtc } }
});
```

**4. Test DST transition dates specifically**
```typescript
// Add test cases for DST boundaries
describe('Time entry aggregation', () => {
  it('handles DST spring forward (23-hour day)', async () => {
    const dstDate = '2025-03-10'; // Spring forward in 2025
    // Create entries spanning 1 AM - 4 AM (includes 2 AM skip)
    // Verify total duration is correct
  });

  it('handles DST fall back (25-hour day)', async () => {
    const dstDate = '2025-11-02'; // Fall back in 2025
    // Create entries spanning 1 AM - 3 AM (includes 2 AM twice)
    // Verify no duplicates
  });

  it('handles entries crossing midnight', async () => {
    // Start 11:30 PM, end 12:30 AM next day
    // Verify correct date assignment
  });
});
```

**5. Display timezone to user**
```typescript
// Frontend: Always show which timezone data is displayed in
<div>
  Showing times in: {Intl.DateTimeFormat().resolvedOptions().timeZone}
  <select onChange={handleTimezoneChange}>
    <option value="UTC">UTC</option>
    <option value="America/New_York">New York</option>
    <option value="Europe/Berlin">Berlin</option>
  </select>
</div>
```

**Detection:**
- Create test entry on March 10, 2025 (DST) spanning 1:30 AM - 3:30 AM
- Check if duration is calculated correctly (should be 1 hour, not 2)
- Query entries by date on DST transition day, verify count
- Compare weekly aggregations before/after DST transition

**Sources:**
- [International SaaS Timezone Edge Cases](https://dev.to/tomjstone/international-saas-nightmare-timezone-edge-cases-and-how-to-solve-them-once-and-for-all-57hn)
- [Edge Cases: Dates & Times](https://www.thedroidsonroids.com/blog/edge-cases-in-app-and-backend-development-dates-and-time)
- [Handling Timezone Issues in Cron Jobs 2025](https://dev.to/cronmonitor/handling-timezone-issues-in-cron-jobs-2025-guide-52ii)
- [W3C Working with TimeZones](https://www.w3.org/International/wiki/WorkingWithTimeZones)

**Confidence:** MEDIUM (community best practices, not Toggl/Tempo specific docs)

---

### Pitfall 7: Toggl API Rate Limiting (New 2025 Limits)

**What goes wrong:**
Starting September 5, 2025, Toggl introduced strict API rate limits. Sync operations fail with HTTP 429 errors when limits are exceeded:
- **Free plan**: 30 requests/hour/user/org
- **Paid plans**: Higher limits but still capped
- **Leaky bucket**: 1 request/second safe window

**Why it happens:**
Your current code has no rate limiting awareness:
```typescript
// From toggl.service.ts
const response = await axios.get('https://api.track.toggl.com/api/v9/me/time_entries', {
  params: { start_date, end_date }
});
```

If you:
- Sync multiple date ranges in parallel
- Have cron job running while user manually syncs
- Import large date ranges (3+ months)
- Retry failed requests without backoff

You'll hit rate limits quickly.

**Consequences:**
- Sync jobs fail silently with 429 errors
- Users can't refresh data when needed
- Cron jobs marked as "failed" despite API working
- Data becomes stale, defeating purpose of real-time aggregation

**Prevention:**

**1. Check rate limit headers in responses**
```typescript
async syncTogglEntries() {
  const response = await axios.get('https://api.track.toggl.com/api/v9/me/time_entries', {
    params: { start_date, end_date }
  });

  // Toggl provides these headers
  const remaining = response.headers['x-toggl-quota-remaining'];
  const resetsIn = response.headers['x-toggl-quota-resets-in'];

  console.log(`[Toggl] Rate limit: ${remaining} requests remaining, resets in ${resetsIn}s`);

  if (parseInt(remaining) < 5) {
    console.warn('[Toggl] Approaching rate limit, backing off...');
    await this.rateLimiter.waitForReset(parseInt(resetsIn));
  }

  return response.data;
}
```

**2. Implement exponential backoff for 429 responses**
```typescript
import axiosRetry from 'axios-retry';

const togglClient = axios.create();
axiosRetry(togglClient, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    if (error.response?.status === 429) {
      const resetSeconds = error.response.headers['x-toggl-quota-resets-in'];
      return (parseInt(resetSeconds) || 60) * 1000; // Wait until quota resets
    }
    return axiosRetry.exponentialDelay(retryCount); // Standard backoff
  },
  retryCondition: (error) => {
    return error.response?.status === 429 || axiosRetry.isNetworkOrIdempotentRequestError(error);
  }
});
```

**3. Use caching aggressively (you already have this)**
```typescript
// Your current implementation (GOOD)
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Extend for longer standard syncs
const CACHE_DURATION_MS = 1 * 60 * 60 * 1000; // 1 hour for standard syncs
```

**4. Batch requests intelligently**
```typescript
// BAD - Multiple API calls
for (const month of ['2025-01', '2025-02', '2025-03']) {
  await syncTogglMonth(month); // 3 API calls
}

// GOOD - Single API call with wider range
await syncTogglRange('2025-01-01', '2025-03-31'); // 1 API call
```

**5. Add rate limit tracking to database**
```prisma
model SyncStatus {
  id               String   @id @default(uuid())
  source           String   // "TOGGL" | "TEMPO"
  lastSyncAt       DateTime
  rateLimitResetAt DateTime?
  quotaRemaining   Int?

  @@unique([source])
}
```

```typescript
async syncTogglEntries() {
  // Check if we're in rate-limit cooldown
  const status = await prisma.syncStatus.findUnique({
    where: { source: 'TOGGL' }
  });

  if (status?.rateLimitResetAt && new Date() < status.rateLimitResetAt) {
    throw new Error(`Rate limited until ${status.rateLimitResetAt.toISOString()}`);
  }

  // Perform sync...

  // Update status after sync
  await prisma.syncStatus.upsert({
    where: { source: 'TOGGL' },
    update: {
      lastSyncAt: new Date(),
      quotaRemaining: parseInt(response.headers['x-toggl-quota-remaining']),
      rateLimitResetAt: response.headers['x-toggl-quota-resets-in']
        ? new Date(Date.now() + parseInt(response.headers['x-toggl-quota-resets-in']) * 1000)
        : null
    },
    create: { source: 'TOGGL', lastSyncAt: new Date() }
  });
}
```

**6. Notify user when rate limited**
```typescript
// Frontend: Display rate limit status
if (syncError?.response?.status === 429) {
  const resetIn = syncError.response.headers['x-toggl-quota-resets-in'];
  showNotification(`Rate limited. Try again in ${Math.ceil(resetIn / 60)} minutes.`);
}
```

**Detection:**
- Trigger manual sync multiple times rapidly (30+ times in 10 minutes)
- Check for HTTP 429 responses
- Verify logs show rate limit headers
- Test with cron job running during manual sync

**Sources:**
- [Toggl API & Webhook Limits](https://support.toggl.com/api-webhook-limits)
- [Toggl API Limits Enforcement Discussion](https://community.toggl.com/t/api-limits-enforcement/2331)
- [Toggl API FAQs about Limits](https://support.toggl.com/en/articles/11623558-faqs-about-api-limits)

**Confidence:** HIGH (official Toggl support docs, September 2025 announcement)

---

### Pitfall 8: UUID v4 Collision Risk at Scale

**What goes wrong:**
Your schema uses `@default(uuid())` for IDs. While UUID v4 collisions are theoretically rare, they can occur in distributed systems generating IDs rapidly. More critically, UUIDs:
- Are not sortable (random order)
- Don't indicate creation time
- Have poor database indexing performance
- Don't compress well

**Why it happens:**
Prisma defaults to UUID v4 for `@default(uuid())`. Developers assume "UUID = unique" without considering:
- Multiple servers generating IDs simultaneously
- Virtual machine clones with same RNG seed
- Client-side ID generation in browser

**Your current schema:**
```prisma
model TimeEntry {
  id String @id @default(uuid()) // UUID v4 - random
}
```

**Consequences:**
- Slight collision risk (1 in 10^18 at millions of IDs/second)
- Database queries slower due to random index order
- No way to sort by creation time from ID alone
- Storage overhead (36 characters as string)

**Prevention:**

**Option 1: Use UUID v7 (recommended for PostgreSQL)**
UUID v7 (RFC 9562, standardized 2024) includes timestamp in first 48 bits, providing:
- Monotonic ordering (chronological)
- Same collision resistance as v4
- Better database indexing

```prisma
// Requires Prisma 5.x+ and uuid v7 function
model TimeEntry {
  id String @id @default(dbgenerated("gen_uuid_v7()"))
}
```

Or use library in application:
```typescript
import { v7 as uuidv7 } from 'uuid';

const id = uuidv7(); // "018e6a8c-5a5f-7e2e-a9c7-3e0f1234567"
//         ^^^^^^^^^^ timestamp portion
```

**Option 2: Use Cuid2 (recommended for multi-database)**
Cuid2 designed specifically to avoid collisions:
- 4,000,000,000,000,000,000 IDs for 50% collision chance
- Lexicographically sortable
- Shorter than UUID (24 characters)

```typescript
import { createId } from '@paralleldrive/cuid2';

model TimeEntry {
  id String @id // Generate in application
}

// Application code
const id = createId(); // "cm1xyz..."
await prisma.timeEntry.create({
  data: { id, source, duration, ... }
});
```

**Option 3: Keep UUID but use v4 with awareness**
```typescript
// If staying with UUID v4, add collision detection
async function createEntryWithRetry(data: TimeEntryData, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await prisma.timeEntry.create({ data });
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('PRIMARY')) {
        // Primary key collision - regenerate ID
        data.id = uuidv4();
        continue;
      }
      throw error;
    }
  }
}
```

**Option 4: Use auto-incrementing integers (simple, but not distributed-safe)**
```prisma
model TimeEntry {
  id Int @id @default(autoincrement())
}
```
Only safe for single-database deployments. Breaks if you later shard or use multi-region replicas.

**For your project:**
Given single-user, single-server deployment, UUID v4 is fine. **BUT** if you migrate to PostgreSQL, consider UUID v7 for better performance:

```sql
-- PostgreSQL: Add uuid v7 function
CREATE OR REPLACE FUNCTION gen_uuid_v7()
RETURNS uuid
AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay('\x00000000000000000000000000000000'::bytea
          placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ) || gen_random_bytes(10),
    'hex'
  )::uuid;
$$ LANGUAGE SQL VOLATILE;
```

**Detection:**
- Check database query plans: `EXPLAIN SELECT * FROM TimeEntry ORDER BY id`
- Monitor index fragmentation on ID column
- Attempt to sort entries by ID, verify chronological order (will be random with v4)

**Sources:**
- [UUID v4 vs v7 vs ULID Comparison](https://www.ixam.net/en/blog/2025/08/uuidv4v7ulid/)
- [Cuid2 - Collision-Resistant IDs](https://github.com/paralleldrive/cuid2)
- [UUID vs NanoID vs CUID](https://www.wisp.blog/blog/uuid-vs-cuid-vs-nanoid-choosing-the-right-id-generator-for-your-application)
- [Why Nano ID is Better Than UUID](https://www.mtechzilla.com/blogs/why-nano-id-is-better-than-uuid)

**Confidence:** MEDIUM (UUIDs work fine for your scale, but v7 is best practice for 2025)

---

### Pitfall 9: Missing Pagination on Time Entry Queries

**What goes wrong:**
As time entries grow to thousands of records (years of data), API responses become slow and memory-intensive. Frontend crashes trying to render 10,000+ entries. Database queries scan entire table.

**Why it happens:**
Your current API likely returns all entries:
```typescript
// Naive implementation
app.get('/api/entries', async (req, res) => {
  const entries = await prisma.timeEntry.findMany(); // ALL ENTRIES!
  return res.send(entries);
});
```

After 1 year: ~2,000 entries (250 workdays * 8 hours of tracking)
After 5 years: ~10,000 entries

**Consequences:**
- API responses take 5+ seconds
- Frontend hangs rendering large tables
- Database memory exhausted on complex queries
- Network payload size exceeds reasonable limits (MB of JSON)

**Prevention:**

**1. Add pagination to schema/API**
```typescript
interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string; // For cursor-based pagination
}

app.get('/api/entries', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000); // Cap at 1000
  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      skip,
      take: limit,
      orderBy: { date: 'desc' }
    }),
    prisma.timeEntry.count()
  ]);

  return res.send({
    data: entries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});
```

**2. Use cursor-based pagination for large datasets**
```typescript
app.get('/api/entries', async (req, res) => {
  const limit = 50;
  const cursor = req.query.cursor as string | undefined;

  const entries = await prisma.timeEntry.findMany({
    take: limit + 1, // Fetch one extra to detect if there are more
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { date: 'desc' }
  });

  const hasMore = entries.length > limit;
  const data = hasMore ? entries.slice(0, -1) : entries;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return res.send({ data, nextCursor, hasMore });
});
```

**3. Default to date range filters**
```typescript
// Default to last 30 days if no filter provided
const startDate = req.query.startDate
  ? new Date(req.query.startDate as string)
  : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

const endDate = req.query.endDate
  ? new Date(req.query.endDate as string)
  : new Date();

const entries = await prisma.timeEntry.findMany({
  where: {
    date: { gte: startDate, lte: endDate }
  },
  orderBy: { date: 'desc' }
});
```

**4. Add database indexes for common queries**
```prisma
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
  @@index([date, source]) // Composite index for filtered queries
  @@index([date])         // Already exists
  @@index([project])      // If filtering by project is common
}
```

**Detection:**
- Load API with 1,000+ test entries
- Measure response time: `curl -w "%{time_total}\n" http://localhost:3000/api/entries`
- Check database query execution time: `EXPLAIN ANALYZE SELECT * FROM TimeEntry`
- Monitor memory usage during query

**Sources:**
- [Prisma Pagination Documentation](https://www.prisma.io/docs/orm/prisma-client/queries/pagination)

**Confidence:** HIGH (standard best practice, Prisma official docs)

---

### Pitfall 10: No Duplicate Detection Across Sources

**What goes wrong:**
User manually logs 8 hours in Toggl for "forHim" project. Separately, they log 8 hours in Tempo for "WEKA-199" (same work, different tracking system). System shows 16 hours for the day instead of 8.

**Why it happens:**
Your current schema enforces uniqueness within a source, but not across sources:
```prisma
@@unique([source, externalId]) // Unique within Toggl, unique within Tempo
```

Entry from Toggl and entry from Tempo for same time period are stored as separate entries. No logic detects "these are the same work session".

**Real-world scenario:**
```
Toggl entry:
  source: "TOGGL"
  externalId: "12345"
  date: 2025-01-15 09:00:00
  duration: 8
  project: "forHim"

Tempo entry:
  source: "TEMPO"
  externalId: "67890"
  date: 2025-01-15 09:00:00
  duration: 8
  project: "WEKA-199"

Dashboard shows: 16 hours on Jan 15 (WRONG!)
```

**Consequences:**
- Inflated time reports (user appears to work 16-hour days)
- Billing double-charged if using for invoicing
- Charts show unrealistic work patterns
- Loss of trust in system accuracy

**Prevention:**

**Strategy 1: Fuzzy duplicate detection**
```typescript
async function detectDuplicates(newEntry: TimeEntry): Promise<TimeEntry | null> {
  const OVERLAP_THRESHOLD = 0.8; // 80% overlap = likely duplicate

  // Find entries from OTHER sources on same date
  const candidates = await prisma.timeEntry.findMany({
    where: {
      source: { not: newEntry.source },
      date: {
        gte: new Date(newEntry.date.getTime() - 24 * 60 * 60 * 1000),
        lte: new Date(newEntry.date.getTime() + 24 * 60 * 60 * 1000)
      }
    }
  });

  for (const candidate of candidates) {
    const timeDiff = Math.abs(newEntry.date.getTime() - candidate.date.getTime());
    const durationDiff = Math.abs(newEntry.duration - candidate.duration);

    // Same time window (within 1 hour) and similar duration (within 0.5 hours)
    if (timeDiff < 60 * 60 * 1000 && durationDiff < 0.5) {
      return candidate; // Likely duplicate
    }
  }

  return null;
}

// In sync service
for (const entry of togglEntries) {
  const duplicate = await detectDuplicates(entry);
  if (duplicate) {
    console.log(`[Toggl] Skipping duplicate entry (matches ${duplicate.source} entry ${duplicate.id})`);
    continue;
  }
  await prisma.timeEntry.upsert({ /* ... */ });
}
```

**Strategy 2: Link related entries**
```prisma
model TimeEntry {
  id          String   @id @default(uuid())
  source      String
  externalId  String?
  date        DateTime
  duration    Float
  project     String?
  description String?

  // Link duplicates
  duplicateOf String?  // ID of canonical entry
  duplicate   TimeEntry? @relation("Duplicates", fields: [duplicateOf], references: [id])
  duplicates  TimeEntry[] @relation("Duplicates")

  @@unique([source, externalId])
  @@index([date])
}
```

```typescript
// In queries, exclude duplicates
const entries = await prisma.timeEntry.findMany({
  where: {
    date: { gte: startDate, lte: endDate },
    duplicateOf: null // Only show canonical entries
  }
});

// Show duplicate metadata in UI
const entryWithDuplicates = await prisma.timeEntry.findUnique({
  where: { id },
  include: { duplicates: true }
});
// UI: "This entry also tracked in Tempo as WEKA-199"
```

**Strategy 3: User-driven merge**
```typescript
// API endpoint to merge entries
app.post('/api/entries/merge', async (req, res) => {
  const { primaryId, duplicateIds } = req.body;

  await prisma.$transaction(async (tx) => {
    // Mark duplicates
    await tx.timeEntry.updateMany({
      where: { id: { in: duplicateIds } },
      data: { duplicateOf: primaryId }
    });

    // Optionally: combine durations if needed
    const primary = await tx.timeEntry.findUnique({ where: { id: primaryId } });
    const duplicates = await tx.timeEntry.findMany({ where: { id: { in: duplicateIds } } });

    const totalDuration = primary.duration + duplicates.reduce((sum, d) => sum + d.duration, 0);

    await tx.timeEntry.update({
      where: { id: primaryId },
      data: { duration: totalDuration }
    });
  });
});
```

**Strategy 4: Source priority system**
```typescript
// Configure which source is "canonical"
const SOURCE_PRIORITY = {
  'TEMPO': 1,  // Highest priority (official time tracking)
  'TOGGL': 2,  // Lower priority (personal tracking)
  'MANUAL': 3  // Lowest priority
};

async function resolveConflict(entries: TimeEntry[]): TimeEntry {
  return entries.sort((a, b) =>
    SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source]
  )[0];
}
```

**Detection:**
- Create identical entries in Toggl and Tempo for same date/time
- Query total duration for that date
- Check if sum is doubled
- Review chart for days with unrealistic hours (>12)

**Sources:**
- [Duplicate Entry Detection AI Agents](https://relevanceai.com/agent-templates-tasks/duplicate-entry-detection)
- [AI Reconciliation Use Cases](https://www.ledge.co/content/ai-reconciliation)
- [Cross-Dataset Deduplication Methods](https://www.emergentmind.com/topics/cross-dataset-deduplication)

**Confidence:** MEDIUM (general data reconciliation practices, not time-tracking specific)

---

## Minor Pitfalls

Mistakes that cause annoyance or edge case bugs, but are easily fixable.

### Pitfall 11: Hetzner Firewall Not Configured for Docker

**What goes wrong:**
After deploying to Hetzner, Docker containers are accessible from public internet because UFW (firewall) was configured before Docker installation. Docker bypasses UFW by directly manipulating iptables, exposing ports despite firewall rules.

**Why it happens:**
Docker modifies iptables directly on start. If UFW is configured as:
```bash
ufw default deny incoming
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

Then Docker starts and exposes ports, Docker adds its own iptables rules that take precedence, bypassing UFW.

**Consequences:**
- Database port 5432 accessible from internet (if exposed in docker-compose)
- Backend API port 3000 accessible directly (bypassing reverse proxy)
- Potential unauthorized access

**Prevention:**

**1. Configure UFW before Docker**
```bash
# Initial setup (one-time)
apt update && apt upgrade -y
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  # SSH
ufw allow 80/tcp  # HTTP
ufw allow 443/tcp # HTTPS
ufw enable
```

**2. Configure Docker to respect UFW**
Edit `/etc/docker/daemon.json`:
```json
{
  "iptables": false
}
```

Then restart Docker:
```bash
systemctl restart docker
```

**WARNING:** This disables Docker's automatic iptables rules. You must manually configure networking.

**3. Use Hetzner Cloud Firewall**
```bash
# Via Hetzner Cloud Console or CLI
hcloud firewall create --name time-tracker-fw
hcloud firewall add-rule time-tracker-fw --direction in --protocol tcp --port 22 --source-ips 0.0.0.0/0
hcloud firewall add-rule time-tracker-fw --direction in --protocol tcp --port 80 --source-ips 0.0.0.0/0
hcloud firewall add-rule time-tracker-fw --direction in --protocol tcp --port 443 --source-ips 0.0.0.0/0
hcloud firewall apply-to-server time-tracker-fw --server <server-id>
```

**4. Only expose necessary ports in docker-compose**
```yaml
services:
  backend:
    # Don't expose to host
    # Internal network only

  frontend:
    ports:
      - "80:80"   # Only expose what's needed
      - "443:443"

  db:
    # NO PORTS EXPOSED
```

**5. Add Fail2ban for additional protection**
```bash
apt install fail2ban -y
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit jail.local
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600
```

**Detection:**
- From external machine: `nmap -p 1-65535 hetzner-server-ip`
- Check Docker iptables rules: `iptables -L DOCKER`
- Verify UFW status: `ufw status verbose`

**Sources:**
- [Hetzner Debian Docker Install with Firewall](https://community.hetzner.com/tutorials/debian-docker-install-dualstack-firewall/)
- [Setting up and hardening Hetzner server](https://danieltenner.com/setting-up-and-hardening-a-hetzner-server/)
- [Self-Hosting on Hetzner with Docker](https://www.tariqismail.com/posts/how-i-set-up-a-vps-on-hetzner-cloud-to-host-self-hosted-apps-with-docker-portainer)

**Confidence:** HIGH (Hetzner community tutorials + Docker official docs)

---

### Pitfall 12: No Health Checks on Docker Services

**What goes wrong:**
Docker Compose shows all containers as "running", but application is unresponsive. Database crashed but container is still up. Backend hung on startup but Docker reports "healthy".

**Why it happens:**
Default docker-compose has no health checks:
```yaml
services:
  backend:
    image: node:20
    # No healthcheck defined
```

Docker only checks "is process running?", not "is application responding?"

**Consequences:**
- False positive monitoring (container up, app down)
- Requests fail despite container showing "healthy"
- Restart policies don't trigger when app hangs

**Prevention:**

**1. Add health checks to all services**
```yaml
services:
  backend:
    image: node:20
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    image: nginx:alpine
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**2. Implement health check endpoint in backend**
```typescript
// backend/src/server.ts
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    res.send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).send({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

**3. Configure restart policy based on health**
```yaml
services:
  backend:
    restart: unless-stopped
    healthcheck:
      # ... as above
    depends_on:
      db:
        condition: service_healthy  # Wait for DB health
```

**Detection:**
- Run `docker compose ps` and check HEALTH column
- Manually trigger health check: `docker exec <container> curl http://localhost:3000/health`
- Simulate failure: stop Prisma connection, verify health check fails

**Sources:**
- [Docker Compose Healthcheck Reference](https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck)

**Confidence:** HIGH (official Docker docs)

---

### Pitfall 13: Cache Files Not in .gitignore

**What goes wrong:**
`toggl_cache.json` and `tempo_cache.json` are committed to git, exposing:
- Sensitive time entry data (project names, descriptions)
- API response structure (leaks implementation details)
- Personal work patterns (when you work, how long)

**Why it happens:**
Cache files created during development. Developer forgets to add to `.gitignore` before committing.

**Your current .gitignore status:**
According to git status, `tempo_cache.json` was tracked and only recently updated in `.gitignore` (commit 60d815b).

**Consequences:**
- Sensitive data in git history forever
- Cache conflicts when multiple developers/deployments
- Merge conflicts on every sync

**Prevention:**

**1. Ensure cache files in .gitignore**
```bash
# .gitignore
backend/toggl_cache.json
backend/tempo_cache.json
backend/*.cache.json
*.cache
```

**2. Remove from git history (if already committed)**
```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch backend/toggl_cache.json backend/tempo_cache.json' \
  --prune-empty --tag-name-filter cat -- --all
```

**3. Use environment-specific cache locations**
```typescript
const CACHE_FILE = process.env.CACHE_DIR
  ? path.join(process.env.CACHE_DIR, 'toggl_cache.json')
  : path.join(__dirname, '../../toggl_cache.json');
```

In production:
```yaml
services:
  backend:
    environment:
      - CACHE_DIR=/var/cache/timetracker
    volumes:
      - cache-data:/var/cache/timetracker

volumes:
  cache-data:
```

**Detection:**
- Run `git ls-files | grep cache`
- Check git history: `git log --all --full-history -- "*cache.json"`

**Confidence:** HIGH (git best practices)

---

### Pitfall 14: No Logging/Monitoring in Production

**What goes wrong:**
Application crashes in production. No logs available to diagnose. "It worked on my machine."

**Why it happens:**
Console.log works locally. In Docker, logs go to container stdout. Without proper log aggregation, they're lost when container restarts.

**Consequences:**
- No insight into production issues
- Can't debug sync failures
- No audit trail for data changes
- Performance problems invisible

**Prevention:**

**1. Use structured logging**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Replace console.log
logger.info({ source: 'TOGGL', count: entries.length }, 'Synced entries');
logger.error({ err, source: 'TEMPO' }, 'Sync failed');
```

**2. Configure Docker logging**
```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**3. Add log rotation**
```bash
# /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  }
}
```

**4. Monitor logs in production**
```bash
# View live logs
docker compose logs -f backend

# Save logs to file
docker compose logs backend > /var/log/timetracker-backend.log
```

**Detection:**
- Stop and start container, check if logs persist
- Trigger error, verify logged

**Confidence:** HIGH (Docker logging best practices)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Authentication Implementation** | Session fixation, no timeout, cookies in localStorage | Use fastify-session with secure config, regenerate session on login, HttpOnly cookies |
| **Docker Deployment** | Secrets in environment variables, exposed ports | Use Docker Secrets, internal networks only |
| **PostgreSQL Migration** | DateTime loses timezone, boolean 0/1 breaks | Use @db.Timestamptz(6), test with pgloader |
| **Multi-source Sync** | Race conditions in upsert, duplicate entries across sources | Add mutex locking or retry logic, implement duplicate detection |
| **API Integration** | Toggl rate limiting (30 req/hr), no backoff | Cache aggressively, implement exponential backoff, check rate limit headers |
| **Production Monitoring** | No health checks, logs lost on restart | Add health check endpoints, configure Docker logging driver |

---

## Quick Reference Checklist

Before deploying to production:

**Authentication:**
- [ ] Session validation on every protected route
- [ ] Session regeneration after login
- [ ] Secure cookie configuration (HttpOnly, Secure, SameSite)
- [ ] Idle and absolute timeout implemented
- [ ] Server-side session destruction on logout

**Docker:**
- [ ] Secrets in `/run/secrets/*`, not environment variables
- [ ] Database ports not exposed to host (no `ports:` in db service)
- [ ] Health checks configured for all services
- [ ] UFW/Hetzner firewall configured
- [ ] Only ports 22, 80, 443 open to public

**Database:**
- [ ] PostgreSQL uses TIMESTAMPTZ for datetime fields
- [ ] Prisma migration tested with real SQLite data
- [ ] Date range queries tested across DST boundaries
- [ ] Upsert collision handling implemented (retry or mutex)

**API Integration:**
- [ ] Rate limit headers monitored (x-toggl-quota-remaining)
- [ ] Exponential backoff for 429 responses
- [ ] Cache configured with reasonable TTL (1+ hours)
- [ ] Sync operations locked per source (no concurrent syncs)

**Data Quality:**
- [ ] Duplicate detection across sources implemented
- [ ] Timezone handling tested (DST transitions)
- [ ] Pagination added to entry lists
- [ ] Database indexes on `date` and `[source, externalId]`

**Observability:**
- [ ] Health check endpoint returns DB connectivity status
- [ ] Structured logging (pino or similar)
- [ ] Docker log rotation configured
- [ ] Cache files in .gitignore

---

## Additional Resources

**Official Documentation:**
- [Docker Compose Secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
- [Prisma PostgreSQL Guide](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Toggl API Rate Limits](https://support.toggl.com/api-webhook-limits)

**Community Resources:**
- [Prisma Upsert Race Condition Discussion](https://github.com/prisma/prisma/issues/3242)
- [Hetzner Docker Security Tutorial](https://community.hetzner.com/tutorials/debian-docker-install-dualstack-firewall/)
- [SQLite to PostgreSQL Migration Guide](https://render.com/articles/how-to-migrate-from-sqlite-to-postgresql)

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Authentication | HIGH | Based on OWASP official guidance + 2025 CVE examples |
| Docker Security | HIGH | Official Docker docs + Hetzner community tutorials |
| PostgreSQL Migration | HIGH | Prisma official docs + community migration guides |
| Race Conditions | HIGH | Confirmed Prisma GitHub issues with community workarounds |
| Timezone Handling | MEDIUM | General best practices, not time-tracking specific |
| Duplicate Detection | MEDIUM | Data reconciliation patterns, not time-tracking specific |
| API Rate Limiting | HIGH | Official Toggl support docs (September 2025) |
| UUID/ID Generation | MEDIUM | Standards exist (UUID v7), but overkill for single-user app |

---

## Research Notes

**Sources Used:**
- Official Docker documentation (compose, secrets, networking)
- OWASP Security Cheat Sheets (session management, authentication)
- Prisma ORM documentation (migrations, upsert behavior)
- GitHub issues (Prisma race conditions, datetime bugs)
- Toggl official support articles (2025 rate limit announcement)
- Hetzner community tutorials (firewall, Docker deployment)
- PostgreSQL migration guides (SQLite type conversions)
- Time tracking domain articles (timezone handling, DST edge cases)

**What Wasn't Found:**
- Tempo API rate limiting documentation (only Toggl found)
- Specific time-tracking duplicate detection algorithms
- Production deployment guides for Fastify + Prisma + Docker + Hetzner (combined stack)

**Recommended Phase-Specific Research:**
- Phase 2 (Authentication): Deep dive into fastify-session vs fastify-secure-session
- Phase 3 (PostgreSQL): Load testing with production data volume
- Phase 4 (Docker): Hetzner-specific networking configuration
- Phase 5 (Duplicate Detection): Interview users about which source is "canonical"
