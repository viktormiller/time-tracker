# Project Estimation Tracking Feature

**Status:** ✅ Implemented and Deployed
**Date:** 2026-01-29
**Commits:**
- `75d217d` - feat: add project estimation tracking with enhanced project names
- `d4fa584` - fix: use default_workspace_id for Toggl project name fetch
- `f3b8855` - docs: add development setup instructions to README files

## Overview

Added a comprehensive project estimation tracking system that allows users to:
- Create budget estimates with client names and estimated hours
- Link estimates to one or more existing project strings from time entries
- View real-time progress with color-coded progress bars
- See enhanced project information (name, total hours, entry count)
- Get real Toggl project names instead of generic IDs

## Database Schema

### New Models

```prisma
model ProjectEstimate {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  clientName     String
  name           String
  estimatedHours Float
  notes          String?
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)
  projects       EstimateProject[]
}

model EstimateProject {
  id          String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  estimateId  String          @db.Uuid
  projectName String
  estimate    ProjectEstimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)
  @@unique([estimateId, projectName])
  @@index([projectName])
}
```

**Migration:** `20260129021103_add_project_estimates`

### Design Decisions

- **Junction Table:** `EstimateProject` allows many-to-many relationship between estimates and projects
- **Cascade Delete:** When an estimate is deleted, all linked projects are automatically removed
- **Unique Constraint:** Prevents duplicate project links for the same estimate
- **Index on projectName:** Optimizes lookups when calculating actual hours

## Backend API

### Endpoints

All endpoints are under the `/api` prefix and require authentication.

#### GET `/api/estimates`
Returns all estimates with computed progress metrics.

**Response:**
```json
[
  {
    "id": "uuid",
    "clientName": "DDHH",
    "name": "Ein Kunde",
    "estimatedHours": 30.0,
    "notes": "Optional notes",
    "createdAt": "2026-01-29T...",
    "updatedAt": "2026-01-29T...",
    "projects": [
      { "id": "uuid", "projectName": "Hamburg Digital Dabei" }
    ],
    "actualHours": 23.0,
    "percentage": 77,
    "status": "yellow"
  }
]
```

**Status Colors:**
- `green`: < 75% (on track)
- `yellow`: 75-99% (nearing limit)
- `red`: ≥ 100% (over budget)

#### POST `/api/estimates`
Creates a new estimate.

**Request:**
```json
{
  "clientName": "DDHH",
  "name": "Ein Kunde",
  "estimatedHours": 30.0,
  "notes": "Optional notes",
  "projects": ["Hamburg Digital Dabei", "forHim"]
}
```

#### PUT `/api/estimates/:id`
Updates an existing estimate. Uses a transaction to replace project links atomically.

**Request:** Same as POST (all fields optional except projects requires at least one)

#### DELETE `/api/estimates/:id`
Deletes an estimate (cascade deletes project links).

**Response:** 204 No Content

#### GET `/api/projects/unique`
Returns all unique project names with context.

**Response:**
```json
[
  {
    "name": "Hamburg Digital Dabei",
    "totalHours": 23.5,
    "entryCount": 12
  },
  {
    "name": "forHim",
    "totalHours": 45.2,
    "entryCount": 28
  }
]
```

### Implementation Files

- **Schema:** `backend/src/schemas/estimate.schema.ts` - Zod validation
- **Routes:** `backend/src/routes/estimate.routes.ts` - CRUD endpoints
- **Registration:** `backend/src/server.ts` - Route registration

### Key Logic

**Actual Hours Calculation:**
```typescript
const result = await prisma.timeEntry.aggregate({
  where: {
    project: {
      in: projectNames, // All linked project names
    },
  },
  _sum: {
    duration: true,
  },
});
```

**Project Context Aggregation:**
```typescript
const stats = await prisma.timeEntry.aggregate({
  where: { project: projectName },
  _sum: { duration: true },
  _count: true,
});
```

## Frontend Implementation

### New Page: Estimates

**File:** `frontend/src/pages/Estimates.tsx`

