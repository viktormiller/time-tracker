# Phase 3: Data Quality & PostgreSQL Migration - Research

**Researched:** 2026-01-21
**Domain:** Database migration, UUID generation, timezone handling, Jira API integration
**Confidence:** HIGH

## Summary

This phase migrates from SQLite to PostgreSQL with timezone-aware timestamps (TIMESTAMPTZ) and collision-resistant UUIDs. PostgreSQL is already configured in the current Prisma schema, but the application currently runs on SQLite in development. The migration path is well-established with mature tooling (pgloader) and Prisma's native migration support.

**Key findings:**
- Prisma already configured for PostgreSQL with UUID support - minimal schema changes needed
- pgloader is the standard tool for SQLite to PostgreSQL migration with automatic type conversion
- UUID v7 is not needed - standard UUID v4 from Prisma or PostgreSQL's gen_random_uuid() both provide sufficient collision resistance
- TIMESTAMPTZ in PostgreSQL stores UTC internally and handles timezone conversion automatically
- Tempo API v4 requires issueId (integer) in requests, but returns issue.key in responses for display
- Prisma upsert has race condition issues resolved in v4.6.0+ with native database upsert commands

**Primary recommendation:** Use maintenance window migration strategy with pgloader for data transfer, PostgreSQL's native gen_random_uuid() for database-level UUID generation, and Prisma's native upsert (v4.6.0+) for duplicate handling.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma ORM | 5.19.1+ | Database migrations & queries | Industry standard ORM with first-class PostgreSQL support, native migration tools |
| PostgreSQL | 17-alpine | Production database | Most popular open-source RDBMS, excellent timezone support, ACID compliant |
| pgloader | 3.6.0+ | SQLite to PostgreSQL migration | Purpose-built migration tool, automatic type conversion, handles edge cases |
| uuid package | 11.0+ | UUID generation (if needed) | Standard UUID library, supports v4, maintained by uuidjs org |
| date-fns | 3.6.0 (already installed) | Timezone-aware date formatting | Modern, immutable, tree-shakeable, first-class timezone support in v4.0+ |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-timezone-select | 3.2+ | Timezone picker component | User timezone preference selection, auto-detects browser timezone |
| pg (node-postgres) | Latest | PostgreSQL driver | Connection pooling configuration, direct database access if needed |
| axios | 1.13.2 (installed) | Tempo API HTTP client | Already in use for Tempo API integration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| UUID v4 | UUID v7 | v7 offers time-ordering for B-tree performance, but adds complexity. v4 sufficient for this scale |
| pgloader | Manual SQL dump/restore | pgloader handles type conversion automatically, manual approach error-prone |
| PostgreSQL gen_random_uuid() | Prisma uuid() | Database-level generation ensures consistency across all database clients, Prisma-level only works via Prisma Client |
| date-fns | Luxon or Day.js | date-fns already installed, sufficient for needs, smaller bundle size |

**Installation:**
```bash
# No new backend dependencies needed - Prisma and date-fns already installed
cd backend
npm install  # Existing dependencies sufficient

# Frontend timezone selector
cd frontend
npm install react-timezone-select

# System-level tool (install on server/Docker image)
# For macOS/Linux:
brew install pgloader  # macOS
apt-get install pgloader  # Debian/Ubuntu
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── prisma/
│   ├── schema.prisma           # Already has PostgreSQL config
│   └── migrations/             # Prisma migration history
├── scripts/
│   ├── migrate-sqlite-to-pg.sh # pgloader migration script
│   └── validate-migration.ts   # Post-migration validation
├── src/
│   ├── services/
│   │   ├── tempo.service.ts    # Update for issue key caching
│   │   └── jira-cache.service.ts  # NEW: Issue key resolution cache
│   └── types/
│       └── time-entry.types.ts # Add timezone-aware types
frontend/
├── src/
│   ├── components/
│   │   ├── TimezoneSelector.tsx   # NEW: User timezone preference
│   │   └── RelativeTimestamp.tsx  # NEW: Relative time display
│   └── utils/
│       └── timezone.utils.ts      # Timezone conversion helpers
```

