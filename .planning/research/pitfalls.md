# Pitfalls Research: Adding Utility Meter Tracking to Existing Dashboard

**Domain:** Utility meter tracking with OCR added to existing time tracking dashboard
**Tech Stack:** React, Fastify, PostgreSQL, Prisma ORM, Docker Compose, Hetzner deployment
**Researched:** 2026-02-06
**Confidence:** MEDIUM-HIGH

Research combines official documentation, industry best practices, and technical constraints specific to adding meter reading features (OCR, Excel import, advanced charting) to an existing React+Fastify+PostgreSQL time tracking application.

---

## Critical Pitfalls

These mistakes cause rewrites, data loss, or major architectural changes.

### 1. OCR Accuracy Overconfidence

**What goes wrong:** Assuming OCR will "just work" for German utility meters leads to production system with 55-63% accuracy (research shows this is realistic for digital displays), causing massive manual correction burden.

**Why it happens:**
- Tesseract defaults trained on text, not seven-segment displays
- Phone photos have variable lighting, angles, reflections on meter glass
- Seven-segment digits easily misread (8→0, 5→6, 1→7)
- Digital LED displays have background artifacts, decimal points, unit indicators

**Consequences:**
- User frustration with constant corrections
- Data integrity compromised (garbage in, garbage out)
- Users abandon OCR feature, system becomes manual-entry-only
- Incorrect consumption calculations from bad readings
- Loss of trust in the application

**Prevention:**
1. Use specialized training data for seven-segment displays
2. Implement preprocessing pipeline before OCR
3. Add confidence thresholds (reject readings below 85%)
4. Always show extracted value for user verification
5. Build manual correction UI from day one

```typescript
// Image preprocessing pipeline
import sharp from 'sharp';

async function preprocessMeterImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .grayscale() // Remove color noise
    .normalize() // Improve contrast
    .threshold(128) // Binarize image
    .toBuffer();
}

// OCR with confidence checking
import Tesseract from 'tesseract.js';

async function extractMeterReading(imagePath: string): Promise<{ value: number, confidence: number }> {
  const { data: { text, confidence } } = await Tesseract.recognize(
    imagePath,
    'eng',
    {
      tessedit_char_whitelist: '0123456789.',
      tessdata_dir: './tessdata_ssd' // Seven-segment display training data
    }
  );

  const value = parseFloat(text.trim());

  if (confidence < 85) {
    throw new Error(`Low confidence reading: ${confidence}%. Manual verification required.`);
  }

  return { value, confidence };
}

// Always require user confirmation
app.post('/api/meters/ocr', async (req, res) => {
  const { imagePath } = req.body;
  const { value, confidence } = await extractMeterReading(imagePath);

  // Return for user confirmation, don't auto-save
  return res.send({
    extractedValue: value,
    confidence,
    requiresConfirmation: true,
    message: `Detected reading: ${value} kWh (${confidence.toFixed(1)}% confidence)`
  });
});
```

**Detection:**
- OCR extraction returns obviously wrong values (consumption negative, reading decreased)
- User corrections exceed 30% of OCR attempts
- High rate of rejected images
- Confidence scores consistently below 85%

**Phase to address:** Phase 1 (MVP) - OCR must be reliable or don't ship it

