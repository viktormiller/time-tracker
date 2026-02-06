# Architecture Research

**Domain:** Utility meter tracking integration
**Researched:** 2026-02-06
**Confidence:** HIGH

## System Overview

The utility meter tracking feature integrates into the existing time tracking application using parallel domain separation. The architecture leverages existing infrastructure (auth, nav, theme, database) while maintaining clean separation from time tracking concerns.

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                 │
├─────────────────────────────────────────────────────────────┤
│  App.tsx                                                    │
│  ├─ AuthProvider (existing)                                │
│  ├─ ThemeProvider (existing)                               │
│  └─ ToastProvider (existing)                               │
│                                                             │
│  Pages:                                                     │
│  ├─ Dashboard (time tracking - existing)                   │
│  ├─ AddEntry (time tracking - existing)                    │
│  ├─ Estimates (existing)                                   │
│  ├─ Settings (existing)                                    │
│  └─ Utilities (NEW - meter dashboard)                      │
│     ├─ MeterReadingsList                                   │
│     ├─ ManualEntryForm                                     │
│     ├─ OCRCapture                                          │
│     ├─ ExcelImportModal                                    │
│     ├─ UtilityChartGrid (7 chart types)                    │
│     └─ UtilitySettings                                     │
└─────────────────────────────────────────────────────────────┘
                           │
                    Axios HTTP API
                           │
┌─────────────────────────────────────────────────────────────┐
│              Backend (Fastify + TypeScript)                 │
├─────────────────────────────────────────────────────────────┤
│  server.ts                                                  │
│  ├─ Auth plugin (existing)                                 │
│  ├─ Security plugin (existing)                             │
│  ├─ Multipart plugin (existing)                            │
│  └─ Protected routes wrapper                               │
│                                                             │
│  Routes:                                                    │
│  ├─ /api/time-entries (existing)                           │
│  ├─ /api/estimates (existing)                              │
│  └─ /api/utilities (NEW)                                   │
│     ├─ GET /readings - list readings                       │
│     ├─ POST /readings - create manual reading              │
│     ├─ PUT /readings/:id - update reading                  │
│     ├─ DELETE /readings/:id - delete reading               │
│     ├─ POST /readings/ocr - OCR image upload               │
│     ├─ POST /readings/import - Excel import                │
│     ├─ GET /consumption - calculated consumption           │
│     └─ GET /settings - meter settings                      │
│                                                             │
│  Services:                                                  │
│  ├─ ocr.service.ts (Tesseract OCR)                         │
│  ├─ excel-import.service.ts (xlsx parsing)                 │
│  └─ consumption-calculator.service.ts                      │
└─────────────────────────────────────────────────────────────┘
                           │
                      Prisma ORM
                           │
┌─────────────────────────────────────────────────────────────┐
│                PostgreSQL Database                          │
├─────────────────────────────────────────────────────────────┤
│  TimeEntry (existing)                                       │
│  ProjectEstimate (existing)                                 │
│  EstimateProject (existing)                                 │
│  MeterReading (NEW)                                         │
│  ├─ id, meterType, readingDate, value                      │
│  ├─ createdAt, source (manual/ocr/import)                  │
│  └─ metadata (OCR confidence, import file)                 │
│  MeterSettings (NEW)                                        │
│  └─ meterType, unitCost, enabled                           │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|---------------|------------------------|
| **Frontend: Utilities.tsx** | Main page container, navigation, data fetching | Similar to Estimates.tsx pattern |
| **Frontend: MeterReadingsList** | Display readings table with CRUD actions | Similar to time entries table |
| **Frontend: ManualEntryForm** | Form for manual meter value input | Modal pattern like EditModal |
| **Frontend: OCRCapture** | Camera/upload UI, image preview, OCR trigger | File input + canvas preview |
| **Frontend: ExcelImportModal** | File upload, mapping preview, import trigger | Similar to CSV upload pattern |
| **Frontend: UtilityChartGrid** | Container for 7 chart types with type selector | Tab/dropdown selector + responsive grid |
| **Frontend: UtilitySettings** | Per-meter settings (costs, enabled status) | Form similar to estimate modal |
| **Backend: utility.routes.ts** | RESTful endpoints for meter readings | FastifyInstance plugin pattern |
| **Backend: ocr.service.ts** | Image processing and text extraction | Tesseract.js wrapper |
| **Backend: excel-import.service.ts** | Parse XLSX, validate, transform to readings | xlsx library wrapper |
| **Backend: consumption-calculator.service.ts** | Calculate consumption from sequential readings | Pure function: readings → consumption |

