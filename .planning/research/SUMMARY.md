# Project Research Summary

**Project:** Time Tracker Dashboard v2.0 - Utility Tracking Milestone
**Domain:** Household utility meter tracking with OCR and advanced analytics
**Researched:** 2026-02-06
**Confidence:** HIGH

## Executive Summary

This milestone adds household utility meter tracking (Strom/Gas/Wasser Warm) to an existing time tracking dashboard. Research reveals a mature domain with clear patterns: successful utility tracking apps start simple (manual entry + basic charts) and add intelligence gradually (OCR, anomaly detection, forecasting). The recommended approach is a three-phase rollout: Phase 1 establishes manual entry and basic visualization using existing infrastructure; Phase 2 adds OCR and Excel import for convenience; Phase 3 layers on advanced analytics once sufficient data exists.

The existing stack (React+Vite+TS frontend, Fastify+TS backend, PostgreSQL+Prisma, Docker Compose) is well-suited for this expansion. New dependencies are minimal: Tesseract.js for OCR, @uiw/react-heat-map for calendar visualization (Recharts lacks this), simple-statistics for forecasting, and @e965/xlsx for Excel import. All integrate cleanly with existing architecture using parallel domain separation - meter tracking shares authentication and infrastructure while maintaining independent data models.

The primary risk is OCR accuracy overconfidence. Research shows digital meter OCR achieves only 55-63% accuracy without proper preprocessing and custom training data. Prevention requires server-side image preprocessing (sharp), seven-segment display training data, confidence thresholds (reject below 85%), and always requiring user confirmation. Secondary risks include data integrity (readings must monotonically increase), image storage architecture (filesystem not database), and chart performance with multi-year data (requires memoization and lazy loading). All are preventable with correct upfront decisions documented in PITFALLS.md.

## Key Findings

### Recommended Stack

