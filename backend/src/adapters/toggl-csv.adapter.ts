import { ImportAdapter, ImportResult } from './import-adapter.interface';
import { parse } from 'csv-parse/sync';
import { fromZonedTime } from 'date-fns-tz';

export class TogglCsvAdapter implements ImportAdapter {
async parse(fileContent: string, timezone?: string): Promise<ImportResult> {
    const result: ImportResult = { entries: [], errors: [] };

    try {
      // 1. Bereinigung: BOM manuell entfernen
      // Manche Dateien starten mit unsichtbaren Zeichen (\uFEFF), die den Parser verwirren.
      let cleanContent = fileContent;
      if (cleanContent.charCodeAt(0) === 0xFEFF) {
        cleanContent = cleanContent.slice(1);
      }
      cleanContent = cleanContent.trim(); // Leerzeichen am Anfang/Ende weg

      // 2. Parsen
      const records = parse(cleanContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true, // Toleranter bei Anführungszeichen
      }) as Record<string, string>[];

      console.log(`[Toggl] ${records.length} Zeilen gefunden.`);

      for (const row of records) {
        // Expected columns based on "Detailed Report":
        // "Description","Duration","Project","Start date","Start time"

        // Combine Date and Time into ISO Date Object
        // Format in CSV: 2025-12-05 (ISO-like)
        const dateStr = row['Start date']; 
        const timeStr = row['Start time'];

        if (!dateStr) continue;

        // Convert local date+time to UTC using the provided timezone
        const tz = timezone || 'UTC';
        const entryDate = fromZonedTime(`${dateStr}T${timeStr || '00:00:00'}`, tz);
        // Full datetime for synthetic ID uniqueness
        const fullDateTime = entryDate;

        const durationRaw = row['Duration'];
        const duration = this.parseDuration(durationRaw);
        if (isNaN(duration) || duration <= 0) continue;

        const project = row['Project'] || 'No Project';
        const description = row['Description'] || '';

        // Synthetische ID: Datum + Zeit + Projekt als Eindeutigkeitsmerkmal
        const syntheticId = `CSV_TOGGL_${fullDateTime.getTime()}_${project.replace(/\s/g, '')}`;

        // Extract start/stop times as HH:mm
        const startTime = timeStr ? timeStr.substring(0, 5) : null;
        const stopTimeStr = row['Stop time'];
        const endTime = stopTimeStr ? stopTimeStr.substring(0, 5) : null;

        result.entries.push({
          source: 'TOGGL',
          externalId: syntheticId,
          date: entryDate,
          duration: duration,
          project: project,
          description: description,
          startTime,
          endTime,
        });
      }

      // Warn if CSV had rows but no entries were parsed (likely wrong report type)
      if (records.length > 0 && result.entries.length === 0) {
        const hasStartDate = records[0] && 'Start date' in records[0];
        if (!hasStartDate) {
          result.errors.push(
            `Keine Einträge gefunden (${records.length} Zeilen). Möglicherweise ist dies ein Toggl-Zusammenfassungsbericht. Bitte einen detaillierten Bericht verwenden (mit Spalten: Start date, Start time, Duration, Project, Description).`
          );
        } else {
          result.errors.push(
            `Keine gültigen Einträge gefunden (${records.length} Zeilen). Bitte das CSV-Format prüfen.`
          );
        }
      }
    } catch (error) {
      result.errors.push(`Failed to parse Toggl CSV: ${(error as Error).message}`);
    }

    return result;
  }

  private parseDuration(input: string): number {
    if (!input) return 0;

    // Fall A: HH:MM:SS Format
    if (input.includes(':')) {
        const parts = input.split(':').map(Number);
        // Stunden + Minuten/60 + Sekunden/3600
        let hours = 0;
        if (parts.length === 3) {
            hours = parts[0] + parts[1] / 60 + parts[2] / 3600;
        } else if (parts.length === 2) {
            hours = parts[0] + parts[1] / 60;
        }
        return hours;
    }

    // Fall B: Dezimal (z.B. "1.5")
    return parseFloat(input);
  }
}
