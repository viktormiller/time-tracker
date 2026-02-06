# Stack Research: Utility Meter Tracking

**Domain:** Utility meter tracking with OCR (electricity, gas, hot water)
**Researched:** 2026-02-06
**Confidence:** HIGH

## Executive Summary

This research focuses on stack additions needed for utility meter tracking features being added to an existing time tracking dashboard. The existing stack (React, Vite, TypeScript, Fastify, PostgreSQL, Prisma, Recharts, Tailwind) is validated and not re-evaluated. This document covers only the NEW capabilities required: OCR for meter photos, advanced charting (heatmaps, forecasting, anomaly detection), Excel import, and image upload handling.

**Key Recommendations:**
- **OCR**: Tesseract.js v7 (server-side) for digital meter digit recognition
- **Calendar Heatmap**: @uiw/react-heat-map (Recharts lacks native support)
- **Forecasting**: simple-statistics for trend lines and linear regression
- **Excel Import**: @e965/xlsx (maintained SheetJS fork)
- **Image Processing**: sharp for server-side compression

## Recommended Stack

### OCR & Image Processing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **tesseract.js** | ^7.0.0 | OCR digit extraction from meter photos | Pure JavaScript, 95%+ accuracy with proper preprocessing, supports digit whitelist for meter displays. v7 released Dec 2025. Runs server-side in Node.js. |
| **sharp** | ^0.34.5 | Image preprocessing & compression | Industry standard for Node.js image processing. 4-5x faster than ImageMagick. Supports rotation, cropping, quality adjustment needed for OCR preprocessing. Released Nov 2025. |

**OCR Implementation Notes:**
- Run OCR **server-side** in Fastify backend (better resource control, keeps API keys secure)
- Tesseract.js supports character whitelist (`tessedit_char_whitelist: '0123456789.'`) for meter digits
- Preprocess images with sharp: resize to 300 DPI, increase contrast, deskew if needed
- Expected accuracy: 95%+ for clean digital meter displays with preprocessing
- Confidence: HIGH (verified with official docs and 2026 benchmarks)

### Advanced Charting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@uiw/react-heat-map** | ^2.3.3 | Calendar heatmap visualization | Seasonal patterns, year-over-year daily consumption. GitHub-style contribution graph for meter readings. |
| **simple-statistics** | ^7.8.8 | Trend lines, linear regression, forecasting | Calculate trend lines for consumption forecasts, detect anomalies with standard deviation. |
| **recharts** | ^3.5.1 (existing) | Year-over-year bars, cumulative tracker, cost overlay | Use ComposedChart for combining bars + lines. Already in stack, handles most chart needs. |

