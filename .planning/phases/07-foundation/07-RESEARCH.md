# Phase 7: Foundation - Research

**Researched:** 2026-02-06
**Domain:** Utility meter tracking data model, CRUD, navigation integration (React + Fastify + Prisma + PostgreSQL)
**Confidence:** HIGH

## Summary

This phase adds a new "Utilities" domain to an existing time-tracking application. The codebase already has established patterns for everything needed: Prisma ORM with PostgreSQL, Fastify route plugins with Zod validation, React state-based view switching, Tailwind CSS dark mode, and JWT authentication. The primary research focused on: (1) Prisma schema design for meters and readings, (2) database-level monotonic validation, (3) soft delete implementation, (4) file upload for meter photos, (5) on-demand consumption calculation, and (6) frontend navigation integration.

The key technical finding is that PostgreSQL CHECK constraints CANNOT enforce monotonic validation across rows (they only validate within a single row). The correct approach is a BEFORE INSERT/UPDATE trigger function, or application-level validation in the Fastify route handler. The recommendation is to use both: application-level validation (primary, with good error messages) plus a database trigger (safety net).

The existing codebase has no client-side router (no react-router) -- it uses `useState` for view switching (`currentView`). Adding a full router for one new section would be over-engineering. Extend the existing pattern by adding `'utilities'` to the currentView union type.

**Primary recommendation:** Follow existing codebase patterns exactly. Add Prisma models for Meter and MeterReading, create a Fastify route plugin at `/api/utilities/`, add application-level monotonic validation with a database trigger backup, and extend the frontend's state-based navigation with a Utilities page component.

## Standard Stack

The established libraries/tools for this domain -- ALL already in the project:

### Core
| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| @prisma/client | 5.22.0 | ORM for PostgreSQL | Already used for all data access |
| prisma | 5.19.1 (dev) | Schema/migration tooling | Already manages all DB migrations |
| fastify | 4.29.1 | HTTP server framework | Already the backend framework |
| zod | 4.3.5 | Request validation | Already used for all schema validation |
| react | 19.2.0 | UI framework | Already the frontend framework |
| tailwindcss | 3.4.17 | CSS styling | Already used for all styling |
| axios | 1.13.2 | HTTP client | Already used for all API calls |
| lucide-react | 0.555.0 | Icons | Already provides all icons |

### Supporting (NEW - needed for this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/static | ^8.x | Serve uploaded meter photos | Serving files from /uploads/meter-photos/ |

### Already Available (no new installs needed except @fastify/static)
| Library | Purpose | How Used in Phase 7 |
|---------|---------|---------------------|
| @fastify/multipart | File upload handling | Already registered -- handle meter photo uploads |
| date-fns | Date formatting/manipulation | Format reading dates, sort by date |
| react-hook-form + @hookform/resolvers | Form handling | Meter creation form, reading entry modal |
| clsx + tailwind-merge | Conditional class names | Tab styling, active states |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| State-based views | react-router-dom | Would add routing library for one new section; overkill given existing pattern works |
| Application-level validation | Database triggers only | Triggers give cryptic errors; app-level gives user-friendly messages |
| @fastify/static | Manual fs.createReadStream | @fastify/static handles caching, ETags, content-type automatically |

**Installation (only new dependency):**
```bash
cd backend
npm install @fastify/static
```

## Architecture Patterns

### Recommended Project Structure

New files for this phase (parallel domain separation):

```
backend/
  src/
    routes/
      utility.routes.ts          # All utility API endpoints (CRUD meters + readings)
    schemas/
      utility.schema.ts          # Zod schemas for meter and reading validation
  prisma/
    schema.prisma                # Add Meter + MeterReading models
    migrations/
      YYYYMMDD_add_utility_meters/  # New migration

frontend/
  src/
    pages/
      Utilities.tsx              # Main utilities page (meter tabs, readings table)
    components/
      utilities/
        MeterForm.tsx            # Create/edit meter modal form
        ReadingForm.tsx          # Add/edit reading modal form
        ReadingsTable.tsx        # Sortable readings table with consumption
        MeterTabs.tsx            # Strom | Gas | Wasser Warm tab navigation
        EmptyState.tsx           # Empty state illustration + CTA
```

