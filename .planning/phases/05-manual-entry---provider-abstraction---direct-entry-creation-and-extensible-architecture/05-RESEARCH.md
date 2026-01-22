# Phase 5: Manual Entry & Provider Abstraction - Research

**Researched:** 2026-01-22
**Domain:** Form Validation (React Hook Form + Zod), Backend Validation (Fastify + Zod), Provider Pattern (TypeScript)
**Confidence:** HIGH

## Summary

Phase 5 has two distinct but related goals: (1) enable users to create manual time entries via a form, and (2) refactor existing Toggl/Tempo services into a unified Provider interface for extensibility. The research confirms that React Hook Form with Zod validation is the standard approach for form handling in React 19, and Fastify has first-class Zod integration through `fastify-type-provider-zod`. For the provider abstraction, the combination of TypeScript interfaces for contracts and abstract classes for shared behavior provides the ideal pattern.

The existing codebase already has modal patterns (EditModal, SyncModal) that can inform the manual entry form design. The current TogglService and TempoService share identical patterns (caching, API calls, database upserts) that demonstrate clear refactoring opportunities.

**Primary recommendation:** Use React Hook Form v7 with Zod v4 for frontend validation, fastify-type-provider-zod for backend validation sharing the same schemas, and implement a Provider interface with abstract base class for shared sync/cache logic.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.54+ | Form state management | 2M+ weekly downloads, minimal re-renders, native React 19 support |
| zod | ^4.0+ | Schema validation & type inference | TypeScript-first, 2kb core, zero dependencies |
| @hookform/resolvers | ^5.0+ | RHF-Zod integration | Official resolver package |
| fastify-type-provider-zod | ^5.0+ | Backend Zod validation | Full Fastify integration, type-safe routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod (shared) | ^4.0+ | Shared validation schemas | When frontend/backend need identical validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Hook Form | Formik | RHF is lighter, fewer re-renders, better TS support |
| Zod | Yup/TypeBox | Zod has better TS inference, smaller bundle |
| fastify-type-provider-zod | Manual AJV | Type provider gives automatic route typing |

**Installation:**
```bash
# Frontend
cd frontend && npm install react-hook-form zod @hookform/resolvers

# Backend
cd backend && npm install zod fastify-type-provider-zod
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── src/
│   ├── providers/
│   │   ├── provider.interface.ts      # Provider contract
│   │   ├── base.provider.ts           # Abstract base with shared logic
│   │   ├── toggl.provider.ts          # Toggl implementation
│   │   ├── tempo.provider.ts          # Tempo implementation
│   │   ├── manual.provider.ts         # Manual entry "provider"
│   │   ├── provider.factory.ts        # Factory for creating providers
│   │   └── provider-sync.service.ts   # Orchestrator service
│   ├── schemas/
│   │   └── time-entry.schema.ts       # Shared Zod schemas
│   └── services/
│       └── cache.service.ts           # Shared cache manager

frontend/
├── src/
│   ├── components/
│   │   └── AddEntryModal.tsx          # Manual entry form
│   ├── schemas/
│   │   └── time-entry.schema.ts       # Validation schemas (can mirror backend)
│   └── hooks/
│       └── useTimeEntryForm.ts        # Form hook wrapper
```