### Pattern 1: Database-Level UUID Generation
**What:** Use PostgreSQL's native gen_random_uuid() instead of Prisma's uuid()
**When to use:** Production environments where data consistency across multiple clients is critical
**Why:** Database-level generation ensures UUIDs are generated regardless of how records are created (Prisma, direct SQL, bulk imports)

**Example:**
```prisma
// Source: https://www.prisma.io/docs/orm/prisma-schema/data-model/unsupported-database-features
model TimeEntry {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  source      String
  externalId  String?
  // ... rest of fields
}
```

**Note:** PostgreSQL 14+ has gen_random_uuid() built-in. For PostgreSQL 12-13, enable pgcrypto extension first:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Pattern 2: TIMESTAMPTZ for Timezone-Aware Timestamps
**What:** Use @db.Timestamptz for DateTime fields that need timezone information
**When to use:** Any timestamp that represents a specific moment in time (work entries, creation times)
**Why:** Stores UTC internally, automatically converts to/from client timezone, prevents timezone confusion

**Example:**
```prisma
// Source: https://wanago.io/2023/05/15/api-nestjs-prisma-date-timezones-postgresql/
model TimeEntry {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  date        DateTime @db.Timestamptz(6)  // 6 = microsecond precision
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  // ... rest of fields
}
```

**Behavior:**
- PostgreSQL stores all TIMESTAMPTZ values as UTC internally
- node-postgres automatically converts between JavaScript Date objects and TIMESTAMPTZ
- JavaScript Date objects represent moments in time (already timezone-aware)
- Display formatting handles timezone conversion (not storage)

### Pattern 3: Prisma Native Upsert for Race Condition Safety
**What:** Use Prisma's upsert which leverages native database ON CONFLICT since v4.6.0
**When to use:** Sync operations that may receive duplicate external IDs concurrently
**Why:** Prevents unique constraint violations from race conditions during parallel sync operations

**Example:**
```typescript
// Source: Current codebase tempo.service.ts with improvements
await this.prisma.timeEntry.upsert({
  where: {
    source_externalId: {
      source: 'TEMPO',
      externalId: entry.tempoWorklogId.toString()
    }
  },
  update: {
    duration: durationHours,
    description: description,
    project: issueKey,
    date: new Date(entry.startDate)  // Converted to UTC by node-postgres
  },
  create: {
    // id is auto-generated by PostgreSQL gen_random_uuid()
    source: 'TEMPO',
    externalId: entry.tempoWorklogId.toString(),
    date: new Date(entry.startDate),
    duration: durationHours,
    project: issueKey,
    description: description
  }
});
```

**Key insight:** Prisma v4.6.0+ translates upsert to PostgreSQL's native `INSERT ... ON CONFLICT DO UPDATE`, which is atomic at the database level. Current project uses Prisma 5.19.1, so this is already supported.

### Pattern 4: Relative Time Display with Auto-Switching
**What:** Display recent timestamps as relative ("2 hours ago"), switch to absolute after 24 hours
**When to use:** User-facing timestamp displays in tables or lists
**Why:** Improves UX for recent items while providing precision for older entries

**Example:**
```typescript
// Source: https://date-fns.org/
import { formatDistanceToNow, format, isAfter, subDays } from 'date-fns';

function formatTimestamp(date: Date, userTimezone: string): string {
  const now = new Date();
  const oneDayAgo = subDays(now, 1);

  if (isAfter(date, oneDayAgo)) {
    // Recent: "2 hours ago"
    return formatDistanceToNow(date, { addSuffix: true });
  } else {
    // Older: "Jan 20, 2:30 PM" (formatted in user's timezone)
    return format(date, 'MMM dd, h:mm a');
  }
}
```

**Note:** JavaScript Date objects are timezone-agnostic (represent UTC moments). Display formatting applies the user's selected timezone preference.

