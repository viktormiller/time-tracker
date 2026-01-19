# Time Tracking Dashboard Feature Implementation Research

**Project:** Time Tracker Dashboard
**Researched:** 2026-01-19
**Overall Confidence:** HIGH

## Executive Summary

This research covers implementation patterns for four key feature areas in time tracking dashboards: core features, export functionality (CSV/PDF), theme switching (dark mode), and manual time entry UIs. The findings synthesize current best practices from successful time tracking applications (Toggl, Clockify, Harvest) and modern web development patterns for React/Node.js applications.

**Key Recommendation:** The project is well-positioned with its existing stack (React + Tailwind + Fastify + Prisma). The research identifies specific libraries and patterns that integrate cleanly with the current architecture.

---

## 1. Time Tracking Dashboard Features

### Table Stakes Features (Must-Have)

Based on analysis of successful time tracking applications in 2026, users expect these core features:

| Feature | Why Expected | Complexity | Implementation Priority |
|---------|--------------|------------|------------------------|
| **Real-time timers** | Industry standard - start/stop tracking with single click | Medium | Existing (sync feature) |
| **Manual time entry** | Users need to log forgotten hours or edit entries | Low | **NEEDED** |
| **Date range filtering** | Essential for reporting and analysis | Low | Existing |
| **Automatic timesheets** | Users expect automatic calculation and aggregation | Low | Existing |
| **Multi-source aggregation** | Your differentiator - combining Toggl + Tempo | Medium | Existing |
| **Visual reporting (charts)** | Users expect graphical representation of time data | Medium | Existing (Recharts) |
| **Export capabilities** | Required for payroll, invoicing, record-keeping | Medium | **NEEDED** |
| **Offline capability** | Apps should continue tracking even with poor connectivity | High | Not needed for dashboard aggregator |

### Differentiating Features (Nice-to-Have)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Dark mode** | Reduces eye strain, extends battery life (OLED) | Low | Expected by 2026 standards |
| **AI-powered insights** | Productivity patterns, time prediction | High | Post-MVP |
| **Idle detection** | Automatic timeline correction | Medium | Post-MVP |
| **Custom reporting** | Flexible report generation | Medium | Defer |
| **Team collaboration** | Multi-user time tracking | High | Out of scope |

### Current State Analysis

**What you have:**
- Real-time data visualization (Recharts with stacked bars)
- Date range filtering with presets (Today, Week, Month, etc.)
- Multi-source aggregation (Toggl + Tempo)
- Basic CRUD operations on entries
- Source and project filtering

**What's missing (from user expectations):**
- Manual entry creation (only edit existing)
- CSV export
- PDF export
- Dark mode
- Bulk operations

### Best Practices from Leading Apps

**Toggl Track:**
- Automated time tracking with desktop app
- Calendar view for entries
- User-specific billable rates
- Invoicing integration

**Clockify:**
- Free plan with unlimited users
- Idle time detection
- Screenshot tracking (monitoring feature)
- Scheduling and task delegation

**Harvest:**
- Duration vs Start/End time modes (user choice)
- Built-in invoicing
- Clean, polished client-facing reports
- Simple contractor tracking

**Key Insight:** Duration-based entry is the default pattern, but offering both duration and start/end time provides flexibility for different use cases.

---

## 2. Export Patterns (CSV & PDF)

### CSV Export Implementation

#### Recommended Approach: Client-Side Generation

**Library:** `export-to-csv` (npm)
- **Why:** Lightweight, stable, zero dependencies, well-typed
- **Confidence:** HIGH (verified with npm package data)

**Alternative:** Native implementation using Blob API
```javascript
// No external library needed for simple CSV
const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
const encodedUri = encodeURI(csvContent);
const link = document.createElement("a");
link.setAttribute("href", encodedUri);
link.setAttribute("download", "export.csv");
document.body.appendChild(link);
link.click();
```

**Best Practices:**
- **Security:** Always validate and sanitize data before export (prevent CSV injection)
- **Performance:** For large datasets (>10k rows), use pagination or streaming
- **UX:** Show loading indicator during CSV generation
- **Format:** Include headers, use proper escaping for commas/quotes