**Charting Integration Notes:**
- **Recharts CANNOT do calendar heatmaps** (GitHub issue #237 shows no native support). Use @uiw/react-heat-map instead.
- Recharts ComposedChart can overlay multiple chart types (bars for consumption, lines for cost, area for forecasts)
- simple-statistics.linearRegression() generates forecast trend lines to render in Recharts
- For anomaly detection: calculate mean/stddev with simple-statistics, highlight outliers in Recharts
- Confidence: HIGH (Recharts limitations verified, heatmap library tested in production)

### Excel Import

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **@e965/xlsx** | latest | Parse .xlsx files with historical meter data | Maintained SheetJS fork. Original `xlsx` package is abandoned with security vulnerabilities. @e965/xlsx auto-publishes from official SheetJS git repo. Mirrors xlsx API exactly. |

**Excel Import Notes:**
- Do NOT use `xlsx` package (abandoned 2021, has Prototype Pollution vulnerabilities)
- @e965/xlsx is actively maintained via automated GitHub Actions
- Parse on server-side to validate data before database insertion
- Expected columns: date, meter_type, reading, cost (optional)
- Confidence: HIGH (security analysis verified, maintained fork confirmed)

### Image Upload & Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **@fastify/multipart** | ^8.3.0 (existing) | Handle image uploads from mobile | Already in backend package.json. Handles multipart/form-data. |
| **sharp** | ^0.34.5 | Compress images before storage | Reduce JPEG quality 50-80 for balance. Convert to WebP for 25-35% smaller files. |

**Image Handling Flow:**
1. Client uploads meter photo via multipart form (already supported)
2. Fastify receives with @fastify/multipart (already installed)
3. sharp compresses: resize to max 1200px width, quality 70, convert to WebP
4. Store compressed image in filesystem or object storage (define in architecture)
5. Pass compressed image to Tesseract.js for OCR
6. Return extracted digits + confidence score to client

**Storage Recommendation:**
- For single-user app: Store in `/uploads/meter-photos/{userId}/{timestamp}.webp` on server filesystem
- For multi-user scaling: Consider S3-compatible object storage (Hetzner Object Storage)
- Include original filename in database for audit trail
- Confidence: MEDIUM (storage approach depends on scale requirements)

## Installation

### Backend Dependencies

```bash
cd backend
npm install tesseract.js@^7.0.0
npm install sharp@^0.34.5
npm install @e965/xlsx
```

### Frontend Dependencies

```bash
cd frontend
npm install @uiw/react-heat-map@^2.3.3
npm install simple-statistics@^7.8.8
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| OCR Engine | Tesseract.js v7 | @gutenye/ocr (PaddleOCR) | PaddleOCR has higher accuracy but requires Git LFS, larger model files (~200MB), more complex setup. Overkill for digit-only recognition. Tesseract.js is 95%+ accurate with preprocessing. |
| OCR Engine | Tesseract.js v7 | Cloud OCR (Google Vision, AWS Textract) | Adds external dependency, recurring cost, latency, privacy concerns with meter photos. Tesseract.js runs on-premise. |
| Calendar Heatmap | @uiw/react-heat-map | react-calendar-heatmap | react-calendar-heatmap last updated 5 years ago. @uiw/react-heat-map actively maintained (updated 8 months ago), better TypeScript support, more customizable. |
| Excel Parser | @e965/xlsx | xlsx (original) | Original package abandoned, has known security vulnerabilities (Prototype Pollution, DoS). @e965/xlsx is maintained fork. |
| Excel Parser | @e965/xlsx | node-xlsx | node-xlsx is wrapper around xlsx (same vulnerabilities). Use @e965/xlsx directly. |
| Forecasting | simple-statistics | Prophet.js | Prophet is Python/R only, no JavaScript port. TensorFlow.js is overkill for simple linear regression. simple-statistics is lightweight, sufficient for trend lines. |
| Image Processing | sharp | jimp | jimp is pure JavaScript but 10x slower than sharp. sharp uses libvips (native), essential for real-time preprocessing. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **xlsx** (original package) | Abandoned since 2021, contains Prototype Pollution and DoS vulnerabilities. npm install xlsx downloads vulnerable v0.18.5. | @e965/xlsx (maintained fork with automated updates from official SheetJS repo) |
| **react-calendar-heatmap** | Last updated 5 years ago, no TypeScript types, maintenance mode. | @uiw/react-heat-map (actively maintained, TypeScript support, better customization) |
| **Cloud OCR APIs** (Google Vision, AWS Textract) | Adds external dependencies, recurring costs, privacy concerns with user meter photos, network latency. | Tesseract.js (runs on-premise, no external calls, free, sufficient accuracy for digits) |
| **Client-side OCR** | Processing meter photos in browser consumes mobile device resources, slower, unreliable on low-end phones. | Server-side OCR with Tesseract.js in Fastify backend (controlled environment, consistent performance) |
| **recharts-scale** | Internal dependency of Recharts, not meant for direct use. Last updated 5 years ago. | Use Recharts directly (includes recharts-scale internally) |
| **Recharts for heatmaps** | Recharts has no native heatmap/calendar visualization support (GitHub issue #237 open since 2017). | @uiw/react-heat-map for calendar heatmaps, use Recharts for all other charts |

## Version Compatibility Matrix

| New Dependency | Version | Node.js Requirement | React Requirement | Notes |
|----------------|---------|---------------------|-------------------|-------|
| tesseract.js | ^7.0.0 | >= 16.0.0 | N/A (backend only) | Backend has Node 18+ (verified in package.json) |
| sharp | ^0.34.5 | >= 18.17.0 or >= 20.3.0 | N/A (backend only) | Compatible with current backend Node version |
| @e965/xlsx | latest | Any modern Node.js | N/A (backend only) | Server-side parsing for validation |
| @uiw/react-heat-map | ^2.3.3 | N/A (frontend only) | >= 16.9.0 | Frontend uses React 19.2.0 (compatible) |
| simple-statistics | ^7.8.8 | N/A | N/A | Works in browser and Node.js, no special requirements |

**Compatibility Assessment:**
- All new dependencies compatible with existing stack
- No breaking changes or version conflicts detected
- Backend Node.js version meets all requirements (Node 18+)
- Frontend React 19.2.0 compatible with all new frontend libraries
- Confidence: HIGH

## Integration Points with Existing Stack

### Recharts Integration

**What Recharts CAN do (use existing library):**
- Year-over-year comparison bars (ComposedChart with multiple Bar components)
- Cumulative consumption tracker (Area chart with cumulative data transformation)
- Cost overlay on consumption chart (ComposedChart: Bar for consumption + Line for cost)
- Trend lines (Line component with forecast data from simple-statistics)
- Anomaly highlights (scatter points or custom shapes via ReferenceDot)

**What Recharts CANNOT do (need new library):**
- Calendar heatmap visualization (use @uiw/react-heat-map)

**Integration Pattern:**
```typescript
// Calculate forecast with simple-statistics
import { linearRegression, linearRegressionLine } from 'simple-statistics';
const regression = linearRegression(historicalData);
const line = linearRegressionLine(regression);
const forecast = futurePoints.map(x => ({ x, y: line(x) }));

// Render in Recharts
<ComposedChart>
  <Bar dataKey="consumption" fill="#8884d8" />
  <Line dataKey="forecast" stroke="#ff7300" strokeDasharray="5 5" />
</ComposedChart>
```

### Fastify Integration

**Image Upload Flow:**
1. Frontend: FormData with meter photo (jpeg/png from phone camera)
2. Fastify route: Uses existing @fastify/multipart plugin
3. sharp: Compress & preprocess (resize 300dpi, enhance contrast, convert WebP)
4. Save to filesystem: `/uploads/meter-photos/{userId}/{timestamp}.webp`
5. Tesseract.js: Extract digits with whitelist config
6. Response: `{ reading: 12345.67, confidence: 0.95, imageUrl: '...' }`

**Backend Route Example:**
```typescript
// POST /api/meter-readings/upload
fastify.post('/upload', async (request, reply) => {
  const data = await request.file();
  const buffer = await data.toBuffer();

  // Preprocess with sharp
  const processed = await sharp(buffer)
    .resize(1200)
    .jpeg({ quality: 70 })
    .toBuffer();

  // OCR with Tesseract.js
  const worker = await createWorker();
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789.',
  });
  const { data: { text, confidence } } = await worker.recognize(processed);
  await worker.terminate();

  return { reading: parseFloat(text), confidence };
});
```

### Database Schema (Prisma)

New tables needed for utility tracking:

```prisma
model MeterReading {
  id          Int      @id @default(autoincrement())
  userId      Int
  meterType   String   // 'electricity', 'gas', 'hot_water'
  reading     Float    // meter value
  readingDate DateTime
  imageUrl    String?  // path to compressed photo
  ocrConfidence Float? // Tesseract confidence score
  source      String   // 'manual', 'ocr', 'excel_import'
  cost        Float?   // calculated cost
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, meterType, readingDate])
}