### Pattern 5: Issue Key Caching for Tempo Integration
**What:** Cache Jira issue key mappings to reduce API calls during sync operations
**When to use:** Tempo API sync operations where issue keys need resolution
**Why:** Tempo API v4 responses include issue.key, but caching prevents re-fetching for repeat occurrences

**Example:**
```typescript
// NEW: Issue key cache service
interface IssueKeyCache {
  issueId: number;
  issueKey: string;
  projectKey: string;
  cachedAt: Date;
}

class JiraCacheService {
  async getOrFetchIssueKey(
    issueId: number,
    issueData?: { key?: string }
  ): Promise<string> {
    // Check cache first
    const cached = await this.prisma.issueKeyCache.findUnique({
      where: { issueId }
    });

    if (cached) {
      return cached.issueKey;
    }

    // Use data from Tempo API response if available
    if (issueData?.key) {
      await this.prisma.issueKeyCache.create({
        data: {
          issueId,
          issueKey: issueData.key,
          cachedAt: new Date()
        }
      });
      return issueData.key;
    }

    // Fallback to ID if key missing
    return `Issue #${issueId}`;
  }
}
```

**Key insight:** Tempo API v4 responses already include `entry.issue.key` in the worklog data (see tempo.service.ts line 100). No additional API calls needed - just cache the mapping for future reference.

### Anti-Patterns to Avoid

- **Don't use timestamp without timezone:** Always use TIMESTAMPTZ, never plain TIMESTAMP for work entries
- **Don't generate UUIDs at application level for bulk imports:** Use database-level generation to ensure consistency across all insertion methods
- **Don't perform database migrations during Docker build:** Run `prisma migrate deploy` in container entrypoint, not Dockerfile RUN command
- **Don't use Prisma's uuid() for new UUID generation:** Use PostgreSQL's gen_random_uuid() for database-level consistency
- **Don't manually handle timezone conversion in backend:** Let PostgreSQL and node-postgres handle UTC conversion automatically

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite to PostgreSQL migration | Custom SQL dump/restore scripts | pgloader | Handles type mapping (datetime→timestamptz, boolean differences), auto-fixes common issues, battle-tested |
| UUID generation | Custom ID generation logic | PostgreSQL gen_random_uuid() | Cryptographically secure, collision-resistant (2^37 operations for 50% collision), database-native |
| Timezone conversion | Manual UTC offset calculation | PostgreSQL TIMESTAMPTZ + node-postgres | Automatic UTC storage/conversion, handles DST, microsecond precision |
| Relative time formatting | Custom time-ago logic | date-fns formatDistanceToNow | Handles edge cases (singular/plural, units), i18n support, maintained |
| Timezone picker UI | Custom select component | react-timezone-select | DST-aware, auto-detects browser timezone, streamlined list (~24 choices), accessible |
| Database connection pooling | Manual connection management | Prisma connection pool + PgBouncer | Handles connection limits, prevents exhaustion, automatic retry logic |

**Key insight:** Migration and timezone handling have many edge cases (DST transitions, leap seconds, type mismatches, encoding issues). Use mature tools that have handled these issues for years.

## Common Pitfalls

### Pitfall 1: Prisma Migration Timing in Docker
**What goes wrong:** Running `prisma migrate deploy` during Docker image build causes migration to run against the wrong database or fail when database isn't available
**Why it happens:** Build-time environment doesn't have access to runtime database connection
**How to avoid:** Run migrations in container entrypoint script before starting the application
**Warning signs:** Migration errors during `docker build`, or migrations applied to wrong database
**Solution:**
```dockerfile
# docker/backend/Dockerfile
# ✅ CORRECT: Run migrations at container startup
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]

