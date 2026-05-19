import { ImportAdapter, ImportResult } from './import-adapter.interface';
import { parse } from 'csv-parse/sync';
import { fromZonedTime } from 'date-fns-tz';

export class ClockifyCsvAdapter implements ImportAdapter {
  async parse(fileContent: string, timezone?: string): Promise<ImportResult> {
    const result: ImportResult = { entries: [], errors: [] };

    try {
      let cleanContent = fileContent;
      if (cleanContent.charCodeAt(0) === 0xFEFF) {
        cleanContent = cleanContent.slice(1);
      }
      cleanContent = cleanContent.trim();

      const records = parse(cleanContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      }) as Record<string, string>[];

      console.log(`[Clockify] ${records.length} Zeilen gefunden.`);

      for (const row of records) {
        // Clockify "Detailed Report" CSV columns:
        // "Project","Description","Start Date","Start Time","End Date","End Time","Duration (h)"
        const dateStr = row['Start Date'];
        const timeStr = row['Start Time'];

        if (!dateStr) continue;

        const tz = timezone || 'UTC';
        const entryDate = fromZonedTime(`${dateStr}T${timeStr || '00:00:00'}`, tz);

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
    // Prefer decimal hours columns; fall back to HH:MM:SS "Duration".
    const decimal = row['Duration (h)'] ?? row['Duration (decimal)'];
    if (decimal !== undefined && decimal !== '') {
      const value = parseFloat(decimal.replace(',', '.'));
      if (!isNaN(value)) return value;
    }

    const raw = row['Duration'];
    if (!raw) return 0;
    if (raw.includes(':')) {
      const parts = raw.split(':').map(Number);
      if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600;
      if (parts.length === 2) return parts[0] + parts[1] / 60;
    }
    return parseFloat(raw);
  }
}
