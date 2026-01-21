import { mkConfig, generateCsv, download } from 'export-to-csv';
import { format, parseISO } from 'date-fns';

interface TimeEntry {
  id: string;
  date: string;
  duration: number;
  project: string;
  description: string;
  source: string;
}

/**
 * Sanitizes CSV field values to prevent formula injection attacks.
 * If a field starts with =, +, -, or @, it's prefixed with a single quote.
 */
function sanitizeCsvField(value: string | number): string {
  const stringValue = String(value);
  const dangerousChars = ['=', '+', '-', '@'];

  if (dangerousChars.some(char => stringValue.startsWith(char))) {
    return `'${stringValue}`;
  }

  return stringValue;
}

/**
 * Exports time entries to CSV file with proper sanitization.
 */
export function exportToCSV(
  entries: TimeEntry[],
  dateRange: { start: Date; end: Date }
): void {
  // Configure CSV export
  const csvConfig = mkConfig({
    filename: `timetracker-${format(dateRange.start, 'yyyy-MM-dd')}-to-${format(dateRange.end, 'yyyy-MM-dd')}`,
    useKeysAsHeaders: false,
    columnHeaders: ['Datum', 'Stunden', 'Quelle', 'Beschreibung', 'Projekt'],
  });

  // Map entries to sanitized row objects
  const sanitizedData = entries.map(entry => ({
    Datum: sanitizeCsvField(format(parseISO(entry.date), 'yyyy-MM-dd HH:mm')),
    Stunden: sanitizeCsvField(entry.duration.toFixed(2)),
    Quelle: sanitizeCsvField(entry.source),
    Beschreibung: sanitizeCsvField(entry.description),
    Projekt: sanitizeCsvField(entry.project),
  }));

  // Generate and download CSV
  const csv = generateCsv(csvConfig)(sanitizedData);
  download(csvConfig)(csv);
}