**Other Options Considered:**
| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| `react-csv` | React-specific, declarative | More dependencies | Good alternative |
| `papaparse` | Powerful parser/generator | Heavier, overkill for simple export | Use for import only |
| `csv` (Node.js) | Backend generation | Requires server round-trip | Use if need server-side processing |

#### When to Use Backend CSV Generation

Generate CSV server-side (Node.js) when:
- Dataset is too large for browser memory (>100k rows)
- Need to aggregate data from multiple sources server-side
- Security requirements prevent client-side data exposure

**Recommended Backend Library:** `csv` (csv-stringify module)
- Already used in project (`csv-parse` is installed)
- Same ecosystem, familiar API
- Fast and memory-efficient with streams

### PDF Export Implementation

#### Recommended Approach: Browser Automation (Server-Side)

**Library:** `puppeteer` (Google's headless Chrome)
- **Why:** Excellent HTML/CSS rendering, stable, well-maintained
- **Best for:** Dynamic content, complex layouts, chart rendering
- **Confidence:** HIGH (official Google project, actively maintained)

**Key Advantages:**
- Renders existing HTML/CSS directly (reuse dashboard components)
- Perfect for converting charts (Recharts) to PDF
- Supports modern CSS (Grid, Flexbox, custom fonts)
- Waits for JavaScript/content to load before rendering

**Implementation Pattern:**
```typescript
// Backend endpoint: /api/export/pdf
import puppeteer from 'puppeteer';

async function generatePDF(entries: TimeEntry[]) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Option 1: Render existing frontend route
  await page.goto('http://localhost:5173/print?data=' + encodeURIComponent(JSON.stringify(entries)));

  // Option 2: Set HTML content directly
  await page.setContent(generateReportHTML(entries));

  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    printBackground: true
  });

  await browser.close();
  return pdf;
}
```

**Alternative: Playwright**
- Microsoft's cross-browser automation tool
- Similar to Puppeteer but supports Firefox/WebKit
- **Limitation:** PDF generation only works with Chromium
- **Verdict:** Use Puppeteer (simpler, focused on Chromium)

#### Alternative: Low-Level PDF Generation

**Library:** `pdfkit` (for Node.js backend)
- **Why:** Creates PDFs programmatically element-by-element
- **Best for:** Simple documents, invoices, receipts
- **Cons:** Cannot render HTML/CSS, must draw everything manually
- **Verdict:** Too complex for dashboard reports with charts

**Not Recommended:**
- `jspdf`: Client-side only, cannot run in Node.js without hacks
- `wkhtmltopdf`: Outdated, deprecated HTML rendering engine

### Export Feature Comparison

| Approach | CSV | PDF |
|----------|-----|-----|
| **Where** | Client-side (browser) | Server-side (Puppeteer) |
| **Library** | `export-to-csv` or Blob API | `puppeteer` |
| **Use Case** | Raw data export for Excel | Formatted reports with charts |
| **Performance** | Fast (<100ms) | Moderate (1-3 seconds) |
| **Complexity** | Low | Medium |

---

## 3. Theme Switching (Dark Mode)

### Recommended Approach: Tailwind CSS Dark Mode

**Confidence:** HIGH (official Tailwind documentation + project already uses Tailwind)

#### Configuration

Your project uses Tailwind CSS, which has built-in dark mode support.

**Step 1: Enable in `tailwind.config.js`**
```javascript
module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  // ... rest of config
}
```

**Step 2: Add Dark Mode Variants to Components**
```jsx
<div className="bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100">
  <h1 className="text-indigo-600 dark:text-indigo-400">Dashboard</h1>
</div>
```

**Step 3: Theme Toggle Logic (React)**
```typescript
// hooks/useTheme.ts
import { useEffect, useState } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // 1. Check localStorage
    const stored = localStorage.getItem('theme');
    if (stored) return stored as 'light' | 'dark';

    // 2. Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return { theme, toggleTheme };
}
```

**Step 4: Theme Toggle Button**
```jsx
import { Moon, Sun } from 'lucide-react';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
```

### Best Practices

1. **Respect System Preferences:** Use `prefers-color-scheme` media query as default
2. **Persist User Choice:** Store preference in `localStorage`
3. **Avoid Flash:** Set theme class on initial render (before hydration)
4. **Test Color Contrast:** Ensure WCAG AA compliance in both modes
5. **Chart Compatibility:** Update Recharts colors for dark mode

**Recharts Dark Mode Example:**
```jsx
<CartesianGrid
  strokeDasharray="3 3"
  stroke={theme === 'dark' ? '#374151' : '#f3f4f6'}
/>
<XAxis
  tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
/>
```

### Alternative Approaches Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **CSS Variables** | Framework-agnostic | More verbose than Tailwind | Use if not using Tailwind |
| **React Context + styled-components** | Full theming control | Adds dependencies | Overkill for simple dark mode |
| **use-dark-mode hook** | Pre-built solution | Unnecessary dependency | Tailwind + custom hook is simpler |

---

## 4. Manual Time Entry UI Patterns

### Core Design Patterns

#### Input Method: Duration vs Start/End Time

**Recommendation:** Offer both, default to duration

**Why:**
- Harvest research shows duration is the default in modern apps
- Start/End time is preferred for detailed tracking (field workers, consultants)
- Flexibility accommodates different user preferences

**Implementation:**
```tsx
type EntryMode = 'duration' | 'time-range';

function ManualEntryForm() {
  const [mode, setMode] = useState<EntryMode>('duration');

  return (
    <form>
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('duration')}
          className={mode === 'duration' ? 'active' : ''}
        >
          Duration
        </button>
        <button
          type="button"
          onClick={() => setMode('time-range')}
          className={mode === 'time-range' ? 'active' : ''}
        >
          Start/End Time
        </button>
      </div>

      {mode === 'duration' ? (
        <DurationInput /> // e.g., "2h 30m" or "2.5"
      ) : (
        <TimeRangeInput /> // Start: 09:00, End: 11:30
      )}
    </form>
  );
}
```

### Form Field Best Practices

#### 1. Date Selection

**Library:** `react-day-picker` (already installed in project)
- Already using this for date range picker
- Consistent UX with existing filters
- Good localization support (project uses German locale)

**Pattern:**
```tsx
<DayPicker
  mode="single"
  selected={date}
  onSelect={setDate}
  locale={de}
  defaultMonth={new Date()}
/>
```

#### 2. Duration Input

**Recommended Pattern:** Flexible text input with validation

**Accept formats:**
- Hours only: `2`, `2.5`, `2,5` (German decimal)
- Hours and minutes: `2h 30m`, `2:30`, `02:30`
- Natural language: Future enhancement with NLP

**Validation:**
```typescript
function parseDuration(input: string): number | null {
  // Match: "2.5", "2,5", "2h 30m", "2:30"

  // Decimal hours
  const decimal = input.replace(',', '.').match(/^(\d+\.?\d*)$/);
  if (decimal) return parseFloat(decimal[1]);

  // Hours and minutes (2h 30m)
  const hm = input.match(/(\d+)h\s*(\d+)m/);
  if (hm) return parseInt(hm[1]) + parseInt(hm[2]) / 60;

  // Time format (2:30)
  const time = input.match(/(\d+):(\d+)/);
  if (time) return parseInt(time[1]) + parseInt(time[2]) / 60;

  return null;
}
```

**UX:**
- Show placeholder: `"z.B. 2.5 oder 2h 30m"` (German)
- Inline validation with helpful error messages
- Convert to hours on blur for consistency

#### 3. Time Range Input (Start/End)

**Recommended:** HTML5 `<input type="time">` with 24-hour format

**Pattern:**
```tsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <label>Start</label>
    <input
      type="time"
      value={startTime}
      onChange={e => setStartTime(e.target.value)}
      className="..."
    />
  </div>
  <div>
    <label>End</label>
    <input
      type="time"
      value={endTime}
      onChange={e => setEndTime(e.target.value)}
      className="..."
    />
  </div>

  {/* Auto-calculated duration */}
  <div className="col-span-2 text-sm text-gray-500">
    Duration: {calculateDuration(startTime, endTime)} hours
  </div>
</div>
```

**Why native time input:**
- Mobile-optimized (native picker on iOS/Android)
- Locale-aware formatting
- Built-in validation
- No extra dependencies

**Alternative for better desktop UX:** Time picker component
- Consider `react-time-picker` if native input UX is insufficient
- Most users are comfortable with native time inputs in 2026

#### 4. Project Selection

**Recommendation:** Searchable dropdown (combobox)

**Current Implementation:** Basic `<select>` dropdown
- Works well for <50 projects
- Add search if project list grows

**Future Enhancement Pattern:**
```tsx
// When project list exceeds ~20 items
<Combobox
  value={selectedProject}
  onChange={setSelectedProject}
  options={projects}
  searchable
  placeholder="Search projects..."
/>
```

#### 5. Description Field

**Best Practice:** Optional textarea with auto-expand
- Keep optional (not all time entries need descriptions)
- Use `<textarea>` with `rows={2}` initially
- Auto-expand as user types (or use `contenteditable`)

### Form Layout

**Recommended Structure:**
```
┌─────────────────────────────────┐
│  Manual Time Entry              │
├─────────────────────────────────┤
│  Date:        [Calendar Picker] │
│                                 │
│  Entry Mode:  [Duration] [Time] │ <- Toggle
│                                 │
│  {Mode === 'duration' ?         │
│    Duration:  [2.5 hours]       │
│  :                              │
│    Start:     [09:00]           │
│    End:       [11:30]           │
│    Duration:  2.5 hours (auto)  │
│  }                              │
│                                 │
│  Project:     [Select Project▼] │
│                                 │
│  Description: [Optional text... │
│                                ] │
│                                 │
│  Source:      ● Manual Entry    │ <- Read-only badge
│                                 │
│  [Cancel]           [Add Entry] │
└─────────────────────────────────┘
```

### Validation Requirements

| Field | Validation | Error Message |
|-------|------------|---------------|
| Date | Required, not in future | "Date cannot be in the future" |
| Duration | Required, > 0, < 24 hours | "Duration must be between 0 and 24 hours" |
| Start/End | End > Start | "End time must be after start time" |
| Project | Required | "Please select a project" |
| Description | Optional, max 500 chars | - |

### Form Validation Library

**Recommendation:** `React Hook Form` + `Zod`

**Why:**
- Minimal re-renders (performance)
- TypeScript-first with Zod schemas
- Built-in validation
- Easy async validation

**Example:**
```typescript
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const entrySchema = z.object({
  date: z.date().max(new Date(), "Cannot be in future"),
  duration: z.number().min(0.01).max(24),
  project: z.string().min(1, "Project required"),
  description: z.string().max(500).optional(),
});

type EntryForm = z.infer<typeof entrySchema>;

function ManualEntryForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
  });

  const onSubmit = (data: EntryForm) => {
    // Create entry
  };

  return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
}
```

**Alternative:** Native HTML5 validation
- Use `required`, `min`, `max`, `pattern` attributes
- Works for simple forms
- Less flexible than React Hook Form

---

## Implementation Recommendations

### Phase 1: Manual Entry (Highest Priority)

**Why first:** Table stakes feature, unblocks user workflows

**Implementation:**
1. Add "New Entry" button to dashboard header
2. Create modal with form (reuse EditModal pattern)
3. Duration input with flexible parsing
4. Validation with React Hook Form + Zod
5. API endpoint: `POST /api/entries`

**Complexity:** Low (1-2 days)

### Phase 2: CSV Export (High Priority)

**Why second:** Simple, high-value feature

**Implementation:**
1. Add "Export CSV" button to table header
2. Use `export-to-csv` library or Blob API
3. Include filtered entries only
4. Format: Date, Source, Project, Description, Duration

**Complexity:** Low (0.5-1 day)

### Phase 3: Dark Mode (Medium Priority)

**Why third:** Polish feature, enhances UX

**Implementation:**
1. Enable `darkMode: 'class'` in Tailwind config
2. Create `useTheme` hook
3. Add dark mode variants to components systematically
4. Update Recharts colors for dark mode
5. Add theme toggle button to header

**Complexity:** Medium (2-3 days for full coverage)

### Phase 4: PDF Export (Lower Priority)

**Why last:** Complex, nice-to-have

**Implementation:**
1. Install Puppeteer on backend
2. Create print-friendly report template
3. Backend endpoint: `GET /api/export/pdf`
4. Stream PDF response to client

**Complexity:** Medium-High (2-3 days)

---

## Libraries to Install

### Frontend (React)
```bash
npm install export-to-csv          # CSV export
npm install react-hook-form zod    # Form validation
npm install @hookform/resolvers    # Zod + React Hook Form integration
```

### Backend (Node.js)
```bash
npm install puppeteer              # PDF generation
```

### Already Installed (Leverage Existing)
- `react-day-picker` - Date selection
- `lucide-react` - Icons (add Moon/Sun for theme toggle)
- `tailwindcss` - Dark mode built-in
- `csv-parse` - Already using for import (csv ecosystem)

---

## Architecture Considerations

### API Endpoints to Add

```typescript
// Manual entry creation
POST /api/entries
Body: { date, duration, project, description, source: 'MANUAL' }

// CSV export (optional server-side)
GET /api/export/csv?startDate=...&endDate=...&source=...

// PDF export (server-side with Puppeteer)
GET /api/export/pdf?startDate=...&endDate=...&source=...
Response: application/pdf (stream)
```

### Database Schema (Existing Prisma)

Your `TimeEntry` model already supports manual entries:
- `source` field can be 'MANUAL' (add to enum if not present)
- All required fields exist
- No schema changes needed

**Recommendation:** Add source type if not present:
```prisma
enum Source {
  TOGGL
  TEMPO
  MANUAL  // Add this
}
```

### State Management

**Current:** useState hooks (sufficient for current scale)

**Recommendation:** Continue with local state
- Form state: React Hook Form
- Theme state: localStorage + custom hook
- No need for Redux/Zustand at current complexity

---

## Pitfalls to Avoid

### CSV Export
- **CSV Injection:** Sanitize data (escape leading `=`, `+`, `-`, `@`)
- **Large Datasets:** Add pagination or warning for >10k rows
- **Character Encoding:** Use UTF-8 BOM for Excel compatibility

### PDF Export
- **Memory Leaks:** Always close Puppeteer browser instances
- **Timeouts:** Set reasonable timeout (30s) for PDF generation
- **Concurrent Requests:** Limit concurrent Puppeteer instances (use queue)

### Dark Mode
- **Flash of Wrong Theme:** Set class before React hydration
- **Chart Colors:** Update all chart components for both themes
- **Contrast:** Test accessibility (use Chrome DevTools contrast checker)

### Manual Entry
- **Timezone Issues:** Store in UTC, display in user's timezone
- **Duplicate Prevention:** Validate for overlapping time entries
- **Validation UX:** Show inline errors, not just on submit

---

## Testing Checklist

### Manual Entry Form
- [ ] Can create entry with duration format "2.5"
- [ ] Can create entry with duration format "2h 30m"
- [ ] Can create entry with start/end times
- [ ] Cannot create entry in future
- [ ] Cannot create entry with duration > 24h
- [ ] Form validates required fields
- [ ] Successfully saves to database
- [ ] Appears in dashboard immediately

### CSV Export
- [ ] Exports all filtered entries
- [ ] Respects date range filter
- [ ] Respects source filter
- [ ] Includes correct headers
- [ ] Opens properly in Excel
- [ ] Handles special characters (commas, quotes)
- [ ] German locale decimal formatting

### Dark Mode
- [ ] Persists across page reloads
- [ ] Respects system preference on first visit
- [ ] All text is readable in both modes
- [ ] Charts are visible in both modes
- [ ] No flash on page load

### PDF Export
- [ ] Generates valid PDF
- [ ] Includes chart visualization
- [ ] Includes table data
- [ ] Respects date range
- [ ] Downloads with correct filename
- [ ] Handles timeout gracefully

---

## Sources

### Time Tracking Dashboard Features
- [9 Best Time Tracking Apps In 2026](https://thebusinessdive.com/time-tracking-apps)
- [Time Tracking in Chronic Care Management: Best Practices & Tools for 2026](https://circle.healthcare/blogs/chronic-care-management-time-tracking-best-practices/)
- [13 Best Time Tracking Apps Compared for 2026](https://tivazo.com/best-time-tracking-apps/)
- [Toggl Track: Time Tracking Software](https://toggl.com/)
- [Best Time Tracking Apps: 2025 Time Tracker App Breakdown](https://clockify.me/best-time-tracking-apps)
- [Harvest vs Toggl: Time Tracking Comparison (2026)](https://efficient.app/compare/harvest-vs-toggl)

### CSV/PDF Export
- [The 5 Node.js PDF Libraries Every Developer Must Know](https://dev.to/xeshan6981/the-5-nodejs-pdf-libraries-every-developer-must-know-4b39)
- [export-to-csv - npm](https://www.npmjs.com/package/export-to-csv)
- [Best HTML to PDF libraries for Node.js](https://blog.logrocket.com/best-html-pdf-libraries-node-js/)
- [React CSV Best Practices](https://www.dhiwise.com/post/react-csv-best-practices-optimizing-performance)
- [Implementing CSV Data Export in React Without External Libraries](https://dev.to/graciesharma/implementing-csv-data-export-in-react-without-external-libraries-3030)
- [PDF Generation from HTML: Puppeteer, Playwright, and wkhtmltopdf Comparison](https://medium.com/@coders.stop/pdf-generation-from-html-i-tested-puppeteer-playwright-and-wkhtmltopdf-so-you-dont-have-to-d14228d28c4c)

### Dark Mode
- [Dark mode - Tailwind CSS Official Docs](https://tailwindcss.com/docs/dark-mode)
- [Dark mode in React: An in-depth guide](https://blog.logrocket.com/dark-mode-react-in-depth-guide/)
- [How to Implement Dark Mode in React with Tailwind CSS](https://medium.com/@mustafamulla765/how-to-implement-dark-mode-in-react-with-tailwind-css-94df7522ed82)
- [Create a Persisting Dark Mode with React](https://www.pullrequest.com/blog/create-a-persisting-dark-mode-with-react/)

### Manual Entry UI Patterns
- [Time Picker UX: Best Practices, Patterns & Trends for 2025](https://www.eleken.co/blog-posts/time-picker-ux)
- [Harvest's two timer modes: Duration & Start and End Times](https://www.getharvest.com/blog/timer-mode)
- [Form UI Design: A UX/UI Guide](https://designlab.com/blog/form-ui-design-best-practices)
- [React Form Validation: Real-time Validation to Complex Forms](https://medium.com/@dlrnjstjs/react-form-validation-from-real-time-validation-to-complex-forms-b23e49233be2)
- [React Hook Form Official Docs](https://react-hook-form.com/)

### Component Libraries
- [React Date Picker component - MUI X](https://mui.com/x/react-date-pickers/date-picker/)
- [Date Picker Component for React | React DayPicker](https://daypicker.dev/)

---

## Conclusion

All four feature areas have clear, well-established implementation patterns with strong library support. The recommended stack integrates seamlessly with your existing architecture (React + Tailwind + Fastify + Prisma).

**Next Steps:**
1. Install recommended libraries
2. Implement manual entry form (highest priority)
3. Add CSV export (quick win)
4. Implement dark mode (UX polish)
5. Add PDF export (nice-to-have)

**Confidence Assessment:**
- **CSV Export:** HIGH - Simple, proven patterns
- **Dark Mode:** HIGH - Tailwind built-in, well-documented
- **Manual Entry:** HIGH - Standard form patterns
- **PDF Export:** MEDIUM - Puppeteer adds complexity but is well-supported

The research is comprehensive and ready to guide implementation.