### Pattern 1: Provider Interface with Abstract Base
**What:** Define a contract interface, then an abstract class with shared behavior
**When to use:** When multiple implementations share caching, logging, error handling patterns
**Example:**
```typescript
// Source: TypeScript best practices for service patterns

// provider.interface.ts - The contract
export interface TimeProvider {
  readonly source: string;
  sync(options: SyncOptions): Promise<SyncResult>;
  validate(): Promise<ValidationResult>;
  getEntries(dateRange: DateRange): Promise<TimeEntry[]>;
  getCachePath(): string;
}

export interface SyncOptions {
  forceRefresh?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface SyncResult {
  count: number;
  cached: boolean;
  message: string;
}

// base.provider.ts - Shared behavior
export abstract class BaseTimeProvider implements TimeProvider {
  abstract readonly source: string;
  protected abstract fetchFromApi(options: SyncOptions): Promise<any[]>;
  protected abstract mapToTimeEntry(raw: any): Omit<TimeEntry, 'id' | 'createdAt'>;

  constructor(
    protected prisma: PrismaClient,
    protected cacheManager: CacheManager
  ) {}

  getCachePath(): string {
    return path.join(__dirname, `../../${this.source.toLowerCase()}_cache.json`);
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    // Shared caching logic
    const cached = await this.cacheManager.get(this.getCachePath(), options);
    if (cached && !options.forceRefresh) {
      return { count: cached.length, cached: true, message: 'From cache' };
    }

    // Provider-specific fetch
    const entries = await this.fetchFromApi(options);
    await this.cacheManager.set(this.getCachePath(), entries);

    // Shared upsert logic
    const count = await this.upsertEntries(entries);
    return { count, cached: false, message: 'Fresh from API' };
  }

  protected async upsertEntries(rawEntries: any[]): Promise<number> {
    let count = 0;
    for (const raw of rawEntries) {
      const entry = this.mapToTimeEntry(raw);
      await this.prisma.timeEntry.upsert({
        where: { source_externalId: { source: this.source, externalId: entry.externalId! } },
        update: { ...entry },
        create: { source: this.source, ...entry }
      });
      count++;
    }
    return count;
  }
}
```

### Pattern 2: Provider Factory
**What:** Centralized provider instantiation with dependency injection
**When to use:** When routes need providers without knowing implementation details
**Example:**
```typescript
// Source: Factory pattern best practices

export type ProviderType = 'TOGGL' | 'TEMPO' | 'MANUAL';

export class ProviderFactory {
  constructor(
    private prisma: PrismaClient,
    private cacheManager: CacheManager
  ) {}

  create(type: ProviderType): TimeProvider {
    switch (type) {
      case 'TOGGL':
        return new TogglProvider(this.prisma, this.cacheManager);
      case 'TEMPO':
        return new TempoProvider(this.prisma, this.cacheManager);
      case 'MANUAL':
        return new ManualProvider(this.prisma);
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  getAll(): TimeProvider[] {
    return ['TOGGL', 'TEMPO'].map(type => this.create(type as ProviderType));
  }
}
```

### Pattern 3: React Hook Form with Zod
**What:** Declarative form validation with type inference
**When to use:** Any form that needs validation
**Example:**
```typescript
// Source: https://github.com/react-hook-form/resolvers

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schema with custom duration parsing
const timeEntrySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  duration: z.string()
    .min(1, 'Duration is required')
    .refine(val => parseDuration(val) > 0, 'Invalid duration format'),
  description: z.string().optional(),
  project: z.string().optional(),
});

type TimeEntryForm = z.infer<typeof timeEntrySchema>;

function AddEntryModal() {
  const { register, handleSubmit, formState: { errors } } = useForm<TimeEntryForm>({
    resolver: zodResolver(timeEntrySchema),
  });

  const onSubmit = (data: TimeEntryForm) => {
    const hours = parseDuration(data.duration);
    // Submit to API
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input type="date" {...register('date')} />
      {errors.date && <span>{errors.date.message}</span>}

      <input {...register('duration')} placeholder="2.5 or 2h 30m" />
      {errors.duration && <span>{errors.duration.message}</span>}

      <button type="submit">Add Entry</button>
    </form>
  );
}
```