### Pattern 1: Parallel Domain Separation (LOCKED DECISION)
**What:** Utility tracking shares infrastructure (auth, theme, navigation, database) but has completely separate business logic from time tracking.
**When to use:** Adding a new domain to an existing app.
**Implementation:**
- Separate Prisma models (Meter, MeterReading) -- no foreign keys to TimeEntry
- Separate route file (utility.routes.ts) -- registered in the same protected scope
- Separate frontend page component (Utilities.tsx) -- rendered by the same App shell
- Shared: AuthProvider, ThemeProvider, ToastProvider, navigation header

### Pattern 2: Fastify Route Plugin (existing pattern)
**What:** Encapsulate related routes in an async function registered as a Fastify plugin.
**When to use:** All new route groups.
**Example:**
```typescript
// Source: existing codebase pattern from estimate.routes.ts
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function utilityRoutes(fastify: FastifyInstance) {
  // GET /api/utilities/meters
  fastify.get('/utilities/meters', async (request, reply) => {
    const meters = await prisma.meter.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return meters;
  });

  // POST /api/utilities/meters
  fastify.post('/utilities/meters', async (request, reply) => {
    const data = createMeterSchema.parse(request.body);
    const meter = await prisma.meter.create({ data });
    reply.status(201).send(meter);
  });

  // ... other routes
}
```

### Pattern 3: State-Based View Navigation (existing pattern)
**What:** Use React useState to switch between views, no client-side router.
**When to use:** The current app already uses this pattern.
**Example:**
```typescript
// Source: existing codebase pattern from App.tsx line 115
const [currentView, setCurrentView] = useState<
  'dashboard' | 'add-entry' | 'settings' | 'estimates' | 'utilities'
>('dashboard');

// Render utilities page if selected (follows existing pattern at lines 424-450)
if (currentView === 'utilities') {
  return (
    <Utilities onBack={() => setCurrentView('dashboard')} />
  );
}
```

### Pattern 4: On-Demand Consumption Calculation (LOCKED DECISION)
**What:** Calculate consumption deltas at query time, not stored in database.
**When to use:** When data integrity is more important than query performance.
**Example:**
```typescript
// Backend: query readings ordered by date, calculate deltas
const readings = await prisma.meterReading.findMany({
  where: { meterId },
  orderBy: { readingDate: 'asc' },
});

const readingsWithConsumption = readings.map((reading, index) => ({
  ...reading,
  consumption: index === 0
    ? null  // First reading = baseline, no consumption to calculate
    : reading.value - readings[index - 1].value,
}));
```

### Pattern 5: Zod Schema Validation (existing pattern)
**What:** Define request validation schemas with Zod, use .parse() in route handlers.
**When to use:** All API endpoints that accept request bodies.
**Example:**
```typescript
// Source: existing pattern from schemas/estimate.schema.ts
import { z } from 'zod';

export const createMeterSchema = z.object({
  type: z.enum(['STROM', 'GAS', 'WASSER_WARM']),
  name: z.string().min(1, 'Meter name is required'),
  unit: z.string().min(1, 'Unit is required'),
  location: z.string().optional(),
});

export const createReadingSchema = z.object({
  meterId: z.string().uuid(),
  readingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  value: z.number().nonnegative('Reading value must be non-negative'),
});
```