## Recommended Project Structure

### Backend additions:
```
backend/src/
├── routes/
│   └── utility.routes.ts              # NEW: All utility meter endpoints
├── services/
│   ├── ocr.service.ts                 # NEW: OCR processing
│   ├── excel-import.service.ts        # NEW: Excel parsing
│   └── consumption-calculator.service.ts  # NEW: Consumption logic
├── schemas/
│   ├── meter-reading.schema.ts        # NEW: Zod validation
│   └── meter-settings.schema.ts       # NEW: Settings validation
└── types/
    └── meter.types.ts                 # NEW: Shared types
```

### Frontend additions:
```
frontend/src/
├── pages/
│   └── Utilities.tsx                  # NEW: Main utilities page
├── components/
│   ├── meters/
│   │   ├── MeterReadingsList.tsx     # NEW: Readings table
│   │   ├── ManualEntryForm.tsx       # NEW: Manual input modal
│   │   ├── OCRCapture.tsx            # NEW: OCR capture UI
│   │   ├── ExcelImportModal.tsx      # NEW: Excel import
│   │   ├── UtilityChartGrid.tsx      # NEW: Chart container
│   │   ├── charts/
│   │   │   ├── YearOverYearChart.tsx # NEW: Comparison bars
│   │   │   ├── TrendChart.tsx        # NEW: Line with trend
│   │   │   ├── CumulativeChart.tsx   # NEW: Cumulative area
│   │   │   ├── AnomalyChart.tsx      # NEW: Scatter with alerts
│   │   │   ├── CostOverlayChart.tsx  # NEW: Bars + cost line
│   │   │   ├── SeasonalHeatmap.tsx   # NEW: Calendar heatmap
│   │   │   └── ForecastChart.tsx     # NEW: Historical + projection
│   │   └── UtilitySettings.tsx       # NEW: Settings modal
└── lib/
    └── meter-calculations.ts          # NEW: Client-side calculations
```

## Architectural Patterns

### Pattern 1: Provider Abstraction (DO NOT USE for meters)

**What:** The time tracking feature uses a provider pattern (TogglProvider, TempoProvider) for external sync.

**Decision:** Utility meters DO NOT need this pattern because:
- No external API sync (all data entry is local: manual, OCR, Excel)
- Three meter types share identical schema (no source-specific logic)
- Simpler CRUD operations without sync/cache complexity

**Instead:** Use direct Prisma access in routes with a simple `meterType` discriminator field.

### Pattern 2: Service Layer for Complex Operations

**What:** Extract complex business logic into dedicated service files.

**When:** Use for:
- OCR processing (multi-step: upload, preprocess, extract, validate)
- Excel import (multi-step: parse, validate schema, transform, bulk insert)
- Consumption calculation (algorithm: sort readings, calculate deltas, handle rollovers)

**Example:**
```typescript
// consumption-calculator.service.ts
export interface ConsumptionResult {
  period: { start: Date; end: Date };
  consumption: number;
  cost?: number;
}

export function calculateConsumption(
  readings: MeterReading[],
  unitCost?: number
): ConsumptionResult[] {
  const sorted = readings.sort((a, b) =>
    a.readingDate.getTime() - b.readingDate.getTime()
  );

  return sorted.slice(1).map((current, i) => {
    const previous = sorted[i];
    let consumption = current.value - previous.value;

    // Handle meter rollover (e.g., 99999 → 00001)
    if (consumption < 0) {
      const maxValue = 999999; // meter-specific
      consumption = (maxValue - previous.value) + current.value;
    }

    return {
      period: { start: previous.readingDate, end: current.readingDate },
      consumption,
      cost: unitCost ? consumption * unitCost : undefined
    };
  });
}
```