**Sources:**
- [MDPI: Smart OCR Application for Meter Reading](https://www.mdpi.com/2673-4591/20/1/25) - Documents 55-63% accuracy for digital meters
- [GitHub: tessdata_ssd](https://github.com/Shreeshrii/tessdata_ssd) - Seven-segment display training data
- [Medium: Digital meter reading using CV & ML](https://medium.com/@oviyum/digital-meter-reading-using-cv-ml-53b71f25ed91) - Image quality challenges
- [Tesseract OCR Guide 2026](https://unstract.com/blog/guide-to-optical-character-recognition-with-tesseract-ocr/) - Current best practices

---

### 2. Meter Reading Data Integrity Violations

**What goes wrong:** Storing raw readings without monotonic increase validation allows physically impossible data (readings decrease, consumption negative). Once in database, corrupts all downstream charts and calculations.

**Why it happens:**
- Developers treat meter readings like regular timestamps/floats
- No database constraints enforce business rules (readings must increase)
- Import accepts Excel data without validation
- OCR errors pass through unchecked
- User typos in manual entry not caught

**Consequences:**
- Negative consumption breaks cost calculations
- Charts show impossible usage spikes/drops
- Year-over-year comparisons meaningless
- Cannot trust historical data after backfill
- Cost projections wildly inaccurate

**Prevention:**

```prisma
// Schema with proper constraints
model MeterReading {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  meterType   String   // "STROM" | "GAS" | "WASSER_WARM"
  readingDate DateTime @db.Timestamptz(6)
  reading     Float    // Cumulative kWh/m³
  consumption Float?   // Computed delta (nullable for first reading)
  imagePath   String?  // Path to meter photo
  source      String   @default("MANUAL") // "MANUAL" | "OCR" | "EXCEL_IMPORT"
  verified    Boolean  @default(false) // User confirmed reading
  notes       String?
  createdAt   DateTime @default(now()) @db.Timestamptz(6)

  @@unique([meterType, readingDate])
  @@index([meterType, readingDate])
}
```

```typescript
// Validation function
async function validateMeterReading(
  meterType: string,
  readingDate: Date,
  reading: number
): Promise<void> {
  // Get previous reading
  const previousReading = await prisma.meterReading.findFirst({
    where: {
      meterType,
      readingDate: { lt: readingDate }
    },
    orderBy: { readingDate: 'desc' }
  });

  if (previousReading) {
    // Reading must increase
    if (reading <= previousReading.reading) {
      throw new ValidationError(
        `Reading ${reading} must be greater than previous reading ` +
        `${previousReading.reading} from ${previousReading.readingDate.toISOString()}`
      );
    }

    // Check for unrealistic jumps (>10x monthly average)
    const consumption = reading - previousReading.reading;
    const daysDiff = (readingDate.getTime() - previousReading.readingDate.getTime()) / (1000 * 60 * 60 * 24);
    const monthlyAverage = (consumption / daysDiff) * 30;

    // Get historical average for this meter
    const historicalAvg = await getMonthlyAverage(meterType);

    if (monthlyAverage > historicalAvg * 10) {
      throw new ValidationError(
        `Consumption unusually high: ${consumption.toFixed(1)} ${getUnit(meterType)}. ` +
        `This is ${(monthlyAverage / historicalAvg).toFixed(1)}x your average. ` +
        `Please verify reading is correct.`
      );
    }
  }
}

// Database trigger for extra safety
CREATE OR REPLACE FUNCTION validate_meter_reading()
RETURNS TRIGGER AS $$
DECLARE
  prev_reading FLOAT;
BEGIN
  SELECT reading INTO prev_reading
  FROM "MeterReading"
  WHERE "meterType" = NEW."meterType"
    AND "readingDate" < NEW."readingDate"
  ORDER BY "readingDate" DESC
  LIMIT 1;

  IF prev_reading IS NOT NULL AND NEW.reading <= prev_reading THEN
    RAISE EXCEPTION 'Reading must be greater than previous reading %', prev_reading;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_meter_reading_monotonic
BEFORE INSERT OR UPDATE ON "MeterReading"
FOR EACH ROW
EXECUTE FUNCTION validate_meter_reading();
```

**Detection:**
- Negative consumption values in database
- Chart anomalies (impossible drops)
- Consumption calculation returns negative
- Cost calculations show refunds when impossible

**Phase to address:** Phase 0 (Schema Design) - Must be in initial schema

**Sources:**
- [Home Assistant: Utility Meter](https://www.home-assistant.io/integrations/utility_meter/) - Monotonic increase handling
- [Itron: Reading validation](https://docs.itrontotal.com/IEEMDM/Content/Topics/252929.htm) - Industry validation standards
- [PNNL: Meter Data Analysis](https://www.pnnl.gov/main/publications/external/technical_reports/PNNL-24331.pdf) - Validation methodologies

---

### 3. Image Storage Architecture Wrong from Start

**What goes wrong:** Storing meter photos as PostgreSQL BYTEA bloats database from <50MB to >5GB for single user's 3 years of monthly photos. Database backups take 100x longer, Prisma queries slow down, Docker volumes fill up.

**Why it happens:**
- "Just store in database" seems simple
- Developers don't anticipate volume (36 photos/year × 3 meters × 8 years = 864 photos at ~5MB each = 4.3GB)
- Prisma makes BYTEA storage "easy" but hides consequences
- No experience with image-heavy applications
- Existing system has no file storage setup

**Consequences:**
- Database backups from 2 minutes to 2+ hours
- Increased RAM usage (Prisma loads images into memory)
- Slower queries (large rows affect even non-image queries)
- Difficult to serve images efficiently (no CDN)
- Docker volume storage limits hit
- Database maintenance becomes expensive

**Prevention:**

```typescript
// File storage configuration
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuid } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads/meters';

async function saveMeterImage(
  buffer: Buffer,
  meterType: string,
  readingDate: Date
): Promise<string> {
  // Organize by year/month for easy browsing
  const year = readingDate.getFullYear();
  const month = String(readingDate.getMonth() + 1).padStart(2, '0');
  const filename = `${meterType}-${year}${month}-${uuid()}.jpg`;
  const relativePath = `${year}/${month}/${filename}`;
  const fullPath = path.join(UPLOAD_DIR, relativePath);

  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  // Resize and compress before saving
  const optimized = await sharp(buffer)
    .resize(1080, null, { withoutEnlargement: true }) // Max 1080px width
    .jpeg({ quality: 85 }) // Compress
    .toBuffer();

  await fs.writeFile(fullPath, optimized);

  return relativePath; // Store relative path in database
}

// Serve images through authenticated endpoint
app.get('/api/meters/images/:year/:month/:filename', async (req, res) => {
  // Verify authentication
  if (!req.session?.userId) {
    return res.status(401).send({ error: 'Unauthorized' });
  }

  const { year, month, filename } = req.params;
  const filePath = path.join(UPLOAD_DIR, year, month, filename);

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return res.status(404).send({ error: 'Image not found' });
    }

    // Send file with caching headers
    res.header('Content-Type', 'image/jpeg');
    res.header('Cache-Control', 'private, max-age=31536000'); // 1 year

    const stream = await fs.readFile(filePath);
    return res.send(stream);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).send({ error: 'Image not found' });
    }
    throw error;
  }
});
```

```yaml
# docker-compose.yml - Add volume for images
services:
  backend:
    volumes:
      - meter-images:/app/uploads/meters
    environment:
      - UPLOAD_DIR=/app/uploads/meters

volumes:
  meter-images:
    driver: local
```

**Schema:**
```prisma
model MeterReading {
  id        String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  imagePath String? // "2025/01/STROM-202501-abc123.jpg"
  // NOT: imageData Bytes
}
```

**Detection:**
- Database file size growing >100MB for single user
- Slow query performance
- Backup duration increases
- Docker storage warnings
- `docker system df` shows large volumes

**Phase to address:** Phase 0 (Architecture) - Wrong from day one = expensive migration

**Sources:**
- [PostgreSQL: BinaryFilesInDB](https://wiki.postgresql.org/wiki/BinaryFilesInDB) - Official guidance against storing large files
- [Sling Academy: PostgreSQL image storage](https://www.slingacademy.com/article/postgresql-how-to-store-images-in-database-and-why-you-shouldnt/) - Performance implications
- [Medium: Optimizing Image Storage in PostgreSQL](https://medium.com/@ajaymaurya73130/optimizing-image-storage-in-postgresql-tips-for-performance-scalability-fd4d575a6624) - Best practices
- [Maxim Orlov: Why Storing Files in Database Is Bad Practice](https://maximorlov.com/why-storing-files-database-bad-practice/)

---

### 4. Excel Date Parsing Locale/Format Chaos

**What goes wrong:** User's historical Excel has German date formats (dd.MM.yyyy), mixed with ISO dates from exports, some cells formatted as text. Import succeeds but creates data 6 months off (month/day swap), or rejects 80% of rows.

**Why it happens:**
- Excel stores dates as numbers (days since 1900-01-01) but displays per locale
- German system shows "31.12.2025" but exports as "12/31/2025" or "2025-12-31"
- CSV export depends on Excel's language settings
- Text-formatted dates don't parse as dates
- Timezone not stored (assumes UTC, but user means local)
- User's historical data has inconsistent formatting across years

**Consequences:**
- June reading imported as December
- All historical data off by 6 months
- Cost calculations wrong for entire history
- User doesn't notice until comparing charts to utility bills
- Year-over-year comparisons completely wrong

**Prevention:**

```typescript
import { parse, isValid, parseISO } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const GERMAN_TIMEZONE = 'Europe/Berlin';

// Try multiple date formats
const DATE_FORMATS = [
  'dd.MM.yyyy',      // German: 31.12.2025
  'yyyy-MM-dd',      // ISO: 2025-12-31
  'MM/dd/yyyy',      // US: 12/31/2025
  'dd/MM/yyyy',      // EU: 31/12/2025
  'd.M.yyyy',        // German without leading zero: 1.1.2025
  'dd-MM-yyyy',      // Alternative: 31-12-2025
];

function parseExcelDate(value: string | number, userTimezone: string = GERMAN_TIMEZONE): Date | null {
  // Handle Excel numeric date (days since 1900-01-01)
  if (typeof value === 'number') {
    // Excel incorrectly thinks 1900 was a leap year
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const date = new Date(excelEpoch.getTime() + value * 86400000);

    // Convert to user's timezone
    return zonedTimeToUtc(date, userTimezone);
  }

  // Handle string dates
  const trimmed = value.trim();

  // Try ISO format first (fastest)
  try {
    const isoDate = parseISO(trimmed);
    if (isValid(isoDate)) {
      return zonedTimeToUtc(isoDate, userTimezone);
    }
  } catch {}

  // Try each format
  for (const format of DATE_FORMATS) {
    try {
      const parsed = parse(trimmed, format, new Date());
      if (isValid(parsed)) {
        return zonedTimeToUtc(parsed, userTimezone);
      }
    } catch {}
  }

  return null; // Could not parse
}

// Excel import with validation preview
interface ExcelImportRow {
  date: string;
  reading: string | number;
  notes?: string;
}

app.post('/api/meters/import/preview', async (req, res) => {
  const { file, meterType } = req.body;

  // Parse first 10 rows for preview
  const rows = await parseExcelFile(file);
  const preview = rows.slice(0, 10);

  const parsed = preview.map((row, index) => {
    const date = parseExcelDate(row.date);
    const reading = parseFloat(String(row.reading).replace(',', '.'));

    return {
      rowNumber: index + 2, // Excel row (1-indexed + header)
      original: row,
      parsed: {
        date: date?.toISOString(),
        reading,
      },
      errors: [
        ...(!date ? ['Could not parse date'] : []),
        ...(isNaN(reading) ? ['Could not parse reading'] : []),
      ]
    };
  });

  const errorCount = parsed.filter(p => p.errors.length > 0).length;

  return res.send({
    preview: parsed,
    totalRows: rows.length,
    errorCount,
    estimatedErrorRate: (errorCount / preview.length) * 100,
    recommendation: errorCount > 0
      ? 'Some rows have errors. Please fix date format in Excel and re-upload.'
      : 'All preview rows look good. Ready to import.',
  });
});

// Full import with proper error handling
app.post('/api/meters/import', async (req, res) => {
  const { file, meterType } = req.body;
  const rows = await parseExcelFile(file);

  const results = {
    imported: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const [index, row] of rows.entries()) {
    try {
      const date = parseExcelDate(row.date);
      if (!date) {
        results.errors.push(`Row ${index + 2}: Could not parse date "${row.date}"`);
        results.skipped++;
        continue;
      }

      const reading = parseFloat(String(row.reading).replace(',', '.'));
      if (isNaN(reading)) {
        results.errors.push(`Row ${index + 2}: Could not parse reading "${row.reading}"`);
        results.skipped++;
        continue;
      }

      // Validate against previous reading
      await validateMeterReading(meterType, date, reading);

      // Calculate consumption
      const previousReading = await prisma.meterReading.findFirst({
        where: { meterType, readingDate: { lt: date } },
        orderBy: { readingDate: 'desc' }
      });

      const consumption = previousReading
        ? reading - previousReading.reading
        : null;

      await prisma.meterReading.create({
        data: {
          meterType,
          readingDate: date,
          reading,
          consumption,
          source: 'EXCEL_IMPORT',
          notes: row.notes,
          verified: false, // Require user verification
        }
      });

      results.imported++;
    } catch (error) {
      results.errors.push(`Row ${index + 2}: ${error.message}`);
      results.skipped++;
    }
  }

  return res.send(results);
});
```

**Detection:**
- Dates imported 6 months offset
- Winter/summer consumption reversed
- Validation rejects most rows
- User reports "wrong months"
- Charts don't match utility bills

**Phase to address:** Phase 1 (Excel Import) - Test with real user data before shipping

**Sources:**
- [Exceljet: Convert UTC timestamp](https://exceljet.net/formulas/convert-utc-timestamp-to-excel-datetime) - Excel date representation
- [XlsxWriter: Dates and Times](https://xlsxwriter.readthedocs.io/working_with_dates_and_time.html) - Timezone handling
- [ExtendOffice: Convert date time to timezone](https://www.extendoffice.com/documents/excel/3609-excel-convert-date-to-timezone.html) - Locale issues
- [Flatfile: Top Excel import errors](https://flatfile.com/blog/the-top-excel-import-errors-and-how-to-fix-them/)

---

### 5. Recharts Performance Cliff with Multi-Year Data

**What goes wrong:** Chart with 8 years × 12 months × 3 meters = 288 data points renders fine. Add 7 chart types × 288 points = 2016 DOM elements. Page freezes for 3+ seconds on every filter change. User perceives app as "broken."

**Why it happens:**
- Recharts re-renders all charts on any state change
- No memoization of chart configurations
- React Context re-renders all consumers on meter selection change
- Each chart calculates aggregations on every render
- DOM manipulation for 2000+ SVG elements is slow
- Existing app uses Context for theme state, extending pattern for meter data

**Consequences:**
- Unusable dashboard (3+ second lag on every interaction)
- User frustration leads to abandonment
- Mobile devices worse (10+ seconds)
- Browser tab crashes on older hardware
- Negative perception of entire app

**Prevention:**

```typescript
// 1. Memoize chart data computation
import { useMemo } from 'react';

function MeterCharts({ readings, meterType, dateRange }: Props) {
  // Expensive aggregation - only recalculate when dependencies change
  const chartData = useMemo(() => {
    return aggregateByMonth(readings, meterType);
  }, [readings, meterType]); // NOT on every render

  // Memoize chart configuration
  const chartConfig = useMemo(() => ({
    data: chartData,
    xAxis: { dataKey: 'month', type: 'category' },
    yAxis: { domain: [0, 'auto'] },
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
  }), [chartData]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart {...chartConfig}>
        <XAxis dataKey="month" />
        <YAxis />
        <Line type="monotone" dataKey="consumption" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// 2. Use Zustand instead of Context for filter state
// Prevents re-rendering all charts when one filter changes
import create from 'zustand';

interface MeterFilterState {
  selectedMeter: string;
  dateRange: [Date, Date];
  setMeter: (meter: string) => void;
  setDateRange: (range: [Date, Date]) => void;
}

const useMeterStore = create<MeterFilterState>((set) => ({
  selectedMeter: 'STROM',
  dateRange: [
    new Date(new Date().getFullYear(), 0, 1), // Jan 1 this year
    new Date()
  ],
  setMeter: (meter) => set({ selectedMeter: meter }),
  setDateRange: (range) => set({ dateRange: range }),
}));

// In components - only re-renders when specific state changes
function YearOverYearChart() {
  const selectedMeter = useMeterStore(state => state.selectedMeter);
  // Component only re-renders when selectedMeter changes
  // NOT when dateRange changes
}

// 3. Lazy load chart types (code splitting)
import { lazy, Suspense } from 'react';

const YearOverYearChart = lazy(() => import('./charts/YearOverYear'));
const TrendChart = lazy(() => import('./charts/Trend'));
const HeatmapChart = lazy(() => import('./charts/Heatmap'));

function MeterDashboard() {
  const [activeChart, setActiveChart] = useState('year-over-year');

  return (
    <div>
      <ChartSelector active={activeChart} onChange={setActiveChart} />

      <Suspense fallback={<ChartSkeleton />}>
        {activeChart === 'year-over-year' && <YearOverYearChart />}
        {activeChart === 'trend' && <TrendChart />}
        {activeChart === 'heatmap' && <HeatmapChart />}
      </Suspense>
    </div>
  );
}

// 4. Aggregate data server-side for large ranges
app.get('/api/meters/aggregated', async (req, res) => {
  const { meterType, startDate, endDate, granularity } = req.query;

  // Don't send 2000 daily readings, send 96 monthly aggregates
  const aggregated = await prisma.$queryRaw`
    SELECT
      DATE_TRUNC(${granularity}, "readingDate") as period,
      SUM(consumption) as total_consumption,
      AVG(consumption) as avg_consumption,
      COUNT(*) as reading_count
    FROM "MeterReading"
    WHERE "meterType" = ${meterType}
      AND "readingDate" BETWEEN ${startDate} AND ${endDate}
    GROUP BY period
    ORDER BY period
  `;

  return res.send(aggregated);
});

// 5. Use React.memo to prevent unnecessary component renders
import React from 'react';

const MeterChart = React.memo(({ data, config }: Props) => {
  console.log('Chart rendering'); // Should only log when data/config changes

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} {...config}>
        {/* ... */}
      </LineChart>
    </ResponsiveContainer>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if data actually changed
  return (
    prevProps.data === nextProps.data &&
    prevProps.config === nextProps.config
  );
});
```

**Detection:**
- React DevTools Profiler shows >100ms render times
- Page unresponsive during filter changes
- Browser console warnings about slow renders
- High CPU usage in profiler
- Chrome DevTools Performance tab shows long tasks

**Phase to address:** Phase 2 (Chart Implementation) - Build performance testing from start

**Sources:**
- [Recharts GitHub: Large datasets cause performance issues](https://github.com/recharts/recharts/issues/1465)
- [Recharts Performance Guide](https://recharts.github.io/guide/performance/)
- [LogRocket: React chart libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [State Management in 2026](https://thelinuxcode.com/state-management-in-react-2026-hooks-context-api-and-redux-in-practice/)
- [Refine: Create charts using Recharts](https://refine.dev/blog/recharts/)

---

## Technical Debt Patterns

Shortcuts that create future pain.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip image preprocessing before OCR | Ship OCR feature faster | OCR accuracy 55% instead of 85%, user corrections, abandonment | Never - preprocessing is table stakes |
| Store consumption instead of readings | Simpler schema | Cannot recalculate, cannot detect reading errors, data integrity impossible | Never - readings are source of truth |
| No database-level validation | Faster development | Bad data enters system, corrupts calculations, requires data cleanup scripts | Never - validation is foundational |
| Use React Context for chart filters | Simple state management | All charts re-render on filter change, 3+ second lag | MVP only, refactor by Phase 2 |
| Tesseract default models | No training data needed | 55% accuracy, requires manual correction | Never - need tessdata_ssd |
| Store images in PostgreSQL | No file storage to configure | Database bloat, slow backups, scaling issues | Never - file system is correct choice |
| Single date format in Excel parser | Works for your test data | Import fails for real user data with German formats | Never - German users need dd.MM.yyyy |
| Client-side consumption calculation | No backend logic needed | Inconsistent calculations, cannot change formula | MVP only, move to database triggers |
| No anomaly detection thresholds | Ship feature faster | 50% false positives, user ignores anomalies | MVP acceptable if marked "experimental" |
| Manual chart data aggregation | Full control over logic | Re-renders on every state change, performance cliff | Acceptable if memoized properly |
| Merge meter features into existing routes | Faster to ship | REST API becomes cluttered, hard to version | Acceptable for MVP, refactor later |
| No undo for Excel import | Simpler implementation | Wrong file imported, must manually delete 300+ rows | Never - undo is critical for bulk operations |
| Client-side image resize | No server CPU usage | Large uploads on slow connections, browser memory issues | Acceptable for MVP, optimize later |

---

## Integration Gotchas

Mistakes when adding meter features to existing time tracking system.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|---------------|------------------|
| **Database Schema** | Add meter tables without migration strategy | Use Prisma baselining, add tables without touching existing TimeEntry model |
| **Authentication** | Create separate auth for meter features | Reuse existing JWT auth from time tracking |
| **Fastify Routes** | Add /meters routes without rate limiting | Apply existing @fastify/rate-limit (already in project), especially for image upload |
| **Frontend Layout** | Build separate meter dashboard | Extend existing dashboard with tabs/sections, reuse ThemeToggle, Toast, auth context |
| **Date Handling** | Mix Date and DateTime types | Use existing date-fns + date-fns-tz pattern from time tracking (already in package.json) |
| **State Management** | Introduce Redux for meter state | Use existing React patterns (useState/Context from useTheme.tsx), only add Zustand if performance requires |
| **Styling** | Add new CSS framework for charts | Use existing Tailwind classes, extend tailwind.config.js |
| **API Error Handling** | Different error format for meter endpoints | Match existing error format from time tracking API |
| **Docker Compose** | Separate database for meter data | Use existing PostgreSQL container, add volume mount for images |
| **Image Upload** | New multipart handler | Use existing @fastify/multipart (already in package.json v8.3.0), configure limits |
| **Validation** | Introduce Yup for meter validation | Use existing Zod (fastify-type-provider-zod already in project v2.1.0) |
| **Toast Notifications** | Different notification system | Use existing useToast.tsx hook from time tracking |
| **Component Library** | Import UI library for meters | Reuse existing components (CustomSelect.tsx, etc.) |
| **Navigation** | Add separate nav for meters | Extend existing App.tsx routing pattern |

---

## Performance Traps

Patterns that seem fine initially but break at scale.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Loading all photos on dashboard** | Page load 10+ seconds, browser memory spike | Load photo thumbnails only, full size on click | >50 photos |
| **Recalculating consumption on every render** | Lag on filter changes | Calculate in Prisma query or database trigger, not React component | >100 readings |
| **No chart data pagination** | Page unresponsive | Virtual scrolling or server-side aggregation | >500 data points per chart |
| **OCR processing on main thread** | UI frozen during processing | Use Web Workers or backend processing | Any OCR usage |
| **No image size limit** | Slow uploads, storage explosion | Resize to 1080px before upload (client-side), reject >5MB | First 10MB upload |
| **Synchronous Excel parsing** | Browser freeze on large files | Stream parsing with csv-parse (already in project v5.5.6) | Files >1000 rows |
| **All chart types rendered simultaneously** | 3+ second initial load | Lazy load charts, render visible tab only | >3 chart types |
| **No database indexes on meter_id + date** | Slow consumption queries | Add compound index `@@index([meterType, readingDate])` in Prisma schema | >1000 readings |
| **Client-side anomaly detection** | Page freeze on large datasets | Calculate anomalies server-side, cache results | >200 data points |
| **No request timeout on OCR** | Hung requests, memory leak | Set 30s timeout for OCR processing | First complex image |
| **Storing full-res images (5MB+)** | Storage fills quickly | Resize to 1080px max width, compress to 85% quality | After 50 photos |
| **No caching of aggregated data** | Same query runs 100x/day | Cache monthly aggregates with 1-hour TTL | >10 users (future) |
| **Fetching all readings on page load** | Slow initial load | Default to last 12 months, lazy load older data | >500 readings |

---

## Security Mistakes

Security vulnerabilities specific to meter tracking features.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **No file type validation on image upload** | Upload executable as .jpg, RCE vulnerability | Validate MIME type + file signature (magic bytes), not just extension |
| **Store meter images world-readable** | Privacy violation, anyone can see user's meter/address | Authenticate image requests, serve through API with JWT check |
| **No rate limiting on OCR endpoint** | DoS attack, resource exhaustion | Limit to 10 requests/minute per user (use existing @fastify/rate-limit) |
| **Path traversal in image storage** | Upload overwrites system files | Sanitize filenames, use UUIDs, never trust user input |
| **No CSRF protection on Excel upload** | Attacker imports malicious data | Use existing @fastify/secure-session CSRF tokens |
| **Expose image filesystem paths in API** | Information disclosure | Return image IDs, serve through /api/images/:id |
| **No max file size on Excel import** | Memory exhaustion, DoS | Limit to 10MB, stream parse (csv-parse supports streaming) |
| **SQL injection in consumption query** | Database compromise | Use Prisma (already in project, parameterized queries by default) |
| **No content-type validation** | XSS via SVG upload | Validate Content-Type: image/jpeg or image/png only |
| **Storing cost per kWh without audit trail** | User disputes incorrect calculations | Log all cost configuration changes with timestamp + old/new values |
| **No file cleanup on reading deletion** | Orphaned files, storage leak | Delete image file when reading deleted (database trigger or cascade) |
| **OCR processing user-uploaded script** | Code injection | Sanitize all OCR output, never eval() or execute extracted text |

---

## UX Pitfalls

User experience mistakes that cause frustration.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **OCR extracts value, no confirmation step** | Wrong value saved, user discovers later in charts | Always show extracted value in editable field before save |
| **Bulk Excel import with no preview** | Import 300 rows, realize data is wrong, must delete all | Show first 10 rows preview with detected format before import |
| **No loading indicator during OCR** | User thinks app crashed, clicks button repeatedly | Show progress: "Processing image... 3s" with cancel option |
| **7 chart types visible simultaneously** | Overwhelming, slow performance | Start with 2 most useful charts, others behind "More charts" expansion |
| **Consumption shown to 10 decimal places** | Noise, user can't parse | Round to 1 decimal (123.4 kWh, not 123.4567891234) |
| **Anomaly detection marks winter heating as anomaly** | False positive, user loses trust | Seasonal baseline, mark anomalies >2σ from monthly average, not annual |
| **No undo for Excel import** | Wrong file imported, must manually delete 300+ rows | Add "Undo last import" button (soft delete with import_batch_id) |
| **Image upload fails, no guidance** | "Upload failed", user doesn't know why | "Image too large (8MB). Max 5MB. Try reducing resolution." |
| **Manual reading input requires image** | User wants to enter reading without photo | Make image optional, show warning "No photo for verification" |
| **Chart shows consumption, but user sees readings on meter** | Confusion about cumulative vs delta | Show both: "Reading: 12,345 kWh | Consumption: +234 kWh" |
| **No mobile-optimized photo capture** | User uploads 20MB raw photo, slow upload | Use `<input accept="image/*" capture="environment">` with client-side resize |
| **Date picker defaults to today for historical import** | User must scroll back 8 years for every row | Remember last entered date, increment by 1 month for next row |
| **No visual feedback on monotonic increase violation** | User confused why save failed | "Reading 12,340 kWh is less than previous reading 12,456 kWh on 2025-12-01" |
| **Forecast chart shows 10-year prediction** | Meaningless, user ignores | Limit forecast to 6 months, show confidence interval |
| **Cost overlay assumes fixed rate** | Wrong for users with time-of-use rates | Support rate tiers (day/night) or flat rate with change history |
| **Charts default to all meters combined** | Mixed units (kWh + m³ makes no sense) | Default to single meter, user selects which |
| **No way to delete incorrect OCR attempt** | Gallery cluttered with failed attempts | Allow deleting readings + images, with confirmation |

---

## "Looks Done But Isn't" Checklist

Features that appear complete but miss critical requirements.

- [ ] **OCR extracts numbers** ✓ → But does it handle reflections on meter glass? Rotated images? Partial occlusion?
- [ ] **Excel import works** ✓ → But does it handle German date formats? Missing months? Text-formatted cells? UTF-8 BOM?
- [ ] **Charts render data** ✓ → But do they handle missing months? Single data point? 0 consumption?
- [ ] **Consumption calculated** ✓ → But is it database-level (trigger) or client-side? Can it be recalculated?
- [ ] **Anomaly detection implemented** ✓ → But does it account for seasonality? Adjustable thresholds? False positive rate acceptable?
- [ ] **Image upload working** ✓ → But is there size limit? Format validation? Malicious file handling? Filesystem cleanup on delete?
- [ ] **Meter readings stored** ✓ → But is there monotonic increase validation? Duplicate detection? Timezone handling?
- [ ] **Cost overlay chart** ✓ → But does it use correct date for rate changes? Handle rate increasing mid-month?
- [ ] **Year-over-year comparison** ✓ → But does it align by month (Jan-Jan)? Handle leap years? Missing data?
- [ ] **Manual entry form** ✓ → But does it validate against previous reading? Show last reading for reference? Confirm unusual values?
- [ ] **Database migration** ✓ → But is it reversible? Tested on production-size data? Handles existing TimeEntry rows?
- [ ] **Historical data backfill** ✓ → But is there data validation? Duplicate checking? Audit trail? Bulk undo?
- [ ] **Heatmap shows usage patterns** ✓ → But does it handle single meter? All meters? Missing months show as gaps or 0?
- [ ] **Mobile responsive** ✓ → But can user take photo on phone? Does OCR work on device? Charts readable on small screen?
- [ ] **Error messages shown** ✓ → But are they actionable? Localized (German user expects German)? Show recovery steps?
- [ ] **Authentication reused from time tracking** ✓ → But do meter API endpoints have auth middleware? Image serving authenticated?
- [ ] **Images served** ✓ → But through authenticated endpoint? With caching headers? Thumbnails for gallery?
- [ ] **Consumption query optimized** ✓ → But with database index? Paginated? Date range filter?

---

## Pitfall-to-Phase Mapping

When each pitfall should be addressed to prevent compounding issues.

| Pitfall Category | Prevention Phase | Verification Method |
|------------------|------------------|---------------------|
| **OCR accuracy** | Phase 1 (OCR MVP) | Test with 50 real phone photos, measure accuracy %, user correction rate |
| **Meter reading validation** | Phase 0 (Schema) | Write test: insert reading < previous → expect error |
| **Image storage architecture** | Phase 0 (Architecture) | Load test: upload 100 images, measure database size growth |
| **Excel date parsing** | Phase 1 (Import) | Test with German Excel, US Excel, text-formatted dates, ISO dates |
| **Chart performance** | Phase 2 (Charts) | Load test: render 288 data points × 7 charts, measure render time < 500ms |
| **State management performance** | Phase 2 (Charts) | Profile React DevTools, check re-render count on filter change |
| **Database constraints** | Phase 0 (Schema) | Create SQL function + trigger for monotonic increase before any data inserted |
| **Image file validation** | Phase 1 (Upload) | Pen test: try uploading .exe as .jpg, verify rejection |
| **Rate limiting OCR** | Phase 1 (OCR) | Stress test: 20 concurrent OCR requests, verify rate limit enforced |
| **Client-side image resize** | Phase 1 (Upload) | Test: upload 20MB photo, verify resize to <2MB before upload |
| **Date-fns timezone handling** | Phase 1 (Import) | Test: import "31.12.2025", verify stored as 2025-12-31 in Europe/Berlin |
| **Consumption calculation location** | Phase 0 (Architecture) | Decide: database trigger vs. application logic (recommend trigger) |
| **Prisma migration strategy** | Phase 0 (Schema) | Test: add meter tables to existing DB, verify TimeEntry untouched |
| **Anomaly detection baseline** | Phase 3 (Anomalies) | Test with 2 years winter/summer data, verify seasonal baseline used |
| **Excel import validation preview** | Phase 1 (Import) | User test: import wrong file, verify preview catches it |
| **Integration with existing auth** | Phase 0 (Planning) | Verify: all /api/meters/* routes use existing requireAuth middleware |
| **File storage volume mounts** | Phase 0 (Docker) | Test: restart container, verify images persist |
| **Fastify multipart limits** | Phase 1 (Upload) | Test: upload 6MB file, verify rejected (5MB limit) |

---

## Confidence Assessment

| Research Area | Confidence | Rationale |
|---------------|-----------|-----------|
| OCR accuracy challenges | HIGH | Multiple academic sources + GitHub projects document 55-63% accuracy for digital displays, custom training needed |
| Meter reading data validation | HIGH | Home Assistant + industry meter data management docs provide clear validation patterns |
| Image storage strategy | HIGH | Official PostgreSQL wiki + multiple technical sources agree: don't store large files in database |
| Excel date parsing issues | HIGH | Extensive documentation of Excel date/timezone/locale problems from multiple sources |
| Recharts performance issues | HIGH | Recharts GitHub issues document performance problems with large datasets, official guide confirms |
| State management patterns | MEDIUM | Current 2026 sources confirm trends (React Query + Zustand/Jotai), but project-specific context needed |
| Fastify multipart configuration | HIGH | Official @fastify/multipart documentation v8.3.0, package already in project |
| Anomaly detection false positives | MEDIUM | General time series documentation, but German utility patterns need validation |
| Security considerations | HIGH | Standard web security practices + file upload vulnerabilities well documented |
| Integration with existing system | HIGH | Based on actual project codebase analysis (Prisma schema, package.json, component structure) |
| German utility meter specifics | LOW | No Germany-specific meter documentation found, assuming standard EU practices |
| OCR for German meters | LOW | Tesseract works for seven-segment displays, but German meter layouts not specifically tested |

---

## Gaps and Open Questions

**Areas needing further research:**

1. **German Utility Meter Layouts**: Do German electricity/gas/water meters have standard display formats? Are there regulatory specifications?

2. **Historical Data Quality**: User's Excel file from 2018-2025 - what's the actual data quality? Are there gaps? Inconsistent formatting?

3. **Seasonal Baseline for Germany**: What's typical winter/summer consumption variation for German households? (For anomaly detection)

4. **Mobile OCR Performance**: Does Tesseract.js run acceptably fast on mobile browsers? Or should OCR be server-side only?

5. **Cost Rate Changes**: Do German utilities change rates mid-month? How to handle rate tiers (Grundpreis + Arbeitspreis)?

6. **Chart Priority**: Which of the 7 chart types are actually most valuable to user? Should build 2-3 first, not all 7.

7. **Integration Timing**: Should meter features be in existing dashboard or separate section? User flow unclear.

**Recommended validation before Phase 1:**

- [ ] Get sample of user's actual Excel data
- [ ] Take 10 phone photos of actual German meters (electricity, gas, water)
- [ ] Test Tesseract accuracy on real German meter photos
- [ ] Clarify which chart types are P0 vs. nice-to-have
- [ ] Determine if cost tracking is MVP or Phase 2

---

## Sources

### OCR & Image Processing
- [MDPI: Smart OCR Application for Meter Reading](https://www.mdpi.com/2673-4591/20/1/25)
- [GitHub: Meter Reading with OCR](https://github.com/arnavdutta/Meter-Reading)
- [Research: State of OCR in 2026](https://research.aimultiple.com/ocr-technology/)
- [Medium: Digital meter reading using CV & ML](https://medium.com/@oviyum/digital-meter-reading-using-cv-ml-53b71f25ed91)
- [GitHub: tessdata_ssd - Seven Segment Display training](https://github.com/Shreeshrii/tessdata_ssd)
- [GitHub: LCD-OCR with Tesseract](https://github.com/DevashishPrasad/LCD-OCR)
- [Toolify: Precise OCR Models for 7-Segment Displays](https://www.toolify.ai/ai-news/create-precise-ocr-models-for-7segment-displays-using-tesseract-2020564)
- [Unstract: Tesseract OCR Guide 2026](https://unstract.com/blog/guide-to-optical-character-recognition-with-tesseract-ocr/)
- [Klippa: Tesseract OCR in 2026](https://www.klippa.com/en/blog/information/tesseract-ocr/)
- [Research: OCR Accuracy Benchmark 2026](https://research.aimultiple.com/ocr-accuracy/)
- [Cloudinary: Pre-upload image processing](https://cloudinary.com/blog/giving_your_mobile_app_a_boost_part_1_pre_upload_image_processing)

### Data Validation & Integrity
- [Home Assistant: Utility Meter](https://www.home-assistant.io/integrations/utility_meter/)
- [Itron: Reading validation](https://docs.itrontotal.com/IEEMDM/Content/Topics/252929.htm)
- [Itron: Interval validation rules](https://docs.itrontotal.com/IEEMDM/Content/Topics/252711.htm)
- [PNNL: Meter Data Analysis](https://www.pnnl.gov/main/publications/external/technical_reports/PNNL-24331.pdf)
- [Blicker: Automatic Meter Reading](https://www.blicker.ai/news/improving-your-utility-operations-with-automatic-meter-reading-solutions)
- [AIM Multiple: Meter Data Management System](https://research.aimultiple.com/meter-data-management/)
- [Scientific Data: Real-World Energy Management Dataset](https://www.nature.com/articles/s41597-025-05186-3)

### Database & Storage
- [PostgreSQL: BinaryFilesInDB](https://wiki.postgresql.org/wiki/BinaryFilesInDB)
- [Sling Academy: PostgreSQL image storage](https://www.slingacademy.com/article/postgresql-how-to-store-images-in-database-and-why-you-shouldnt/)
- [Medium: Optimizing Image Storage in PostgreSQL](https://medium.com/@ajaymaurya73130/optimizing-image-storage-in-postgresql-tips-for-performance-scalability-fd4d575a6624)
- [Maxim Orlov: Why Storing Files in Database Is Bad Practice](https://maximorlov.com/why-storing-files-database-bad-practice/)
- [PostgreSQL: Database versus filesystem for storing images](https://www.postgresql.org/message-id/a595de7a0612311316m67e99669m2cd2d53d1ce94d90@mail.gmail.com)
- [Codegenes: Storing Images - Database vs Filesystem](https://www.codegenes.net/blog/storing-images-in-a-database-versus-a-filesystem/)
- [Prisma: Getting started with Migrate](https://www.prisma.io/docs/orm/prisma-migrate/getting-started)
- [Prisma: Adding Migrate to existing project](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/add-prisma-migrate-to-a-project)
- [Wasp: Database Migrations in Prisma](https://wasp.sh/blog/2025/04/02/an-introduction-to-database-migrations)
- [LogRocket: Database schema migration with Prisma](https://blog.logrocket.com/effortless-database-schema-migration-prisma/)

### Excel Import & Date Parsing
- [Flatfile: Top Excel import errors](https://flatfile.com/blog/the-top-excel-import-errors-and-how-to-fix-them/)
- [Dromo: Common data import errors](https://dromo.io/blog/common-data-import-errors-and-how-to-fix-them)
- [Ingestro: CSV file import errors](https://ingestro.com/blog/5-csv-file-import-errors-and-how-to-fix-them-quickly)
- [Flatfile: CSV Import Errors](https://flatfile.com/blog/top-6-csv-import-errors-and-how-to-fix-them/)
- [OneSchema: Advanced CSV import features](https://www.oneschema.co/blog/advanced-csv-import-features)
- [Exceljet: Convert UTC timestamp](https://exceljet.net/formulas/convert-utc-timestamp-to-excel-datetime)
- [XlsxWriter: Dates and Times](https://xlsxwriter.readthedocs.io/working_with_dates_and_time.html)
- [ExtendOffice: Convert date to timezone](https://www.extendoffice.com/documents/excel/3609-excel-convert-date-to-timezone.html)
- [Microsoft: Excel Online date/time displays wrong](https://answers.microsoft.com/en-us/msoffice/forum/all/excel-online-datetime-displays-wrong-despite/cd1c8401-6fdd-4ddb-98c3-6ef0c7e76d6f)
- [Office Watch: Local time zone offset in Excel](https://office-watch.com/2023/time-zone-offset-excel/)

### Chart Performance
- [Recharts: Performance Guide](https://recharts.github.io/guide/performance/)
- [Recharts GitHub: Large datasets performance issues](https://github.com/recharts/recharts/issues/1465)
- [Recharts GitHub: Slow with large data](https://github.com/recharts/recharts/issues/1146)
- [Recharts GitHub: Downsample large data set](https://github.com/recharts/recharts/issues/1356)
- [Recharts GitHub: Large dataset on scatter plots](https://github.com/recharts/recharts/discussions/3181)
- [Refine: Create charts using Recharts](https://refine.dev/blog/recharts/)
- [Chart.js: Performance Documentation](https://www.chartjs.org/docs/latest/general/performance.html)
- [LogRocket: Best React chart libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [Syncfusion: Top 5 React Chart Libraries 2026](https://www.syncfusion.com/blogs/post/top-5-react-chart-libraries)
- [FusionCharts: Best React Chart Libraries 2026](https://www.fusioncharts.com/blog/what-are-the-6-best-react-chart-libraries/)

### State Management & React Performance
- [TheLinuxCode: State Management in React 2026](https://thelinuxcode.com/state-management-in-react-2026-hooks-context-api-and-redux-in-practice/)
- [Nucamp: State Management in 2026](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns)
- [Syncfusion: React State Management Tools 2026](https://www.syncfusion.com/blogs/post/react-state-management-libraries)
- [Trio: Top React State Management Libraries 2026](https://trio.dev/7-top-react-state-management-libraries/)
- [Netguru: React JS Trends in 2026](https://www.netguru.com/blog/react-js-trends)
- [CodeScene: Technical debt in React](https://codescene.com/blog/codescene-prioritize-technical-debt-in-react/)
- [Kickstand: Reducing technical debt in React](https://kickstand.work/blog/react/reducing-technical-debt-in-react-app/)
- [Medium: Feature Creep and Technical Debt](https://medium.com/craft-academy/feature-creep-technical-debt-and-the-role-of-automated-testing-in-software-development-a99a6542114f)

### Anomaly Detection
- [Neptune.ai: Anomaly Detection in Time Series](https://neptune.ai/blog/anomaly-detection-in-time-series)
- [VictoriaMetrics: Anomaly Detection Handbook](https://victoriametrics.com/blog/victoriametrics-anomaly-detection-handbook-chapter-1/)
- [BlackBerry: Reduce false positives with time series predictions](https://blogs.blackberry.com/en/2024/06/reduce-false-positives-with-time-series-predictions)
- [Anodot: Time Series Anomaly Detection](https://www.anodot.com/blog/closer-look-time-series-anomaly-detection/)
- [PyCharm: Anomaly Detection in Time Series](https://blog.jetbrains.com/pycharm/2025/01/anomaly-detection-in-time-series/)
- [GeeksforGeeks: Anomaly Detection in Time Series Data](https://www.geeksforgeeks.org/machine-learning/anomaly-detection-in-time-series-data/)
- [Striim: Time series forecasting and anomaly detection](https://www.striim.com/docs/platform/en/time-series-forecasting-and-anomaly-detection.html)

### UX & Mobile
- [Whizzbridge: UI UX Best Practices 2026](https://www.whizzbridge.com/blog/ui-ux-best-practices-2025)
- [UIDesignz: UI UX Design Best Practices 2026](https://uidesignz.com/blogs/ui-ux-design-best-practices)
- [Userpilot: Mobile UX Design Guide](https://userpilot.com/blog/mobile-ux-design/)
- [Thinkroom: Mobile UX best practices 2025](https://www.thinkroom.com/mobile-ux-best-practices/)
- [Toptal: Mobile UX Design Best Practices](https://www.toptal.com/designers/ux/mobile-ux-design-best-practices)
- [Netguru: Top 10 Mobile UX Best Practices](https://www.netguru.com/blog/mobile-ux-best-practices)
- [UIDesignz: Mobile UI Design Best Practices 2026](https://uidesignz.com/blogs/mobile-ui-design-best-practices)
- [Octet: UX Best Practices for 2026](https://octet.design/journal/ux-best-practices/)
- [Imagify: How to Optimize Images for Mobile](https://imagify.io/blog/how-to-optimize-images-for-mobile/)
- [BrowserStack: Strategies for Optimizing Images for Mobile](https://www.browserstack.com/guide/strategies-for-optimizing-images-for-mobile)

### Data Backfilling
- [Atlan: Backfilling Data Guide](https://atlan.com/backfilling-data-guide/)
- [Metaplane: Backfilling Data Best Practices](https://www.metaplane.dev/blog/backfilling-data-in-2023)
- [Medium: Backfilling Data Pipelines](https://medium.com/@andymadson/backfilling-data-pipelines-concepts-examples-and-best-practices-19f7a6b20c82)
- [Acceldata: Why Backfilling Data Is Essential](https://www.acceldata.io/blog/why-backfilling-data-is-essential-for-reliable-analytics)
- [Monte Carlo: Data Engineer's Guide To Backfilling](https://www.montecarlodata.com/blog-backfilling-data-guide/)
- [Contentsquare: Engineering a Reliable Data Backfill Solution](https://engineering.contentsquare.com/2023/engineering-a-reliable-data-backfill-solution/)
- [CelerData: Data Backfill](https://celerdata.com/glossary/data-backfill)

### Fastify
- [GitHub: @fastify/multipart](https://github.com/fastify/fastify-multipart)
- [npm: @fastify/multipart](https://www.npmjs.com/package/@fastify/multipart)
- [Better Stack: File Uploads with Fastify](https://betterstack.com/community/guides/scaling-nodejs/fastify-file-uploads/)
- [Snyk: Node.js file uploads with Fastify](https://snyk.io/blog/node-js-file-uploads-with-fastify/)
- [GitHub: fastify-multer](https://github.com/fox1t/fastify-multer)

### Technical Debt & Best Practices
- [AltexSoft: Reducing Technical Debt](https://www.altexsoft.com/blog/technical-debt/)
- [Frontend at Scale: A Normal Amount of Tech Debt](https://frontendatscale.com/issues/11/)
- [DEV: Technical Debt Grows from "Just for Now"](https://dev.to/nyaomaru/technical-debt-grows-from-just-for-now-a-real-world-code-walkthrough-5997)
- [TechDebtGuide: Types of Technical Debt](https://techdebtguide.com/types-of-technical-debt)

---

**END OF PITFALLS RESEARCH**