### Anti-Patterns to Avoid
- **Storing computed consumption:** Violates the locked decision. Consumption must be calculated on-demand from consecutive readings.
- **Hard deleting meters:** Meters must be soft-deleted (archived) to preserve reading history.
- **Putting utility logic in App.tsx:** The App.tsx is already 1000+ lines. All utility UI must be in separate page/component files.
- **Creating separate PrismaClient instances per route file:** The existing codebase creates `new PrismaClient()` at module level in each route file. This works but ideally should be shared. Follow existing pattern for consistency.
- **Using react-router for just this addition:** The app has no router. Adding one would require refactoring all existing views. Not worth it for Phase 7.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload handling | Custom multipart parser | @fastify/multipart (already installed) | Handles streams, size limits, content types |
| Serving uploaded photos | Manual fs.readFile + response | @fastify/static | Handles caching, ETags, content-type, range requests |
| Form state management | Manual useState for each field | react-hook-form (already installed) | Handles validation, dirty state, error messages |
| Date formatting | Custom date string manipulation | date-fns (already installed) | Handles locales, edge cases, timezone awareness |
| UUID generation | Custom ID functions | Prisma @default(dbgenerated("gen_random_uuid()")) | Database-level uniqueness, no collision risk |
| Toast notifications | Custom notification system | useToast hook (already exists) | Already built and integrated |
| Schema validation | Manual if/else chains | Zod schemas (already used) | Type inference, composable, consistent error format |

**Key insight:** This phase should add ZERO new dependencies to the frontend. The only new backend dependency is @fastify/static for serving uploaded meter photos. Everything else already exists in the project.

## Common Pitfalls

### Pitfall 1: CHECK Constraint for Cross-Row Validation
**What goes wrong:** Attempting to use a PostgreSQL CHECK constraint to enforce that meter readings are monotonically increasing (new value >= previous value).
**Why it happens:** CHECK constraints can ONLY validate within a single row. They cannot reference other rows in the table. PostgreSQL docs explicitly state: "a check constraint that violates this rule may appear to work in simple tests, it cannot guarantee that the database will not reach a state in which the constraint condition is false."
**How to avoid:** Use application-level validation as the primary enforcement (check previous reading value before INSERT/UPDATE), backed by a database BEFORE INSERT trigger as a safety net.
**Warning signs:** If you write `CHECK (value >= ...)` referencing a subquery, it will silently fail to enforce in concurrent scenarios.

### Pitfall 2: Forgetting Soft Delete Filter in Queries
**What goes wrong:** Queries return archived/deleted meters, showing them in the UI.
**Why it happens:** After implementing soft delete with `deletedAt`, every query must include `where: { deletedAt: null }`.
**How to avoid:** Always include the soft delete filter in all meter queries. Consider using a Prisma middleware/extension if the pattern repeats extensively, but for a small number of queries (3-4 meter queries), explicit filtering is clearer.
**Warning signs:** Deleted meters appearing in meter selection dropdowns or tab counts.

### Pitfall 3: Missing Sort Order for Consumption Calculation
**What goes wrong:** Consumption calculation produces wrong results because readings are not sorted chronologically.
**Why it happens:** On-demand delta calculation depends on readings being ordered by date ASC. If the query uses a different sort order, the deltas will be between wrong pairs.
**How to avoid:** ALWAYS sort readings by `readingDate: 'asc'` before calculating consumption. The display order can be different (desc for latest-first), but calculation must use ascending.
**Warning signs:** Negative consumption values that don't correspond to validation failures.

### Pitfall 4: Photo Upload Without Authentication
**What goes wrong:** Uploaded meter photos are publicly accessible without authentication.
**Why it happens:** @fastify/static serves files without checking authentication by default.
**How to avoid:** Register @fastify/static within the protected routes scope (inside the `protectedRoutes` plugin that has the `onRequest: app.authenticate` hook), NOT at the top level.
**Warning signs:** Photos accessible via direct URL without a valid JWT token.

### Pitfall 5: Large App.tsx Monolith Growth
**What goes wrong:** All utility tracking code gets added to App.tsx, making it even larger than its current ~1000 lines.
**Why it happens:** Following the path of least resistance by extending the existing monolith.
**How to avoid:** Keep App.tsx changes minimal -- only add `'utilities'` to currentView union, add a nav button, and add the view routing conditional. All utility logic goes in dedicated page/component files.
**Warning signs:** More than 20-30 new lines added to App.tsx.