### Pattern 3: Chart Composition via Props

**What:** Use a single composable chart component with type prop instead of separate chart files for similar visualizations.

**Anti-Pattern:** 7 separate files with duplicated Recharts setup.

**Recommended:**
```typescript
// UtilityChart.tsx
type ChartType = 'yearOverYear' | 'trend' | 'cumulative' | 'anomaly' |
                 'costOverlay' | 'heatmap' | 'forecast';

interface UtilityChartProps {
  type: ChartType;
  meterType: MeterType;
  data: ConsumptionResult[];
  settings: MeterSettings;
}

export function UtilityChart({ type, meterType, data, settings }: UtilityChartProps) {
  switch(type) {
    case 'yearOverYear':
      return <ComposedChart>...</ComposedChart>;
    case 'heatmap':
      return <CalendarHeatmap>...</CalendarHeatmap>;
    // ...
  }
}
```

**Alternative (Better for code organization):** Separate files but shared configuration:
```typescript
// charts/shared-config.ts
export const CHART_COLORS = {
  strom: '#f59e0b', // amber
  gas: '#3b82f6',   // blue
  wasserWarm: '#ef4444' // red
};

export const BASE_CHART_PROPS = {
  margin: { top: 20, right: 30, left: 0, bottom: 5 }
};
```

### Pattern 4: OCR Processing Flow

**What:** Handle image upload → preprocessing → OCR → validation → return value.

**Flow:**
1. **Client uploads image** via file input or camera capture
2. **Server receives multipart/form-data** with meterType in body
3. **Server preprocesses image** (resize, grayscale, contrast) for better OCR
4. **Tesseract OCR extracts text** with confidence scores
5. **Validate extracted number** (e.g., numeric, reasonable range)
6. **Return value + confidence** to client for user confirmation
7. **Client displays preview** with extracted value editable before saving

**Implementation:**
```typescript
// ocr.service.ts
import Tesseract from 'tesseract.js';
import sharp from 'sharp';

export async function extractMeterValue(
  imageBuffer: Buffer
): Promise<{ value: number; confidence: number }> {
  // Preprocess for better OCR
  const processed = await sharp(imageBuffer)
    .resize(800) // Reasonable size
    .grayscale()
    .normalize()
    .toBuffer();

  // OCR
  const { data } = await Tesseract.recognize(processed, 'deu', {
    tessedit_char_whitelist: '0123456789.,', // Only digits
  });

  // Extract number from text
  const numbers = data.text.match(/\d+[.,]?\d*/g) || [];
  if (numbers.length === 0) {
    throw new Error('No numeric value found');
  }

  // Take largest number (meter reading is usually prominent)
  const value = parseFloat(numbers[0].replace(',', '.'));

  return {
    value,
    confidence: data.confidence / 100
  };
}
```

### Pattern 5: Excel Import Mapping

**What:** Parse Excel file, validate structure, transform to MeterReading format.

**Expected Excel format:**
```
| Date       | Strom | Gas  | Wasser Warm |
|------------|-------|------|-------------|
| 01.01.2024 | 15234 | 8921 | 4521        |
| 01.02.2024 | 15567 | 9103 | 4598        |
```

**Implementation:**
```typescript
// excel-import.service.ts
import XLSX from 'xlsx';

interface ImportRow {
  date: Date;
  strom?: number;
  gas?: number;
  wasserWarm?: number;
}

export async function parseUtilityExcel(
  fileBuffer: Buffer
): Promise<MeterReading[]> {
  const workbook = XLSX.read(fileBuffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);

  const readings: MeterReading[] = [];

  for (const row of rows) {
    // Parse date (handle German format dd.mm.yyyy)
    const date = parseGermanDate(row['Date'] || row['Datum']);

    // Create reading for each meter type
    if (row['Strom']) {
      readings.push({
        meterType: 'STROM',
        readingDate: date,
        value: parseFloat(row['Strom']),
        source: 'IMPORT'
      });
    }
    // Similar for gas, wasserWarm...
  }

  return readings;
}
```