# ❌ WRONG: Run migrations at build time
# RUN npx prisma migrate deploy  # DON'T DO THIS
```

### Pitfall 2: SQLite Boolean vs PostgreSQL Boolean
**What goes wrong:** SQLite stores booleans as integers (0/1), PostgreSQL uses native boolean type - direct data copy fails
**Why it happens:** Different type systems between databases
**How to avoid:** Use pgloader which automatically converts SQLite integers to PostgreSQL booleans based on schema
**Warning signs:** Boolean fields showing as 0/1 in PostgreSQL, or type mismatch errors
**Solution:** pgloader handles this automatically with proper column definitions in Prisma schema

### Pitfall 3: UUID Type Mismatch in Queries
**What goes wrong:** Queries fail with type errors like "expected Uuid, got String" when using UUIDs
**Why it happens:** PostgreSQL has native UUID type, but Prisma String type doesn't match
**How to avoid:** Use `@db.Uuid` annotation in Prisma schema for UUID columns
**Warning signs:** Query errors mentioning UUID type mismatch
**Solution:**
```prisma
// ✅ CORRECT
id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid

// ❌ WRONG (causes type mismatch)
id String @id @default(dbgenerated("gen_random_uuid()"))
```

### Pitfall 4: Concurrent Upsert Race Conditions
**What goes wrong:** Multiple concurrent sync operations create duplicate entries despite unique constraints
**Why it happens:** Classic time-of-check-to-time-of-use race condition - two operations both check for existence, find nothing, both try to insert
**How to avoid:** Use Prisma 4.6.0+ which uses native database ON CONFLICT, or wrap operations in try-catch with retry logic
**Warning signs:** Unique constraint violation errors (P2002) during parallel sync operations
**Solution:**
```typescript
// Prisma 4.6.0+ handles this automatically with native upsert
// For additional safety, wrap in try-catch:
try {
  await this.prisma.timeEntry.upsert({ /* ... */ });
} catch (error) {
  if (error.code === 'P2002') {
    // Unique constraint violation - another operation won the race
    console.log('Entry already exists, skipping');
  } else {
    throw error;
  }
}
```

### Pitfall 5: Missing pgcrypto Extension (PostgreSQL 12-13)
**What goes wrong:** gen_random_uuid() function not found when using PostgreSQL 12 or 13
**Why it happens:** gen_random_uuid() is only built-in from PostgreSQL 14+, earlier versions need pgcrypto extension
**How to avoid:** Check PostgreSQL version, enable pgcrypto extension in migration if using 12-13
**Warning signs:** "function gen_random_uuid() does not exist" error
**Solution:**
```sql
-- Add to first migration if using PostgreSQL 12-13
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PostgreSQL 14+ (current setup uses 17-alpine) doesn't need this
```

### Pitfall 6: Timezone Display Confusion
**What goes wrong:** Users see unexpected times because JavaScript Date is formatted in server timezone, not user timezone
**Why it happens:** Date objects represent moments in UTC, but display formatting applies local timezone
**How to avoid:** Store user timezone preference, apply it during display formatting only
**Warning signs:** Users report times being "off by X hours"
**Solution:**
```typescript
// ✅ CORRECT: Format in user's timezone
const userTimezone = getUserTimezonePreference(); // e.g., "America/New_York"
const formatted = format(date, 'PPpp', {
  timeZone: userTimezone  // date-fns v4 supports this
});

// ❌ WRONG: Uses server/browser timezone
const formatted = format(date, 'PPpp');
```

### Pitfall 7: Prisma Schema datasource provider Mismatch
**What goes wrong:** Development works but production fails because schema.prisma has wrong provider
**Why it happens:** Schema configured for one database but connection string points to another
**How to avoid:** Current schema already uses "postgresql" - ensure DATABASE_URL environment variable points to PostgreSQL in all environments
**Warning signs:** "Database type not supported" errors, features working locally but failing in Docker
**Solution:**
```prisma
// ✅ CORRECT: Already configured this way
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Ensure DATABASE_URL is PostgreSQL format:
// postgresql://user:password@host:5432/dbname
```

## Code Examples

Verified patterns from official sources:

### pgloader Migration Command
```bash
# Source: https://pgloader.readthedocs.io/en/latest/ref/sqlite.html
# Basic migration - pgloader handles type conversion automatically
pgloader sqlite:///path/to/dev.db postgresql://user:password@host/dbname