### Pitfall 6: Monotonic Validation Race Condition
**What goes wrong:** Two concurrent requests both pass application-level validation but insert out-of-order values.
**Why it happens:** Application checks `SELECT MAX(value)` but another INSERT happens between the check and the new INSERT.
**How to avoid:** Use a database trigger as backup. For a single-user app this is extremely unlikely, but the trigger provides defense-in-depth. Alternatively, wrap the check + insert in a serializable transaction.
**Warning signs:** Very unlikely in a single-user app, but worth having the safety net.

## Code Examples

Verified patterns from the existing codebase and official sources:

### Prisma Schema for Meters and Readings
```prisma
// Follows existing schema patterns from schema.prisma
model Meter {
  id          String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  type        String         // "STROM" | "GAS" | "WASSER_WARM"
  name        String         // Custom name, e.g. "Hauptzahler Keller"
  unit        String         // "kWh" or "m3"
  location    String?        // Optional location description
  deletedAt   DateTime?      @db.Timestamptz(6) // Soft delete
  createdAt   DateTime       @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime       @updatedAt @db.Timestamptz(6)
  readings    MeterReading[]

  @@index([type])
  @@index([deletedAt])
}

model MeterReading {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  meterId     String   @db.Uuid
  readingDate DateTime @db.Date        // Date of reading (no time needed)
  value       Float                     // Raw meter value
  photoPath   String?                   // Path to uploaded photo, e.g. "/uploads/meter-photos/uuid.jpg"
  notes       String?                   // Optional notes
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  meter       Meter    @relation(fields: [meterId], references: [id])

  @@unique([meterId, readingDate])     // One reading per meter per date
  @@index([meterId, readingDate])
}
```

### Database Migration with Monotonic Trigger
```sql
-- In the Prisma migration SQL file (manually edited after prisma migrate dev --create-only)

-- Create trigger function for monotonic validation
CREATE OR REPLACE FUNCTION check_meter_reading_monotonic()
RETURNS TRIGGER AS $$
DECLARE
  prev_value FLOAT;
BEGIN
  -- Find the most recent reading before this one for the same meter
  SELECT value INTO prev_value
  FROM "MeterReading"
  WHERE "meterId" = NEW."meterId"
    AND "readingDate" < NEW."readingDate"
    AND (NEW.id IS NULL OR id != NEW.id)
  ORDER BY "readingDate" DESC
  LIMIT 1;

  -- If there's a previous reading and new value is less, reject
  IF prev_value IS NOT NULL AND NEW.value < prev_value THEN
    RAISE EXCEPTION 'Meter reading value (%) must be >= previous reading value (%)',
      NEW.value, prev_value;
  END IF;

  -- Also check that no future reading is less than this new value
  -- (protects against inserting a reading between two existing ones)
  DECLARE
    next_value FLOAT;
  BEGIN
    SELECT value INTO next_value
    FROM "MeterReading"
    WHERE "meterId" = NEW."meterId"
      AND "readingDate" > NEW."readingDate"
      AND (NEW.id IS NULL OR id != NEW.id)
    ORDER BY "readingDate" ASC
    LIMIT 1;

    IF next_value IS NOT NULL AND NEW.value > next_value THEN
      RAISE EXCEPTION 'Meter reading value (%) must be <= next reading value (%)',
        NEW.value, next_value;
    END IF;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to MeterReading table
CREATE TRIGGER enforce_monotonic_reading
  BEFORE INSERT OR UPDATE ON "MeterReading"
  FOR EACH ROW
  EXECUTE FUNCTION check_meter_reading_monotonic();
```