## Data Flow

### Flow 1: Manual Entry

```
User clicks "Add Reading"
  → ManualEntryForm opens (modal)
  → User selects meter type (Strom/Gas/Wasser Warm)
  → User enters date + value
  → Submit
    → POST /api/utilities/readings
      → Validate schema (Zod)
      → Create MeterReading with source='MANUAL'
      → Return created reading
    ← 201 Created
  → Refresh readings list
  → Recalculate consumption (client-side or fetch)
  → Update charts
```

### Flow 2: OCR Entry

```
User clicks "OCR Scan"
  → OCRCapture modal opens
  → User selects meter type
  → User uploads image OR captures from camera
    → Preview image shown
  → User clicks "Extract Value"
    → POST /api/utilities/readings/ocr (multipart)
      → Save temp file
      → ocr.service.extractMeterValue(buffer)
        → Preprocess image (sharp)
        → Tesseract OCR
        → Extract numeric value
        → Return value + confidence
      ← { value: 15234, confidence: 0.87 }
    → Display extracted value (editable)
    → User confirms/edits value
  → User clicks "Save"
    → POST /api/utilities/readings (value + metadata)
      → Create MeterReading with source='OCR'
      → Store OCR confidence in metadata
      ← 201 Created
  → Refresh readings list + charts
```

### Flow 3: Excel Import

```
User clicks "Import Excel"
  → ExcelImportModal opens
  → User uploads .xlsx file
    → Parse file client-side for preview (optional)
  → User clicks "Import"
    → POST /api/utilities/readings/import (multipart)
      → Save temp file
      → excel-import.service.parseUtilityExcel(buffer)
        → Read workbook
        → Parse rows
        → Validate dates and values
        → Transform to MeterReading[]
      → Bulk insert with Prisma createMany
      ← { imported: 36, skipped: 2, errors: [] }
    → Show import summary
  → Refresh readings list + charts
```

### Flow 4: Chart Rendering

```
User navigates to Utilities page
  → Fetch readings: GET /api/utilities/readings
  → Fetch settings: GET /api/utilities/settings
  ← { readings: [...], settings: {...} }
  → Group readings by meterType
  → Calculate consumption (consumption-calculator)
  → For each selected chart type:
    → Transform data to chart format
    → Render Recharts component
      - YearOverYear: Group by month, compare years
      - Trend: Line chart with linear regression
      - Cumulative: Area chart with running sum
      - Anomaly: Scatter with threshold bands
      - CostOverlay: Bar (consumption) + Line (cost)
      - Heatmap: Calendar grid with color intensity
      - Forecast: Historical line + projection (simple linear)
```

## Database Schema

### Prisma Models

```prisma
// Add to backend/prisma/schema.prisma

enum MeterType {
  STROM
  GAS
  WASSER_WARM
}

enum ReadingSource {
  MANUAL
  OCR
  IMPORT
}

model MeterReading {
  id          String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  meterType   MeterType
  readingDate DateTime      @db.Timestamptz(6)
  value       Float         // The meter reading value
  source      ReadingSource @default(MANUAL)
  metadata    Json?         // OCR confidence, import file name, etc.
  createdAt   DateTime      @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime      @updatedAt @db.Timestamptz(6)

  @@unique([meterType, readingDate]) // One reading per meter per date
  @@index([meterType, readingDate])
  @@index([readingDate])
}

model MeterSettings {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  meterType MeterType @unique
  unitCost  Float?    // Cost per unit (kWh, m³)
  enabled   Boolean   @default(true)
  createdAt DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt DateTime  @updatedAt @db.Timestamptz(6)
}
```

### Consumption Calculation (Not Stored)

Consumption is **calculated on-demand** from sequential readings, not stored in database:

**Why not store?**
- Avoids data duplication
- Always accurate (recalculated from source readings)
- Simpler schema
- Easy to recalculate with different logic