### Anti-Patterns to Avoid
- **God Service:** Don't put all provider logic in one giant service. Each provider should be isolated.
- **Duplicate Validation:** Don't write validation in both frontend and backend separately. Share Zod schemas.
- **Direct Prisma in Routes:** Routes should use services/providers, not direct Prisma calls.
- **No Error Boundaries:** Forms without proper error handling cause poor UX.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state management | useState for each field | react-hook-form | Re-renders, error handling, touched state |
| Duration parsing | Simple regex | Dedicated parser function | Edge cases: "1h", "1.5", "01:30", "90m" |
| Form validation | Manual if/else checks | Zod schema | Type inference, consistent error messages |
| Backend validation | req.body checks | fastify-type-provider-zod | Type-safe routes, automatic 400 responses |
| Cache invalidation | setTimeout | CacheManager class | TTL management, file existence checks |

**Key insight:** The existing codebase already has two nearly identical service implementations (TogglService, TempoService) with duplicated caching and database logic. This is exactly the problem abstract base classes solve.

## Common Pitfalls

### Pitfall 1: Duration Format Complexity
**What goes wrong:** Users enter durations in various formats that break parsing
**Why it happens:** "2.5", "2h 30m", "2:30", "150m" are all valid human inputs
**How to avoid:** Create a robust parser that handles all formats, with clear error messages
**Warning signs:** Users complaining entries have wrong hours
```typescript
// Robust duration parser
function parseDuration(input: string): number {
  if (!input) return 0;

  // Format: "2h 30m" or "2h30m"
  const hm = input.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?/i);
  if (hm) return parseFloat(hm[1]) + (parseInt(hm[2] || '0') / 60);

  // Format: "90m" or "90 minutes"
  const mins = input.match(/^(\d+)\s*m(?:in(?:ute)?s?)?$/i);
  if (mins) return parseInt(mins[1]) / 60;

  // Format: "HH:MM" or "H:MM"
  const time = input.match(/^(\d{1,2}):(\d{2})$/);
  if (time) return parseInt(time[1]) + parseInt(time[2]) / 60;

  // Format: decimal "2.5"
  const decimal = parseFloat(input);
  if (!isNaN(decimal)) return decimal;

  return 0;
}
```

### Pitfall 2: Manual Entry External ID Handling
**What goes wrong:** Manual entries conflict with unique constraint on source_externalId
**Why it happens:** Manual entries don't have external IDs like Toggl/Tempo
**How to avoid:** Generate unique synthetic IDs for manual entries (e.g., `MANUAL_${timestamp}_${random}`)
**Warning signs:** Database unique constraint violations on save

### Pitfall 3: Form Reset After Submit
**What goes wrong:** Form keeps old values after successful submit
**Why it happens:** React Hook Form needs explicit reset() call
**How to avoid:** Call reset() after successful API response
**Warning signs:** Users confused by stale form data

### Pitfall 4: Modal Focus Trap
**What goes wrong:** Tab key moves focus outside modal
**Why it happens:** No focus management in custom modals
**How to avoid:** Use focus trap or aria-modal with proper event handling
**Warning signs:** Accessibility complaints, keyboard navigation issues

### Pitfall 5: Provider Abstraction Over-Engineering
**What goes wrong:** Abstract class becomes complex trying to handle all edge cases
**Why it happens:** Trying to fit Manual entries into same pattern as API providers
**How to avoid:** ManualProvider can be simpler - no caching, no API calls, just CRUD
**Warning signs:** ManualProvider has empty stub methods

## Code Examples

Verified patterns from official sources:

### Fastify Route with Zod Validation
```typescript
// Source: https://github.com/turkerdev/fastify-type-provider-zod

import { z } from 'zod';
import { ZodTypeProvider, validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';

// Schema shared with frontend
const createEntrySchema = z.object({
  date: z.string().datetime(),
  duration: z.number().positive(),
  description: z.string().optional(),
  project: z.string().optional(),
});

// Setup in server.ts
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Route definition
app.withTypeProvider<ZodTypeProvider>().post('/api/entries', {
  schema: {
    body: createEntrySchema,
    response: {
      201: z.object({ id: z.string(), message: z.string() }),
    },
  },
}, async (request, reply) => {
  // request.body is fully typed as z.infer<typeof createEntrySchema>
  const { date, duration, description, project } = request.body;

  const entry = await prisma.timeEntry.create({
    data: {
      source: 'MANUAL',
      externalId: `MANUAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date(date),
      duration,
      description,
      project,
    },
  });

  return reply.status(201).send({ id: entry.id, message: 'Entry created' });
});
```

### React Hook Form Modal Component
```typescript
// Source: https://react-hook-form.com/get-started + https://zod.dev/

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  date: z.string().min(1, 'Date is required'),
  duration: z.string().min(1, 'Duration is required'),
  description: z.string().optional(),
  project: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddEntryModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddEntryModal({ onClose, onSuccess }: AddEntryModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const hours = parseDuration(data.duration);
      await axios.post('/api/entries', {
        date: new Date(data.date).toISOString(),
        duration: hours,
        description: data.description,
        project: data.project,
      });
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Form fields with error display */}
        </form>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Formik + Yup | React Hook Form + Zod | 2023+ | Better TS support, smaller bundle |
| Manual AJV schemas | Type providers | Fastify 4+ | Automatic route typing |
| Class-based services | Provider pattern with DI | Ongoing | Better testability, extensibility |
| Separate FE/BE validation | Shared Zod schemas | Zod v3+ | Single source of truth |

**Deprecated/outdated:**
- Yup: Still works but Zod has better TypeScript inference
- Manual form state with useState: React Hook Form eliminates boilerplate
- Direct Prisma calls in routes: Service/provider layer improves testability

## Open Questions

Things that couldn't be fully resolved:

1. **Shared Schema Location**
   - What we know: Zod schemas can be shared between frontend and backend
   - What's unclear: Best way to share (npm workspace, copy, or build step)
   - Recommendation: For simplicity, duplicate schemas initially. If they drift, consider npm workspace.

2. **Manual Entry "Sync" Semantics**
   - What we know: Manual entries don't sync to external services
   - What's unclear: Should ManualProvider implement full interface or simplified version?
   - Recommendation: Use simpler CRUD interface for ManualProvider, don't force sync pattern.

3. **Start/End Time vs Duration**
   - What we know: REQ-010 says "duration (or start/end time)"
   - What's unclear: Should form support both input modes?
   - Recommendation: Start with duration-only for simplicity. Calculate duration from start/end if needed later.

## Sources

### Primary (HIGH confidence)
- [React Hook Form - Get Started](https://react-hook-form.com/get-started) - Installation, usage patterns
- [Zod Documentation](https://zod.dev/) - v4 features, API reference
- [Zod API - Defining Schemas](https://zod.dev/api) - String, number, date, object, refine, transform
- [@hookform/resolvers GitHub](https://github.com/react-hook-form/resolvers) - zodResolver integration
- [fastify-type-provider-zod GitHub](https://github.com/turkerdev/fastify-type-provider-zod) - Fastify integration

### Secondary (MEDIUM confidence)
- [DEV Community - RHF + Zod TypeScript](https://dev.to/majiedo/using-zod-with-react-hook-form-using-typescript-1mgk) - Implementation patterns
- [Fastify TypeScript Docs](https://fastify.dev/docs/latest/Reference/TypeScript/) - Type provider setup
- [TypeScript Design Patterns](https://refactoring.guru/design-patterns/typescript) - Factory, Bridge patterns
- [Abstract vs Interface TypeScript](https://khalilstemmler.com/blogs/typescript/abstract-class/) - When to use each

### Tertiary (LOW confidence)
- WebSearch results on provider patterns - Need validation against actual implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation confirms versions and integration
- Architecture: HIGH - Patterns verified against multiple authoritative sources
- Pitfalls: MEDIUM - Based on common patterns, may need validation during implementation
- Duration parsing: MEDIUM - Common patterns but edge cases need testing

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (30 days - stable libraries)