The existing stack requires minimal additions. OCR capabilities come from Tesseract.js v7 running server-side with sharp preprocessing. Advanced charting needs @uiw/react-heat-map (Recharts confirmed cannot do calendar heatmaps per GitHub issue #237) and simple-statistics for trend line calculations. Excel import uses @e965/xlsx, a maintained fork replacing the abandoned vulnerable xlsx package.

**Core additions:**
- **Tesseract.js v7**: Server-side OCR with 95%+ accuracy when properly preprocessed - digit whitelist, seven-segment training data, contrast enhancement via sharp
- **sharp v0.34.5**: Image preprocessing and compression - 4-5x faster than alternatives, essential for OCR pipeline and storage optimization
- **@uiw/react-heat-map v2.3.3**: Calendar heatmap visualization - Recharts lacks native support, this provides GitHub-style contribution graphs for seasonal patterns
- **simple-statistics v7.8.8**: Forecasting and anomaly detection - lightweight linear regression, standard deviation calculations for trend lines
- **@e965/xlsx**: Excel parsing - maintained fork of abandoned xlsx package (has Prototype Pollution vulnerabilities), auto-publishes from official SheetJS repo

**Integration advantages:**
- Existing @fastify/multipart (v8.3.0) handles image uploads
- Existing Recharts (v3.5.1) covers 6 of 7 chart types
- Existing Prisma/PostgreSQL for database
- Existing JWT auth wraps all new endpoints
- No conflicting dependencies, all compatible with Node 18+ and React 19.2.0

### Expected Features

Research identified clear feature tiers. Table stakes (manual entry, consumption calculation, year-over-year charts, cost estimation, Excel import) achieve parity with spreadsheets - the baseline expectation. Differentiators (OCR, seasonal heatmap, anomaly detection, forecasting) provide value beyond Excel but require 12+ months of data and more complex implementation.

**Must have (table stakes for v2.0 MVP):**
- Manual meter reading entry (date, meter type, value) - foundational data input
- Consumption calculation (current minus previous reading) - core value proposition
- Reading history with edit/delete - users verify past entries
- Multi-meter support (Strom/Gas/Wasser Warm) - German households have 3 separate meters
- Year-over-year comparison bars - primary reason to move from spreadsheet
- Cost estimation with configurable rates - users care about bills not just kWh
- Excel/CSV import - migration path for existing historical data
- Mobile-friendly forms - meter reading happens at physical location

**Should have (differentiators for v2.1+):**
- OCR meter reading from photos - eliminates transcription errors, 40% faster entry
- Seasonal heatmap visualization - reveals usage patterns at glance
- Photo attachments - proof of reading for disputed bills
- Anomaly detection alerts - "Your Gas usage is 40% higher than typical February"
- Consumption forecasting - predict end-of-year totals for budgeting
- Rate period tracking - handle German Hochtarif/Niedertarif electricity splits

**Defer (explicitly anti-features):**
- Smart meter API integration - too complex, each utility different, limited ROI
- Appliance-level disaggregation - requires expensive hardware, 40-60% accuracy per research
- Social features/leaderboards - privacy concerns, demotivating for high consumers
- Daily tracking granularity - causes survey fatigue, monthly cadence matches billing

### Architecture Approach

The architecture uses parallel domain separation: meter tracking shares infrastructure (auth, theme, navigation, database) while maintaining clean separation from time tracking concerns. This is architecturally correct because the domains share no business logic and could be extracted to microservices if needed.

**Major components:**

1. **Frontend: Utilities.tsx page** - New top-level view parallel to Dashboard/Estimates, contains MeterReadingsList, ManualEntryForm, OCRCapture, ExcelImportModal, UtilityChartGrid, and UtilitySettings. Follows existing patterns from Estimates.tsx.

2. **Backend: utility.routes.ts** - New Fastify plugin with RESTful endpoints (GET/POST/PUT/DELETE /api/utilities/readings, POST /ocr, POST /import, GET /consumption). Uses existing authentication wrapper, Prisma client, multipart plugin, and validation patterns.

3. **Services layer** - Three new services: ocr.service.ts (Tesseract wrapper with preprocessing), excel-import.service.ts (xlsx parsing with date format handling), consumption-calculator.service.ts (delta calculations with meter rollover handling). Keeps complex logic out of routes.

4. **Database schema** - Two new Prisma models: MeterReading (id, meterType enum, readingDate, value, source enum, metadata JSON for OCR confidence) and MeterSettings (per-meter cost configuration). Consumption is calculated on-demand, not stored, for data integrity.

5. **Image storage** - Filesystem storage at /uploads/meter-photos/{year}/{month}/{filename}.webp, NOT database storage. Sharp compresses before saving. Authenticated serving via /api/meters/images/:year/:month/:filename. Docker volume mount for persistence.

**Integration minimal:** Only 10 lines of changes to existing files (add utility routes to server.ts, add 'utilities' view to App.tsx navigation). All new features in new files with clean separation.

### Critical Pitfalls

Research identified five pitfalls that cause rewrites or data loss if not addressed upfront.

1. **OCR accuracy overconfidence** - Assuming OCR "just works" leads to 55-63% accuracy and user frustration. Prevention: server-side preprocessing pipeline (grayscale, normalize, threshold), seven-segment display training data (tessdata_ssd), confidence thresholds >85%, always show extracted value for user confirmation before saving. Phase 1 critical.

2. **Meter reading data integrity violations** - Storing readings without monotonic increase validation allows physically impossible data (consumption negative). Prevention: database trigger enforcing reading > previous reading, application-level validation with historical average checks (reject if >10x monthly average), unique constraint on (meterType, readingDate). Phase 0 schema design critical.

3. **Image storage architecture wrong** - Storing photos as PostgreSQL BYTEA bloats database from 50MB to 5GB+ for single user. Prevention: filesystem storage with Docker volume, sharp compression (resize 1080px, quality 85, convert WebP), authenticated endpoint for serving, path stored in database not bytes. Phase 0 architecture critical.

4. **Excel date parsing locale chaos** - German date formats (dd.MM.yyyy) mixed with ISO dates causes 6-month offset errors. Prevention: try multiple date formats (German, ISO, US, EU), handle Excel numeric dates (days since 1900-01-01), timezone conversion to Europe/Berlin, preview first 10 rows before import to catch errors. Phase 1 Excel import critical.

5. **Recharts performance cliff** - 288 data points across 7 charts = 2016 DOM elements, 3+ second lag on filter changes. Prevention: useMemo for aggregations, Zustand instead of Context for filter state (prevents all-chart re-renders), lazy load chart types, server-side aggregation for large date ranges, React.memo on chart components. Phase 2 chart implementation critical.

## Implications for Roadmap

Based on dependency analysis, data requirements, and risk mitigation, a three-phase approach is optimal.

### Phase 1: Foundation & Manual Entry (v2.0 MVP - 2 weeks)

**Rationale:** Manual entry with basic visualization delivers immediate value (spreadsheet replacement) with no complex dependencies. Establishes data model, validates user workflow, and provides foundation for advanced features. All LOW complexity features from FEATURES.md.

**Delivers:**
- Database schema (MeterReading, MeterSettings models with constraints)
- Backend CRUD API (GET/POST/PUT/DELETE /api/utilities/readings)
- Manual entry form (mobile-optimized, meter type selector, date+value inputs)
- Readings list (table with edit/delete, sorted by date descending)
- Consumption calculation service (handles meter rollovers)
- Basic charts (trend line, year-over-year bars, cost overlay using existing Recharts)
- Settings page (configure cost per kWh/m³ for each meter type)
- Data export (CSV download)

**Addresses features:**
- Manual meter reading entry (table stakes)
- Consumption calculation (table stakes)
- Reading history view (table stakes)
- Multi-meter support (table stakes)
- Current period summary (table stakes)
- Year-over-year comparison (table stakes)
- Cost estimation (table stakes)
- Mobile-friendly interface (table stakes)

**Avoids pitfalls:**
- Implements monotonic increase validation from day one (Pitfall #2)
- Uses filesystem storage for future image support (Pitfall #3)
- Proper date handling with date-fns-tz for German timezone (Pitfall #4)
- Memoizes chart data calculations upfront (Pitfall #5)

**Research flags:** SKIP - standard CRUD patterns, well-documented Prisma/Fastify/Recharts usage.

### Phase 2: Import & OCR Convenience (v2.1 - 2 weeks)

**Rationale:** Once manual workflow validated, add convenience features for data migration (Excel import) and faster entry (OCR). These are MEDIUM-HIGH complexity and independent - can be built in parallel. Excel import enables immediate visualization of historical data. OCR differentiates from spreadsheets but isn't blocking for launch.

**Delivers:**
- Excel import service (@e965/xlsx parser, multi-format date handling, validation preview)
- Excel import modal (file upload, show first 10 rows, error highlighting, bulk undo)
- OCR service (Tesseract.js with sharp preprocessing, seven-segment training data)
- OCR capture modal (camera/file input, image preview, value extraction, confidence display)
- Photo attachments (link readings to meter photos for audit trail)
- Image storage (filesystem with Docker volume, compressed WebP)

**Addresses features:**
- Excel import for historical data (table stakes)
- OCR meter reading from photos (differentiator)
- Photo attachment to readings (differentiator)

**Avoids pitfalls:**
- OCR preprocessing pipeline with confidence thresholds (Pitfall #1)
- Multi-format date parsing with preview (Pitfall #4)
- Image storage architecture correct from start (Pitfall #3)

**Research flags:** OCR REQUIRES deeper research:
- Test Tesseract.js accuracy on real German meter photos (digital vs analog displays)
- Validate preprocessing pipeline parameters (contrast, threshold, resize)
- Benchmark confidence score correlation with actual accuracy
- Determine if seven-segment training data (tessdata_ssd) improves results
- Prototype before committing to OCR feature (may defer if accuracy insufficient)

### Phase 3: Advanced Analytics (v2.2-v2.3 - 3 weeks)

**Rationale:** Intelligence layer requires 12+ months of data to be meaningful. By Phase 3, users have imported historical data and collected new readings. These features differentiate from basic tracking but aren't essential for launch. MEDIUM-HIGH complexity, benefits from stable data foundation.

**Delivers:**
- Seasonal heatmap (@uiw/react-heat-map calendar visualization)
- Anomaly detection (simple-statistics for mean/stddev, seasonal baseline, configurable thresholds)
- Consumption forecasting (linear regression with simple-statistics, 6-month projection)
- Cumulative area chart (running total visualization)
- Rate period tracking (Hochtarif/Niedertarif for German electricity)
- Goal setting (define reduction target, track progress)

**Addresses features:**
- Seasonal heatmap visualization (differentiator)
- Anomaly detection alerts (differentiator)
- Consumption forecasting (differentiator)
- Rate period tracking (should-have)
- Goal setting (nice-to-have)

**Avoids pitfalls:**
- Server-side anomaly calculation (prevents client-side performance cliff from Pitfall #5)
- Lazy loading of advanced chart types (prevents rendering 2000+ DOM elements)
- Seasonal baseline instead of annual average (reduces false positives)

**Research flags:** Anomaly detection REQUIRES validation:
- Define "anomaly" threshold for residential German utility consumption
- Determine if seasonal adjustment is sufficient or if heating degree days needed
- Test false positive rate with real user data
- Research typical winter/summer consumption variation for Germany

### Phase Ordering Rationale

- **Phase 1 must precede all others**: Database schema and data model are foundational. Manual entry validates workflow before investing in convenience features. Basic charts provide immediate value and validate chart performance patterns.

- **Phase 2 features are independent**: Excel import and OCR can be built in parallel or either deferred. Excel import has no OCR dependency. Both benefit from Phase 1's stable CRUD API and validated data model.

- **Phase 3 requires Phase 1 data**: Anomaly detection needs historical baseline. Forecasting needs time series data. Seasonal heatmap is meaningless without 12 months. Excel import (Phase 2) accelerates reaching this threshold but isn't blocking - users can manual-enter monthly until data accumulates.

- **Pitfall mitigation aligns with phases**: Phase 0 architecture decisions (schema constraints, image storage) prevent rewrites. Phase 1 implements data integrity. Phase 2 addresses OCR and Excel import risks. Phase 3 tackles chart performance at scale.

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 2 - OCR Implementation**: Test Tesseract.js accuracy on real German meters (digital 7-segment displays). Validate preprocessing pipeline. Benchmark tessdata_ssd vs default models. If accuracy <85%, defer OCR to v3.0+ or consider cloud OCR APIs.

- **Phase 3 - Anomaly Detection**: Research typical German household consumption patterns (winter heating, summer cooling). Define baseline calculation (monthly average vs seasonal vs prior year same month). Determine threshold multiplier (1.5x? 2x?). Validate false positive rate with test data.

**Phases with standard patterns (skip research-phase):**

- **Phase 1 - Foundation**: CRUD API, Prisma models, Recharts, form validation - all well-documented patterns in existing codebase.

- **Phase 2 - Excel Import**: Date parsing edge cases documented extensively. @e965/xlsx has clear examples. Preview-before-import UX is established pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Tesseract.js, sharp, @uiw/react-heat-map, simple-statistics all verified with v7/v0.34/v2.3/v7.8 releases. @e965/xlsx security analysis confirms maintenance. All compatible with existing Node 18+/React 19.2. |
| Features | MEDIUM-HIGH | Table stakes features validated across multiple utility tracking apps (Home Assistant, commercial apps). Differentiators (OCR, anomaly detection) have established patterns but need German-specific validation. Anti-features clearly documented (smart meter integration, appliance disaggregation). |
| Architecture | HIGH | Parallel domain separation is correct pattern. Existing infrastructure supports minimal-change integration. Database schema follows meter data management best practices. Image storage filesystem approach verified by PostgreSQL wiki and multiple sources. |
| Pitfalls | HIGH | OCR accuracy issues documented in academic research (MDPI 55-63% baseline). Image storage in database problems confirmed by PostgreSQL official guidance. Excel date parsing chaos extensively documented. Recharts performance issues confirmed in GitHub issues #1465, #1146. |

**Overall confidence:** HIGH

Research is comprehensive with primary sources (official docs, academic papers, GitHub releases) for technology choices and pitfalls. Medium confidence on German-specific details (meter display formats, seasonal consumption patterns) due to lack of Germany-specific sources - these require validation with actual user data during Phase 2-3 implementation.

### Gaps to Address

Areas where research was inconclusive or needs validation during implementation:

- **German meter display formats**: Research covers generic digital meter OCR but not specifically German Strom/Gas/Wasser Warm meter manufacturers (e.g., ISKRA, EMH, Elster). Validate during Phase 2 OCR prototype with user's actual meter photos before committing to feature.

- **Seasonal consumption baselines**: No Germany-specific residential utility consumption data found. Typical winter/summer variation unknown. Impacts anomaly detection thresholds. Collect user's historical data during Phase 1 to establish baseline before implementing Phase 3 anomaly detection.

- **German utility rate structures**: Research shows Hochtarif/Niedertarif exists for electricity but not clear how common this is or how to handle rate changes mid-billing period. Validate with user's actual utility bills during Phase 1 cost estimation implementation.

- **OCR accuracy on analog meters**: Research focuses on digital 7-segment displays. User may have analog meters with rotating dials (especially for older Gas/Water meters). If OCR accuracy <50% on analog, limit OCR feature to digital meters only and recommend manual entry for analog.

- **Chart priority**: FEATURES.md lists 7 chart types but doesn't specify which are most valuable to user. Clarify during Phase 1: start with trend line and year-over-year bars (clearly table stakes), add others in Phase 3 based on user feedback.

- **Excel data quality**: User has historical Excel data from 2018-2025. Unknown if data is complete (no gaps), consistent format, or has errors. Request sample file before Phase 2 Excel import implementation to test parser with real data.

## Sources

### Primary (HIGH confidence)

**Technology Documentation:**
- Tesseract.js v7.0.0 GitHub release notes and documentation
- sharp v0.34.5 official documentation and performance benchmarks
- @uiw/react-heat-map v2.3.3 npm package and GitHub repository
- simple-statistics v7.8.8 npm package documentation
- @e965/xlsx npm package and SheetJS security analysis (TheLinuxCode 2026)
- Recharts v3.5.1 documentation and GitHub issue #237 (heatmap not supported)
- PostgreSQL Wiki: BinaryFilesInDB (official guidance against storing images)
- Prisma ORM official documentation for migrations and schema design
- Fastify @fastify/multipart v8.3.0 official plugin documentation

**Research Papers & Technical Sources:**
- MDPI: Smart OCR Application for Meter Reading (2024) - documents 55-63% accuracy baseline
- Tesseract.js official best practices guide (tesseract-ocr.github.io)
- GitHub: tessdata_ssd (Shreeshrii) - seven-segment display training data
- Home Assistant: Utility Meter integration documentation
- Itron: Meter data validation standards (official industry source)

**Security Analysis:**
- TheLinuxCode: NPM SheetJS XLSX in 2026 (security analysis, @e965/xlsx recommendation)
- npm security advisories for xlsx package (Prototype Pollution, DoS vulnerabilities)
- Official PostgreSQL documentation on database vs filesystem storage

### Secondary (MEDIUM confidence)

**Ecosystem & Best Practices:**
- LogRocket: Best React chart libraries 2025 (Recharts performance analysis)
- Multiple Medium articles on Tesseract OCR implementation patterns
- Multiple blog posts on Excel date parsing issues and timezone handling
- Refine.dev: Recharts implementation guide with performance tips
- Better Stack: Fastify file uploads guide
- Multiple sources on state management in React 2026 (Context vs Zustand)

**Domain Knowledge:**
- Multiple utility tracking app reviews (Vivint, Home Assistant comparisons)
- German utility cost calculators (how-to-germany.com, enpal.de)
- Energy monitoring best practices (energycap.com, EnergyLens)
- Time series anomaly detection guides (Neptune.ai, VictoriaMetrics)

### Tertiary (LOW confidence, needs validation)

**German-Specific:**
- German utility pricing structures (general sources, not official utility data)
- Seasonal consumption patterns (inferred from general heating/cooling patterns, not Germany-specific data)
- German meter display standards (assumed to follow EU standards, not verified with German specifications)

**Edge Cases:**
- Analog meter OCR accuracy (extrapolated from digital meter research, not tested)
- Forecast accuracy for residential utility data (SARIMA/Prophet research is generic, not utility-specific)
- Anomaly detection false positive rates (based on general time series research, not validated with utility data)

---

*Research completed: 2026-02-06*
*Ready for roadmap: Yes*
*Next step: Define detailed requirements for Phase 1 foundation*