**Features:**
- Card-based list view with progress visualization
- Add/Edit modal with form validation
- Multi-select project picker with autocomplete
- Color-coded progress bars
- Dark mode support
- German language labels

**Key Components:**

1. **Estimate Card**
   - Client name + estimate name header
   - Project badges (linked projects)
   - Progress bar with percentage
   - Edit/Delete buttons

2. **Add/Edit Modal**
   - Kundenname (client name) - text input
   - Bezeichnung (name) - text input
   - Geschätzte Stunden (estimated hours) - number input
   - Notizen (notes) - optional textarea
   - Projekte - multi-select dropdown with context

3. **Enhanced Project Dropdown**
   - Shows project name, total hours, and entry count
   - Example: "Hamburg Digital Dabei - 23.5h · 12 Einträge"
   - Searchable/filterable
   - Allows adding custom project names

### App Integration

**File:** `frontend/src/App.tsx`

**Changes:**
1. Added `'estimates'` to view state type union
2. Added "Schätzungen" navigation button with Layers icon
3. Added conditional rendering for Estimates page

**Navigation Button:**
```tsx
<button onClick={() => setCurrentView('estimates')}>
  <Layers size={18} />
  <span>Schätzungen</span>
</button>
```

## Toggl Integration Enhancement

### Real Project Names

**Problem:** Toggl time entries were stored with generic project IDs like `Proj-178782661` instead of real project names.

**Solution:** Enhanced the Toggl provider to fetch project names from the Toggl API.

**File:** `backend/src/providers/toggl.provider.ts`

### Implementation

1. **Project Cache:**
   ```typescript
   private projectCache: Map<number, string> = new Map();
   ```

2. **Fetch Project Names:**
   - Calls `/api/v9/me` to get default workspace ID
   - Fetches projects from `/api/v9/workspaces/{id}/projects`
   - Caches project ID → name mapping

3. **Transform Entries:**
   ```typescript
   transformEntry(rawEntry: any): RawTimeEntry {
     const projectName = rawEntry.project_id
       ? this.projectCache.get(rawEntry.project_id) || `Proj-${rawEntry.project_id}`
       : 'No Project';
     // ...
   }
   ```

### API Quirk

**Issue:** Toggl API v9 `/me` endpoint returns `default_workspace_id` but sometimes has empty `workspaces` array.

**Fix:** Use `default_workspace_id` directly instead of iterating workspaces array.

```typescript
const defaultWorkspaceId = meResponse.data.default_workspace_id;
// Fetch projects using this ID directly
```

### Updating Existing Entries

**Note:** Existing database entries keep their old project names. New syncs will have real names.

**To update existing entries:**
1. Delete old entries manually
2. Force re-sync from Toggl
3. OR: Create migration script to update project names in bulk

## User Workflow

1. **Navigate to Estimates:**
   - Click "Schätzungen" button in header (next to Settings)

2. **Create Estimate:**
   - Click "Neue Schätzung"
   - Enter client name, estimate name, hours
   - Add notes (optional)
   - Select projects from dropdown
   - Click "Erstellen"

3. **View Progress:**
   - Green bar: Under 75% (on track)
   - Yellow bar: 75-99% (nearing limit)
   - Red bar: 100%+ (over budget)

4. **Edit/Delete:**
   - Click pencil icon to edit
   - Click trash icon to delete

## Technical Notes

### Performance Considerations

1. **Project Context Endpoint:** Runs aggregation query for each project. May be slow with many projects (100+).
   - **Future Optimization:** Cache results or use materialized view

2. **Estimate Progress Calculation:** Runs for each estimate on every GET request.
   - **Future Optimization:** Cache in Redis or compute on-demand

### Type Safety

- Full TypeScript coverage
- Zod validation on backend
- Type-safe API responses

### Error Handling

- Form validation with user-friendly messages
- API errors logged to console
- User alerts for sync/save failures

### Dark Mode

- Fully supported across all components
- Uses Tailwind dark mode classes
- Consistent with existing design system

## Known Limitations