# With options file for more control (recommended)
# Create file: migrate.load
cat > migrate.load << 'EOF'
LOAD DATABASE
  FROM sqlite:///path/to/backend/dev.db
  INTO postgresql://timetracker:password@localhost/timetracker

WITH include drop, create tables, create indexes, reset sequences,
     encoding 'utf-8'

CAST type integer when (= precision 1) to boolean drop typemod;

EOF

# Run migration
pgloader migrate.load
```

### Prisma Schema for Production
```prisma
// Source: Current schema.prisma with recommended updates
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-arm64-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model TimeEntry {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  source      String
  externalId  String?
  date        DateTime @db.Timestamptz(6)
  duration    Float
  project     String?
  description String?
  createdAt   DateTime @default(now()) @db.Timestamptz(6)

  @@unique([source, externalId])
  @@index([date])
}

// NEW: Issue key cache table
model IssueKeyCache {
  issueId    Int      @id
  issueKey   String
  projectKey String?
  cachedAt   DateTime @default(now()) @db.Timestamptz(6)
}
```

### Migration Validation Script
```typescript
// scripts/validate-migration.ts
import { PrismaClient } from '@prisma/client';

async function validateMigration() {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL }
    }
  });

  try {
    // 1. Check row counts
    const totalEntries = await prisma.timeEntry.count();
    console.log(`Total entries in PostgreSQL: ${totalEntries}`);

    // 2. Check for null IDs (should be none with UUID generation)
    const nullIds = await prisma.timeEntry.count({
      where: { id: null }
    });
    console.log(`Entries with null IDs: ${nullIds}`);

    // 3. Verify unique constraint works
    const duplicateCheck = await prisma.$queryRaw`
      SELECT source, "externalId", COUNT(*) as count
      FROM "TimeEntry"
      WHERE "externalId" IS NOT NULL
      GROUP BY source, "externalId"
      HAVING COUNT(*) > 1
    `;
    console.log(`Duplicate entries: ${duplicateCheck.length}`);

    // 4. Sample data check
    const sample = await prisma.timeEntry.findFirst({
      orderBy: { date: 'desc' }
    });
    console.log(`Latest entry:`, sample);

    console.log('✅ Migration validation complete');
  } finally {
    await prisma.$disconnect();
  }
}

validateMigration().catch(console.error);
```

### Timezone Selector Component
```typescript
// Source: https://github.com/ndom91/react-timezone-select
import React from 'react';
import TimezoneSelect from 'react-timezone-select';

interface Props {
  value: string;
  onChange: (timezone: string) => void;
}

export function TimezoneSelector({ value, onChange }: Props) {
  return (
    <TimezoneSelect
      value={value}
      onChange={(tz) => onChange(tz.value)}
      // Auto-detects browser timezone on first load
    />
  );
}

// Usage in settings page
function SettingsPage() {
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  return (
    <div>
      <label>Your Timezone</label>
      <TimezoneSelector
        value={timezone}
        onChange={setTimezone}
      />
    </div>
  );
}
```

### Relative Timestamp Display
```typescript
// Source: https://date-fns.org/
import { formatDistanceToNow, format, isAfter, subDays } from 'date-fns';

interface Props {
  date: Date;
  userTimezone?: string;  // For future enhancement
}

export function RelativeTimestamp({ date }: Props) {
  const [displayTime, setDisplayTime] = useState('');

  useEffect(() => {
    function updateDisplay() {
      const now = new Date();
      const oneDayAgo = subDays(now, 1);

      if (isAfter(date, oneDayAgo)) {
        // Recent: "2 hours ago"
        setDisplayTime(formatDistanceToNow(date, { addSuffix: true }));
      } else {
        // Older: "Jan 20, 2:30 PM"
        setDisplayTime(format(date, 'MMM dd, h:mm a'));
      }
    }

    updateDisplay();

    // Update every minute for recent timestamps
    const interval = setInterval(updateDisplay, 60000);
    return () => clearInterval(interval);
  }, [date]);

  return <time dateTime={date.toISOString()}>{displayTime}</time>;
}
```

### Issue Key Display with Link
```typescript
// Updated tempo.service.ts pattern
interface TempoEntry {
  tempoWorklogId: number;
  timeSpentSeconds: number;
  startDate: string;
  issue: {
    id: number;
    key?: string;  // May be present
  };
  description?: string;
}