### Application-Level Monotonic Validation (Fastify Route)
```typescript
// Primary validation with user-friendly error messages
fastify.post('/utilities/readings', async (request, reply) => {
  const data = createReadingSchema.parse(request.body);

  // Check for previous reading (monotonic validation)
  const previousReading = await prisma.meterReading.findFirst({
    where: {
      meterId: data.meterId,
      readingDate: { lt: new Date(data.readingDate) },
    },
    orderBy: { readingDate: 'desc' },
  });

  if (previousReading && data.value < previousReading.value) {
    return reply.code(400).send({
      error: 'Invalid reading',
      message: 'This reading is lower than your last one. Meter values can only increase.',
      details: {
        previousValue: previousReading.value,
        previousDate: previousReading.readingDate,
        attemptedValue: data.value,
      },
    });
  }

  // Also check next reading (if inserting between existing readings)
  const nextReading = await prisma.meterReading.findFirst({
    where: {
      meterId: data.meterId,
      readingDate: { gt: new Date(data.readingDate) },
    },
    orderBy: { readingDate: 'asc' },
  });

  if (nextReading && data.value > nextReading.value) {
    return reply.code(400).send({
      error: 'Invalid reading',
      message: 'This reading is higher than a later one. Meter values must increase over time.',
      details: {
        nextValue: nextReading.value,
        nextDate: nextReading.readingDate,
        attemptedValue: data.value,
      },
    });
  }

  const reading = await prisma.meterReading.create({
    data: {
      meterId: data.meterId,
      readingDate: new Date(data.readingDate),
      value: data.value,
      notes: data.notes,
    },
  });

  reply.status(201).send(reading);
});
```

### On-Demand Consumption Calculation
```typescript
// GET /api/utilities/meters/:meterId/readings
fastify.get('/utilities/meters/:meterId/readings', async (request, reply) => {
  const { meterId } = request.params as { meterId: string };

  const readings = await prisma.meterReading.findMany({
    where: { meterId },
    orderBy: { readingDate: 'asc' },
    include: { meter: true },
  });

  // Calculate consumption on-demand (LOCKED DECISION: not stored)
  const readingsWithConsumption = readings.map((reading, index) => ({
    id: reading.id,
    readingDate: reading.readingDate,
    value: reading.value,
    consumption: index === 0 ? null : reading.value - readings[index - 1].value,
    unit: reading.meter.unit,
    photoPath: reading.photoPath,
    notes: reading.notes,
    createdAt: reading.createdAt,
  }));

  return readingsWithConsumption;
});
```

### Soft Delete Meter
```typescript
// DELETE /api/utilities/meters/:id (soft delete)
fastify.delete('/utilities/meters/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  await prisma.meter.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  reply.status(204).send();
});
```

### Frontend Navigation Integration
```typescript
// Minimal changes to App.tsx -- add to header nav buttons
// Following existing pattern from lines 484-512 of App.tsx
<button
  onClick={() => setCurrentView('utilities')}
  className={`flex items-center gap-2 px-3 py-2 ${
    currentView === 'utilities'
      ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
  } rounded-lg transition text-sm font-medium`}
  title="Utilities"
>
  <Gauge size={18} />  {/* or Zap from lucide-react */}
  <span className="hidden md:inline">Utilities</span>
</button>
```

