import { ImportAdapter, ImportResult } from './import-adapter.interface';
import { parse as parseCsv } from 'csv-parse/sync';
import { parse as parseDate, format as formatDate } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

type DateFormat = 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd';

export class ClockifyCsvAdapter implements ImportAdapter {
  async parse(fileContent: string, timezone?: string): Promise<ImportResult> {
    const result: ImportResult = { entries: [], errors: [] };

    try {
      let cleanContent = fileContent;
      if (cleanContent.charCodeAt(0) === 0xFEFF) {
        cleanContent = cleanContent.slice(1);
      }
      cleanContent = cleanContent.trim();

      const records = parseCsv(cleanContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      }) as Record<string, string>[];

      console.log(`[Clockify] ${records.length} Zeilen gefunden.`);

      const dateFormat = this.detectDateFormat(records);

      for (const row of records) {
        // Clockify "Detailed Report" CSV columns (locale-dependent):
        // "Project","Client","Description","Task","User","Group","Email","Tags","Billable",
        // "Start Date","Start Time","End Date","End Time","Duration (h)","Duration (decimal)", ...
        const dateStr = row['Start Date'];
        const timeStr = row['Start Time'];

        if (!dateStr) continue;

        const tz = timezone || 'UTC';
        const parsedLocal = parseDate(
          `${dateStr} ${timeStr || '00:00:00'}`,
          `${dateFormat} HH:mm:ss`,
          new Date(0)
        );
        if (isNaN(parsedLocal.getTime())) {
          result.errors.push(`Ungültiges Datum: "${dateStr} ${timeStr ?? ''}"`);
          continue;
        }
        const entryDate = fromZonedTime(formatDate(parsedLocal, "yyyy-MM-dd'T'HH:mm:ss"), tz);

        const duration = this.parseDuration(row);
        if (isNaN(duration) || duration <= 0) continue;

        const project = row['Project'] || 'No Project';
        const description = row['Description'] || '';

        const syntheticId = `CSV_CLOCKIFY_${entryDate.getTime()}_${project.replace(/\s/g, '')}`;

        const startTime = timeStr ? timeStr.substring(0, 5) : null;
        const endTimeStr = row['End Time'];
        const endTime = endTimeStr ? endTimeStr.substring(0, 5) : null;

        result.entries.push({
          source: 'CLOCKIFY',
          externalId: syntheticId,
          date: entryDate,
          duration,
          project,
          description,
          startTime,
          endTime,
        });
      }

      if (records.length > 0 && result.entries.length === 0) {
        const hasStartDate = records[0] && 'Start Date' in records[0];
        if (!hasStartDate) {
          result.errors.push(
            `Keine Einträge gefunden (${records.length} Zeilen). Bitte einen detaillierten Clockify-Bericht verwenden (mit Spalten: Start Date, Start Time, Duration (h), Project, Description).`
          );
        } else {
          result.errors.push(
            `Keine gültigen Einträge gefunden (${records.length} Zeilen). Bitte das CSV-Format prüfen.`
          );
        }
      }
    } catch (error) {
      result.errors.push(`Failed to parse Clockify CSV: ${(error as Error).message}`);
    }

    return result;
  }

  private parseDuration(row: Record<string, string>): number {
    // Prefer the HH:MM:SS columns ("Duration (h)" or bare "Duration") since they preserve
    // second-level precision. Fall back to "Duration (decimal)" which Clockify rounds to
    // two decimals (lossy by up to ~36 seconds).
    const hhmmss = [row['Duration (h)'], row['Duration']];
    for (const raw of hhmmss) {
      if (!raw) continue;
      if (raw.includes(':')) {
        const parts = raw.split(':').map(Number);
        if (parts.length === 3 && parts.every(n => !isNaN(n))) return parts[0] + parts[1] / 60 + parts[2] / 3600;
        if (parts.length === 2 && parts.every(n => !isNaN(n))) return parts[0] + parts[1] / 60;
      }
    }

    const decimal = row['Duration (decimal)'];
    if (decimal !== undefined && decimal !== '') {
      const value = parseFloat(decimal.replace(',', '.'));
      if (!isNaN(value)) return value;
    }

    // Last resort: a numeric "Duration" without ":".
    const bare = row['Duration'];
    if (bare && !bare.includes(':')) {
      const value = parseFloat(bare.replace(',', '.'));
      if (!isNaN(value)) return value;
    }
    return 0;
  }

  private detectDateFormat(records: Record<string, string>[]): DateFormat {
    let sawDdMmHint = false;
    let sawMmDdHint = false;
    for (const row of records) {
      const dateStr = row['Start Date'];
      if (!dateStr) continue;
      if (dateStr.includes('-')) return 'yyyy-MM-dd';
      const parts = dateStr.split('/');
      if (parts.length !== 3) continue;
      const first = Number(parts[0]);
      const second = Number(parts[1]);
      if (first > 12) sawDdMmHint = true;
      if (second > 12) sawMmDdHint = true;
    }
    if (sawMmDdHint && !sawDdMmHint) return 'MM/dd/yyyy';
    return 'dd/MM/yyyy';
  }
}