// In sync operation
const issueKey = entry.issue?.key || `Issue #${entry.issue.id}`;
const issueUrl = entry.issue?.key
  ? `${process.env.JIRA_BASE_URL}/browse/${entry.issue.key}`
  : null;

// Frontend display component
interface ProjectCellProps {
  projectKey: string;
  issueUrl?: string;
}

function ProjectCell({ projectKey, issueUrl }: ProjectCellProps) {
  if (issueUrl) {
    return (
      <a
        href={issueUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        {projectKey}
      </a>
    );
  }
  return <span>{projectKey}</span>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UUID v4 only | UUID v7 emerging | 2023-2024 | v7 offers time-ordering for better B-tree index performance, but v4 remains sufficient for most applications |
| Prisma uuid() | PostgreSQL gen_random_uuid() | Prisma 2.0+ | Database-level generation ensures consistency across all clients, not just Prisma |
| TIMESTAMP | TIMESTAMPTZ | PostgreSQL 7.2+ (2002) | Industry standard for timezone-aware timestamps, but still commonly misconfigured |
| Manual timezone handling | date-fns v4 native timezone support | 2024 | First-class timezone support, eliminates moment-timezone dependency |
| SQLite for production | PostgreSQL for production | Ongoing | SQLite fine for dev, but PostgreSQL offers better concurrency, timezone support, and production features |
| Tempo API v3 | Tempo API v4 | 2023 | v4 requires issueId (not issueKey) in requests, but returns full issue objects in responses |

**Deprecated/outdated:**
- **Moment.js**: Deprecated since 2020, replaced by date-fns or Luxon
- **SQLite for production time-tracking**: Lacks timezone support and full ACID guarantees under concurrent writes
- **Prisma uuid() for production**: Use database-level generation for consistency across all insertion methods
- **Tempo API v3**: Use v4 endpoints (current code already uses v4)

## Open Questions

Things that couldn't be fully resolved:

1. **Tempo API Pagination**
   - What we know: Current code sets limit=1000 for Tempo API, acknowledges pagination exists
   - What's unclear: Whether 1000 entries per sync is sufficient for production workloads, or if pagination should be implemented
   - Recommendation: Start with current approach, monitor for "results truncated" warning in API responses, implement pagination if needed

2. **Connection Pool Sizing**
   - What we know: Prisma v7 changes connection pool defaults, formula is (num_cpus * 2 + 1) / num_instances
   - What's unclear: Exact CPU count and instance count for production deployment
   - Recommendation: Start with Prisma defaults (10 connections), monitor connection exhaustion errors, tune based on actual load

3. **Migration Downtime Window**
   - What we know: Maintenance window approach is simplest and safest
   - What's unclear: How long the application can be down for migration (depends on data volume)
   - Recommendation: Test migration locally to estimate duration, plan downtime window accordingly (likely < 5 minutes for current data volume)

4. **Jira Base URL Configuration**
   - What we know: Need Jira base URL to make issue keys clickable
   - What's unclear: Should this be environment variable, user setting, or both?
   - Recommendation: Start with environment variable (JIRA_BASE_URL), add per-user override later if needed for organizations with multiple Jira instances

## Sources

### Primary (HIGH confidence)
- [Prisma PostgreSQL TIMESTAMPTZ Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/unsupported-database-features) - Database-level UUID generation
- [pgloader SQLite to PostgreSQL Documentation](https://pgloader.readthedocs.io/en/latest/ref/sqlite.html) - Migration tool and type mappings
- [PostgreSQL Date/Time Types Documentation](https://www.postgresql.org/docs/current/datatype-datetime.html) - TIMESTAMPTZ behavior and storage
- [Prisma Connection Pooling Documentation](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool) - Production pool configuration
- [date-fns Documentation](https://date-fns.org/) - Date formatting and relative time functions
- [react-timezone-select GitHub](https://github.com/ndom91/react-timezone-select) - Timezone picker component

### Secondary (MEDIUM confidence)
- [How to Fix Prisma DateTime and Timezone Issues with PostgreSQL](https://medium.com/@basem.deiaa/how-to-fix-prisma-datetime-and-timezone-issues-with-postgresql-1c778aa2d122) - Practical PostgreSQL timezone guidance
- [API with NestJS: Date and time with Prisma and PostgreSQL](https://wanago.io/2023/05/15/api-nestjs-prisma-date-timezones-postgresql/) - TIMESTAMPTZ implementation patterns
- [Prisma Migrate: Deploy Migration with Docker](https://notiz.dev/blog/prisma-migrate-deploy-with-docker/) - Docker migration timing patterns
- [7 Node + Prisma Connection Pool Rules at Scale](https://medium.com/@1nick1patel1/7-node-prisma-connection-pool-rules-at-scale-f9054cdfaff7) - Production connection pool sizing
- [Understanding UUIDs in Node.js](https://blog.logrocket.com/uuids-node-js/) - UUID collision resistance and versions
- [How to migrate from SQLite to PostgreSQL](https://render.com/articles/how-to-migrate-from-sqlite-to-postgresql) - Migration validation checklist

### Secondary (MEDIUM confidence) - Tempo API
- [Tempo API Documentation](https://apidocs.tempo.io/) - Official API documentation portal
- [Tempo REST API v4 vs v3 Comparison](https://tempo-io.atlassian.net/wiki/spaces/HCTIMESHEETS/pages/3374321623/Tempo+API+version+4.0+vs.+version+3.0+A+comparison) - API version differences
- [Worklog REST APIs for Jira Cloud](https://help.tempo.io/cloudmigration/latest/worklog-rest-apis-for-jira-cloud) - Cloud API guidance

### Tertiary (LOW confidence)
- [Prisma upsert race condition issue #3242](https://github.com/prisma/prisma/issues/3242) - Historical context on race conditions
- [UUID v7 Guide](https://dev.to/babynamenestlings_efe5ba9/exploring-uuid-v7-a-programmers-guide-to-efficient-and-time-ordered-identifiers-4d2b) - UUID v7 benefits (not needed for this project)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Prisma, PostgreSQL, pgloader are industry standards with excellent documentation
- Architecture: HIGH - Patterns verified with official documentation and current codebase analysis
- Pitfalls: HIGH - Common issues documented in GitHub issues and migration guides
- Tempo API integration: MEDIUM - API documentation confirmed v4 behavior, but issue key resolution pattern inferred from current code
- Migration validation: MEDIUM - Validation approaches from community best practices, not official Prisma documentation

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable domain, slow-moving changes)

**Key constraints from CONTEXT.md honored:**
- ✅ UUIDs for synthetic IDs (locked decision)
- ✅ Maintenance window migration strategy (locked decision)
- ✅ Strict duplicate detection on source + source ID (locked decision)
- ✅ Fail on collision with error details (locked decision)
- ✅ User-configurable timezone with browser default (locked decision)
- ✅ Relative time display with 24-hour switch threshold (locked decision)
- ✅ Issue key display format with clickable links (locked decision)

**Claude's discretion areas addressed:**
- Migration validation: Recommend count verification + sample data check + duplicate detection
- Migration trigger: Recommend manual script approach for first migration, automated on startup for subsequent deploys
- Error message format: Include source, externalId, and operation details in collision errors
- Timezone selector UI: Recommend react-timezone-select with browser auto-detection
- Relative timestamp update: Recommend 60-second interval for live updates
- Jira base URL config: Recommend environment variable with future per-user override option