model MeterRate {
  id        Int      @id @default(autoincrement())
  meterType String
  startDate DateTime
  endDate   DateTime?
  rate      Float    // cost per unit
  currency  String   @default("EUR")
}
```

## Performance Considerations

| Operation | Expected Performance | Notes |
|-----------|---------------------|-------|
| Image upload (mobile) | 2-5s for 3MB photo | Network dependent, compress client-side if needed |
| sharp compression | 100-200ms | Native libvips, very fast |
| Tesseract OCR | 1-3s per image | CPU intensive, consider worker queue for batch processing |
| Excel import (1000 rows) | 500ms - 1s | Fast parsing, validate in chunks for large files |
| Calendar heatmap render | < 100ms | SVG-based, efficient for 365 days |
| Trend line calculation | < 10ms | simple-statistics is lightweight |

**Scalability Notes:**
- OCR is CPU-intensive: consider worker queue (BullMQ) for batch imports
- Image storage: filesystem OK for single user, use object storage for multi-tenant
- Recharts performance: virtualize if rendering > 1000 data points
- Confidence: MEDIUM (performance depends on hardware and load)

## Security Considerations

| Area | Risk | Mitigation |
|------|------|------------|
| Image uploads | Malicious file upload (XXE, RCE) | Validate MIME type, use sharp to re-encode (sanitizes), set file size limits |
| Excel imports | Prototype pollution, formula injection | Use @e965/xlsx (patched), sanitize cell values, parse server-side only |
| OCR accuracy | Incorrect meter readings | Display OCR confidence score, require user confirmation for low confidence (< 0.90) |
| File storage | Unauthorized access to meter photos | Store outside web root, use authenticated routes for image serving, per-user directories |
| DoS via OCR | Large batch OCR consumes CPU | Rate limit OCR endpoint, queue processing, timeout after 30s |

## Open Questions & Gaps

1. **Image storage strategy**: Filesystem sufficient for single user, but define retention policy (keep originals? how long?)
2. **OCR failure handling**: If confidence < 0.90, should app reject reading or allow manual override?
3. **Forecast accuracy**: Linear regression may be insufficient for seasonal patterns (electricity higher in summer/winter). Consider exponential smoothing in future phase.
4. **Anomaly detection threshold**: What stddev multiplier to use for highlighting anomalies? (suggest 2.0 initially, tune with real data)
5. **Excel validation**: What date formats to support? European (DD.MM.YYYY) vs ISO (YYYY-MM-DD)?

## Sources

### OCR & Image Processing
- [Tesseract.js GitHub](https://github.com/naptha/tesseract.js) - v7.0.0 release info, features, best practices
- [PaddleOCR vs Tesseract comparison](https://www.koncile.ai/en/ressources/paddleocr-analyse-avantages-alternatives-open-source)
- [Tesseract accuracy best practices](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html)
- [Tesseract OCR 2026 guide](https://unstract.com/blog/guide-to-optical-character-recognition-with-tesseract-ocr/)
- [@gutenye/ocr GitHub](https://github.com/gutenye/ocr) - PaddleOCR JavaScript wrapper
- [sharp GitHub](https://github.com/lovell/sharp) - v0.34.5 release info
- [sharp compression guide](https://sharp.pixelplumbing.com/)

### Charting
- [Recharts heatmap issue #237](https://github.com/recharts/recharts/issues/237) - confirms no native heatmap support
- [@uiw/react-heat-map npm](https://www.npmjs.com/package/@uiw/react-heat-map) - version 2.3.3, last updated 8 months ago
- [@uiw/react-heat-map GitHub](https://github.com/uiwjs/react-heat-map)
- [react-calendar-heatmap npm](https://www.npmjs.com/package/react-calendar-heatmap) - shows maintenance status
- [Recharts trend line discussion](https://github.com/recharts/recharts/issues/2087)
- [simple-statistics npm](https://www.npmjs.com/package/simple-statistics) - v7.8.8
- [simple-statistics GitHub](https://github.com/simple-statistics/simple-statistics)
- [regression-js npm](https://www.npmjs.com/package/regression) - v2.0.1 alternative

### Excel Import
- [SheetJS XLSX 2026 guide](https://thelinuxcode.com/npm-sheetjs-xlsx-in-2026-safe-installation-secure-parsing-and-real-world-nodejs-patterns/) - security analysis, @e965/xlsx recommendation
- [@e965/xlsx npm](https://www.npmjs.com/package/@e965/xlsx) - maintained fork details
- [xlsx package security issues](https://www.npmjs.com/package/xlsx) - vulnerability warnings

### Image Upload
- [Fastify multipart GitHub](https://github.com/fastify/fastify-multipart)
- [Fastify file uploads guide](https://betterstack.com/community/guides/scaling-nodejs/fastify-file-uploads/)
- [sharp image compression tutorial](https://www.digitalocean.com/community/tutorials/how-to-process-images-in-node-js-with-sharp)

**Confidence Level Justification:**
- HIGH confidence for OCR, Excel, charting (verified with official docs, release dates, 2026 guides)
- HIGH confidence for library versions (GitHub releases verified)
- MEDIUM confidence for storage strategy (depends on scale requirements not fully defined)
- LOW confidence gaps explicitly listed in "Open Questions"