### Photo Upload Endpoint
```typescript
// POST /api/utilities/readings/:id/photo
fastify.post('/utilities/readings/:id/photo', async (request, reply) => {
  const { id } = request.params as { id: string };
  const data = await request.file();

  if (!data) {
    return reply.code(400).send({ error: 'No file uploaded' });
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(data.mimetype)) {
    return reply.code(400).send({ error: 'Only JPEG, PNG, and WebP images are allowed' });
  }

  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.join(process.cwd(), 'uploads', 'meter-photos');

  // Ensure directory exists
  fs.mkdirSync(uploadDir, { recursive: true });

  const filename = `${id}-${Date.now()}${path.extname(data.filename)}`;
  const filepath = path.join(uploadDir, filename);

  // Save file
  const buffer = await data.toBuffer();
  fs.writeFileSync(filepath, buffer);

  // Update reading with photo path
  await prisma.meterReading.update({
    where: { id },
    data: { photoPath: `/uploads/meter-photos/${filename}` },
  });

  return { photoPath: `/uploads/meter-photos/${filename}` };
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma middleware for soft delete | Prisma Client Extensions ($extends) | Prisma 4.16+ | Extensions are now recommended over middleware |
| Manual file serving in Fastify | @fastify/static plugin | Stable for years | Handles caching, ETags, security automatically |
| Stored consumption deltas | On-demand calculation | Project decision | Simpler schema, no stale data issues |

**Deprecated/outdated:**
- Prisma middleware for soft delete: Use `$extends` client extensions if automating soft delete. For this project's small scope (3-4 queries), explicit `where: { deletedAt: null }` is simpler and clearer.

## Open Questions

1. **Navigation structure: top-level tabs vs header buttons**
   - What we know: The CONTEXT decision says "Dashboard | Time Tracking | Utilities" as top-level nav items. The current app has no explicit "Time Tracking" label -- the dashboard IS the time tracking view.
   - What's unclear: Does "Time Tracking" become a separate nav item, or does "Dashboard" effectively mean time tracking? Should there be a top-level tab bar separate from the current header?
   - Recommendation: Treat "Dashboard" as "Time Tracking" effectively. Add "Utilities" as a nav button in the header alongside existing buttons (Estimates, Settings). This matches the existing navigation pattern without requiring a major header redesign. The navigation order in the header can be: [Time Tracking] [Utilities] | [Estimates] [Settings] [Logout].

2. **Upload directory in Docker**
   - What we know: Photos stored at /uploads/meter-photos/ per CONTEXT decision. Docker Compose needs a volume mount.
   - What's unclear: The current docker-compose.yml has no upload volume. The Dockerfile creates /app/cache but not /app/uploads.
   - Recommendation: Add a Docker volume mount for uploads. Create the directory in the Dockerfile. Map to a named Docker volume for persistence.

3. **Meter type enum: database-level vs application-level**
   - What we know: Types are STROM, GAS, WASSER_WARM. PostgreSQL supports ENUM types natively.
   - What's unclear: Prisma's PostgreSQL ENUM support has been stable but adds migration complexity when adding new types.
   - Recommendation: Use a String field with Zod enum validation (application-level), matching the existing pattern for TimeEntry.source which is a String, not a database enum. This is simpler and more flexible.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis (all files read directly):
  - `backend/package.json` -- installed versions confirmed
  - `backend/prisma/schema.prisma` -- existing schema patterns
  - `backend/src/server.ts` -- plugin registration, route structure
  - `backend/src/routes/estimate.routes.ts` -- CRUD route pattern
  - `backend/src/schemas/estimate.schema.ts` -- Zod validation pattern
  - `frontend/src/App.tsx` -- navigation, view switching, component structure
  - `frontend/src/lib/auth.tsx` -- authentication context
  - `frontend/src/hooks/useTheme.tsx` -- theme context
  - `docker-compose.yml` -- deployment configuration
  - `docker/backend/Dockerfile` -- build configuration

### Secondary (MEDIUM confidence)
- [PostgreSQL CHECK constraints documentation](https://www.postgresql.org/docs/current/ddl-constraints.html) -- confirms CHECK cannot reference other rows
- [Prisma CHECK constraints docs](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/check-constraints) -- confirms Prisma does not support CHECK in schema, must use raw SQL migration
- [Prisma soft delete middleware docs](https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware/soft-delete-middleware) -- recommends client extensions over deprecated middleware
- [@fastify/static npm](https://www.npmjs.com/package/@fastify/static) -- file serving plugin

### Tertiary (LOW confidence)
- WebSearch results for React state-based routing -- confirmed the existing pattern is valid and does not need a router for this use case

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in codebase, only @fastify/static is new
- Architecture: HIGH -- follows existing codebase patterns exactly, all patterns verified from source files
- Pitfalls: HIGH -- monotonic validation limitation verified against PostgreSQL docs, soft delete patterns well-documented
- Code examples: HIGH -- based on existing codebase patterns with verified library APIs

**Research date:** 2026-02-06
**Valid until:** 2026-03-08 (30 days -- stable stack, no fast-moving dependencies)