1. **Project Name Updates:** Existing entries don't auto-update when project names change in Toggl
2. **Single Workspace:** Only fetches projects from default workspace
3. **No Project Aliases:** Can't create custom names/aliases for projects
4. **No Time Filtering:** Progress calculation includes ALL time entries for linked projects (no date range filter)

## Future Enhancements

### Potential Features

1. **Date Range Filtering:** Calculate actual hours within specific date range
2. **Budget Alerts:** Email notifications when nearing budget
3. **Project Grouping:** Group multiple estimates by client
4. **Export Reports:** PDF/CSV export of estimates with progress
5. **Historical Tracking:** Track estimate changes over time
6. **Project Aliases:** Custom display names for projects
7. **Multi-workspace Support:** Fetch projects from all workspaces
8. **Bulk Operations:** Update multiple estimates at once

### Performance Improvements

1. **Caching:** Redis cache for project context and progress calculations
2. **Materialized Views:** Pre-computed project statistics
3. **Pagination:** For large estimate lists
4. **Lazy Loading:** Load progress on expand/demand

## Testing

### Manual Verification

1. ✅ Create estimate with single project
2. ✅ Create estimate with multiple projects
3. ✅ Edit estimate (change hours, add/remove projects)
4. ✅ Delete estimate
5. ✅ Progress bar colors (green/yellow/red)
6. ✅ Project dropdown shows hours and counts
7. ✅ Dark mode rendering
8. ✅ Toggl project names display correctly
9. ✅ Form validation (required fields, positive numbers)

### Browser Tested

- ✅ Chrome (macOS)
- ✅ Dark mode

## Database Credentials

**Development:**
- Username: `admin`
- Password: `admin123`

**Database:**
- PostgreSQL on port 5432
- Database name: `timetracker`
- Connection string in `backend/.env`

## Deployment Notes

### Environment Variables Required

```bash
DATABASE_URL="postgresql://timetracker:devpassword@localhost:5432/timetracker"
JWT_SECRET="dev-jwt-secret-must-be-at-least-32-characters-long"
SESSION_SECRET="63bf0e22d987ede71fbf223d38ff0de0c0422c8533a2201925ad377eb9c85c3e"
ADMIN_PASSWORD_HASH="$2b$12$BIvSHp6cvICliq28CkdsuO/W.LiqrtSvqGBiKyZeh7rDsbt54eGEq"
TOGGL_API_TOKEN="your_token_here"
```

### Migration Steps

```bash
cd backend
npx prisma migrate deploy  # Apply migrations
npm run dev               # Start backend
```

### Frontend Build

```bash
cd frontend
npm install              # Install dependencies (includes date-fns-tz)
npm run dev             # Start dev server
```

## Troubleshooting

### Issue: Project names still show as "Proj-XXXXXXX"

**Solution:**
1. Verify Toggl API token is configured
2. Check backend logs for project fetch errors
3. Force re-sync from Toggl
4. Delete old entries and re-sync to get new names

### Issue: "date-fns-tz" import error in frontend

**Solution:**
```bash
cd frontend
npm install  # Installs date-fns-tz dependency
```

### Issue: No estimates showing

**Solution:**
1. Check if database migration ran successfully
2. Verify API endpoint is accessible
3. Check browser console for errors
4. Verify authentication is working

## Related Files

### Backend
- `backend/prisma/schema.prisma` - Database schema
- `backend/prisma/migrations/20260129021103_add_project_estimates/` - Migration
- `backend/src/schemas/estimate.schema.ts` - Validation schemas
- `backend/src/routes/estimate.routes.ts` - API endpoints
- `backend/src/providers/toggl.provider.ts` - Toggl integration
- `backend/src/server.ts` - Route registration

### Frontend
- `frontend/src/pages/Estimates.tsx` - Main estimates page
- `frontend/src/App.tsx` - Navigation integration
- `frontend/package.json` - Dependencies (date-fns-tz)

## Contact & Support

For questions or issues with this feature, refer to:
- This documentation file
- Git commit history (`git log --oneline`)
- Backend logs (`/tmp/backend.log`)
- Browser console for frontend errors

---

**Last Updated:** 2026-01-29
**Feature Version:** 1.0
**Status:** Production Ready ✅