**Performance consideration:**
- For large datasets (years of monthly readings), consider caching calculated consumption
- For this use case (3 meters × 12 months/year = 36 readings/year), calculation is instant

### Migration

```bash
# Create migration
cd backend
npx prisma migrate dev --name add_utility_meters
```

## Integration Points

### 1. Authentication & Authorization

**Existing:** JWT-based auth with refresh tokens, all routes protected by `app.authenticate` hook.

**Integration:** Utility routes use same protection wrapper:
```typescript
// In server.ts
app.register(async (protectedRoutes) => {
  protectedRoutes.addHook('onRequest', app.authenticate);

  protectedRoutes.register(exportRoutes);
  protectedRoutes.register(summaryRoutes);
  protectedRoutes.register(estimateRoutes);
  protectedRoutes.register(utilityRoutes); // NEW
}, { prefix: '/api' });
```

No changes needed to auth system.

### 2. Navigation

**Existing:** View switcher in header with buttons for Dashboard, Add Entry, Estimates, Settings.

**Integration:** Add "Utilities" button to header navigation:
```typescript
// In App.tsx AuthenticatedApp
const [currentView, setCurrentView] = useState<
  'dashboard' | 'add-entry' | 'settings' | 'estimates' | 'utilities' // Add 'utilities'
>('dashboard');

// Add button in header
<button
  onClick={() => setCurrentView('utilities')}
  className="flex items-center gap-2 px-3 py-2..."
>
  <Zap size={18} /> {/* Or Bolt/Activity icon */}
  <span className="hidden md:inline">Utilities</span>
</button>

// Add view renderer
if (currentView === 'utilities') {
  return <Utilities onBack={() => setCurrentView('dashboard')} />;
}
```

### 3. Theme System

**Existing:** ThemeProvider context with dark mode support, accessed via `useTheme()` hook.

**Integration:** All new utility components consume theme:
```typescript
// In UtilityChart.tsx
import { useTheme } from '../hooks/useTheme';

export function UtilityChart({ ... }) {
  const { effectiveTheme } = useTheme();
  const isDarkMode = effectiveTheme === 'dark';

  return (
    <ResponsiveContainer>
      <ComposedChart>
        <CartesianGrid stroke={isDarkMode ? '#404040' : '#f3f4f6'} />
        {/* ... */}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

Recharts styling uses same dark mode colors as existing charts.

### 4. Toast Notifications

**Existing:** Toast context with `success`, `error`, `warning` methods.

**Integration:** Use for user feedback in utility operations:
```typescript
// In Utilities.tsx
import { useToast } from '../hooks/useToast';

const { toast } = useToast();

