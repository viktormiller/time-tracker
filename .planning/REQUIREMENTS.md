# Requirements: Time Tracker Dashboard v2.0

**Defined:** 2026-02-06
**Core Value:** See all important numbers in one place — worked hours and utility consumption, regardless of source.

## v2.0 Requirements

Requirements for utility meter tracking milestone. Each maps to roadmap phases.

### Data Foundation

- [ ] **DATA-01**: User can create a meter (Strom/Gas/Wasser Warm) with name and unit
- [ ] **DATA-02**: User can add a meter reading with date and raw value
- [ ] **DATA-03**: User can edit an existing meter reading
- [ ] **DATA-04**: User can delete a meter reading
- [ ] **DATA-05**: App calculates monthly consumption as delta between consecutive readings
- [ ] **DATA-06**: App validates meter readings are monotonically increasing (new reading >= previous)

### Input Methods

- [ ] **INPUT-01**: User can manually enter a meter reading via form (meter type, date, value)
- [ ] **INPUT-02**: User can import historical readings from Excel (.xlsx) file
- [ ] **INPUT-03**: Excel import shows preview of parsed data before saving
- [ ] **INPUT-04**: Excel import handles German date formats (DD.MM.YYYY) and ISO dates

### Visualization

- [ ] **VIS-01**: User can view year-over-year bar chart with selectable comparison ranges (2/3/5 years)
- [ ] **VIS-02**: User can view consumption trend lines over time
- [ ] **VIS-03**: User can view cumulative yearly tracker (running total by year, overlaid)
- [ ] **VIS-04**: User can see months flagged where consumption deviates significantly from historical average
- [ ] **VIS-05**: User can view seasonal heatmap (months × years, color-coded by intensity)
- [ ] **VIS-06**: User can view forecast projection for remaining months of current year
- [ ] **VIS-07**: User can switch between meter types (Strom/Gas/Wasser) on all charts

### Navigation & Integration

- [ ] **NAV-01**: User can navigate to Utilities section from main navigation
- [ ] **NAV-02**: Utilities section shares authentication with time tracking
- [ ] **NAV-03**: Utilities section inherits dark mode / theme from existing app

## v2.1 Requirements

Deferred to next milestone. Tracked but not in current roadmap.

### OCR Input

- **OCR-01**: User can upload a photo of a digital meter display
- **OCR-02**: App extracts meter reading from photo using OCR
- **OCR-03**: Extracted value is shown for user confirmation before saving
- **OCR-04**: User can correct OCR-extracted value before saving

### Cost Tracking

- **COST-01**: User can configure per-unit cost rates (€/kWh, €/m³)
- **COST-02**: User can view cost overlay on consumption charts
- **COST-03**: User can track rate changes over time

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Smart meter API integration | Manual input + Excel import sufficient for v2.0 |
| Analog meter dial OCR | Only digital displays; analog adds significant complexity |
| Multi-user utility tracking | Single user app, architecture supports expansion |
| Utility bill PDF parsing | Excel import covers historical data needs |
| Real-time meter monitoring | Manual monthly readings sufficient |
| Appliance-level disaggregation | Overengineered for personal tracking |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 7 | Pending |
| DATA-02 | Phase 7 | Pending |
| DATA-03 | Phase 7 | Pending |
| DATA-04 | Phase 7 | Pending |
| DATA-05 | Phase 7 | Pending |
| DATA-06 | Phase 7 | Pending |
| INPUT-01 | Phase 8 | Pending |
| INPUT-02 | Phase 9 | Pending |
| INPUT-03 | Phase 9 | Pending |
| INPUT-04 | Phase 9 | Pending |
| VIS-01 | Phase 8 | Pending |
| VIS-02 | Phase 8 | Pending |
| VIS-03 | Phase 10 | Pending |
| VIS-04 | Phase 10 | Pending |
| VIS-05 | Phase 10 | Pending |
| VIS-06 | Phase 10 | Pending |
| VIS-07 | Phase 8 | Pending |
| NAV-01 | Phase 7 | Pending |
| NAV-02 | Phase 7 | Pending |
| NAV-03 | Phase 7 | Pending |

**Coverage:**
- v2.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 after roadmap creation*