const handleOCRScan = async (image: File) => {
  try {
    const result = await ocrService.scan(image);
    toast.success(`Value extracted: ${result.value} (${result.confidence}% confidence)`);
  } catch (error) {
    toast.error('OCR failed. Please try manual entry.');
  }
};
```

### 5. Multipart File Uploads

**Existing:** `@fastify/multipart` plugin registered in server.ts, used for CSV uploads.

**Integration:** Reuse for OCR images and Excel imports:
```typescript
// In utility.routes.ts
fastify.post('/readings/ocr', async (req, reply) => {
  const data = await req.file();
  if (!data) {
    return reply.code(400).send({ error: 'No file uploaded' });
  }

  const buffer = await data.toBuffer();
  const result = await ocrService.extractMeterValue(buffer);

  return result;
});
```

Pattern identical to existing CSV upload endpoint.

### 6. Database Client

**Existing:** Single PrismaClient instance instantiated in server.ts, passed to routes.

**Integration:** Utility routes use same Prisma instance:
```typescript
// utility.routes.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function utilityRoutes(fastify: FastifyInstance) {
  fastify.get('/readings', async (req, reply) => {
    const readings = await prisma.meterReading.findMany({
      orderBy: { readingDate: 'desc' }
    });
    return readings;
  });
}
```

## Build Order (Dependency-Based)

### Phase 1: Foundation (Backend schema + basic CRUD)
**Why first:** Other features depend on database schema and basic API.

1. **Database schema** (Prisma migration)
   - Add MeterReading and MeterSettings models
   - Run migration
2. **Backend routes skeleton** (utility.routes.ts)
   - CRUD endpoints for readings (GET, POST, PUT, DELETE)
   - Settings endpoints (GET, PUT)
3. **Zod schemas** (validation)
   - meter-reading.schema.ts
   - meter-settings.schema.ts

**Validation:** Test with curl/Postman before building frontend.

### Phase 2: Manual Entry UI (Most valuable, minimal dependencies)
**Why second:** Delivers immediate value, no complex dependencies.

4. **Frontend page structure** (Utilities.tsx)
   - Navigation integration
   - Basic layout (header, back button)
   - State management for readings
5. **Readings list component** (MeterReadingsList.tsx)
   - Table display
   - Delete functionality
6. **Manual entry form** (ManualEntryForm.tsx)
   - Modal form
   - Meter type selector
   - Date + value inputs
   - Submit to API

**Validation:** Can create, view, edit, delete readings manually.

### Phase 3: Basic Visualization (Builds on Phase 2 data)
**Why third:** Provides value visualization for manually entered data.

7. **Consumption calculator service** (consumption-calculator.service.ts)
   - Calculate consumption from readings
   - Handle meter rollovers
8. **Basic charts** (start with 2-3 simple ones)
   - Trend chart (line chart)
   - Year-over-year bars
   - Cost overlay
9. **Chart grid container** (UtilityChartGrid.tsx)
   - Tab/dropdown selector
   - Responsive grid layout

**Validation:** Charts render correctly with manual data.

### Phase 4: OCR Feature (Complex, but independent)
**Why fourth:** Most complex feature, benefits from stable foundation.

10. **OCR service** (ocr.service.ts)
    - Tesseract integration
    - Image preprocessing (sharp)
    - Value extraction logic
11. **OCR backend route** (POST /readings/ocr)
    - File upload handling
    - Service integration
    - Error handling
12. **OCR frontend component** (OCRCapture.tsx)
    - File upload UI
    - Camera capture (optional)
    - Image preview
    - Extracted value confirmation

**Validation:** Can capture meter photo and extract value.

### Phase 5: Excel Import (Independent feature)
**Why fifth:** Independent of OCR, adds batch import capability.

13. **Excel import service** (excel-import.service.ts)
    - xlsx parsing
    - Row validation
    - Transformation logic
14. **Excel import route** (POST /readings/import)
    - File upload
    - Bulk insert
    - Error reporting
15. **Excel import modal** (ExcelImportModal.tsx)
    - File picker
    - Preview (optional)
    - Import progress/results

**Validation:** Can import historical data from Excel.

### Phase 6: Advanced Charts (Builds on consumption data)
**Why sixth:** Requires stable data and consumption calculation.

16. **Advanced visualizations**
    - Cumulative area chart
    - Anomaly detection scatter
    - Seasonal heatmap
    - Forecast projection
17. **Settings UI** (UtilitySettings.tsx)
    - Per-meter cost configuration
    - Enable/disable meters
    - Unit labels

**Validation:** All 7 chart types working, settings affect calculations.

### Phase 7: Polish & Testing
**Why last:** Refinement after core features complete.

18. **Error handling improvements**
19. **Loading states**
20. **Responsive design tweaks**
21. **End-to-end testing**

## New Components vs Modifications

### New Components (No modifications to existing)

**Backend:**
- `routes/utility.routes.ts` (completely new)
- `services/ocr.service.ts` (completely new)
- `services/excel-import.service.ts` (completely new)
- `services/consumption-calculator.service.ts` (completely new)
- `schemas/meter-reading.schema.ts` (completely new)
- `schemas/meter-settings.schema.ts` (completely new)

**Frontend:**
- `pages/Utilities.tsx` (completely new)
- All `components/meters/*` (completely new, ~10 files)

### Modifications to Existing

**Minimal modifications required:**

1. **backend/prisma/schema.prisma**
   - ADD: MeterReading model
   - ADD: MeterSettings model
   - ADD: MeterType enum
   - ADD: ReadingSource enum

2. **backend/src/server.ts**
   - ADD: `import utilityRoutes from './routes/utility.routes'`
   - ADD: `protectedRoutes.register(utilityRoutes)` (one line in existing wrapper)

3. **frontend/src/App.tsx**
   - ADD: `'utilities'` to view state type union
   - ADD: Navigation button in header (5 lines)
   - ADD: View renderer `if (currentView === 'utilities')` (3 lines)

**Total modifications:** ~10 lines of code in existing files.

### Why Minimal Modifications Work

The application's existing architecture already supports this pattern:
- **Route registration:** Plugin-based (Fastify)
- **Navigation:** View-switcher pattern (not routing-based)
- **Database:** Prisma models are additive
- **Services:** Independent, no shared state

This is the **correct architectural decision** because:
- Time tracking and utility tracking are separate domains
- No shared business logic between domains
- Clean separation prevents cross-domain bugs
- Easy to test independently
- Could be extracted to microservice later if needed

## Sources

### OCR & Image Processing
- [Building an Image to Text OCR Application in Node.js Using Express and Tesseract](https://mohammedshamseerpv.medium.com/building-an-image-to-text-ocr-application-in-node-js-using-express-and-tesseract-ec8a638135d3)
- [Tesseract OCR with Node.js: A Comprehensive Guide](https://www.w3tutorials.net/blog/tesseract-ocr-nodejs/)
- [Automate Document Processing in Node.js Using AI OCR & NLP](https://medium.com/lets-code-future/automate-document-processing-in-node-js-using-ai-ocr-nlp-61f2d0d2f04b)

### Meter Data Management
- [Step 3. Create a Central Energy Database | Energy Data Management Guide](https://eere.energy.gov/energydataguide/step3.shtml)
- [Meter Data Management System: Top 10+ tools in 2026](https://research.aimultiple.com/meter-data-management/)
- [AWS releases smart meter data analytics](https://aws.amazon.com/blogs/industries/aws-releases-smart-meter-data-analytics-platform/)

### Excel/XLSX Parsing
- [NPM + SheetJS XLSX in 2026: Safe Installation, Secure Parsing, and Real-World Node.js Patterns](https://thelinuxcode.com/npm-sheetjs-xlsx-in-2026-safe-installation-secure-parsing-and-real-world-nodejs-patterns/)
- [Node.js: Reading and Parsing Excel (XLSX) Files](https://www.kindacode.com/article/node-js-reading-and-parsing-excel-xlsx-files)
- [Read/Write Excel File in Node.js using XLSX](https://plainenglish.io/blog/read-write-excel-file-in-node-js-using-xlsx)

### File Upload & Multipart
- [Multer File Upload in Express.js: Complete Guide for 2026](https://dev.to/marufrahmanlive/multer-file-upload-in-expressjs-complete-guide-for-2026-1i9p)
- [@fastify/multipart - GitHub](https://github.com/fastify/fastify-multipart)
- [Uploading Files with Multer in Node.js](https://betterstack.com/community/guides/scaling-nodejs/multer-in-nodejs/)

### React Charts & Visualization
- [Creating Dynamic and Interactive Charts in React Using Recharts](https://medium.com/@vprince001/creating-dynamic-and-interactive-charts-in-react-using-recharts-18ebab12bd03)
- [How to Build Dynamic Charts in React with Recharts (Including Edge Cases)](https://dev.to/calebali/how-to-build-dynamic-charts-in-react-with-recharts-including-edge-cases-3e72)
- [Best React chart libraries (2025 update): Features, performance & use cases](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [Heatmaps for Time Series | Towards Data Science](https://towardsdatascience.com/heatmaps-for-time-series/)
- [Time series forecasting and anomaly detection](https://www.striim.com/docs/platform/en/time-series-forecasting-and-anomaly-detection.html)
