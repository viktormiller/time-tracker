import { ImportAdapter, ImportResult } from './import-adapter.interface';
import { parse } from 'csv-parse/sync';

export class TogglCsvAdapter implements ImportAdapter {
async parse(fileContent: string): Promise<ImportResult> {
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

        const fullDate = new Date(`${dateStr}T${timeStr || '00:00:00'}`);

        // Duration in Toggl CSV is often "HH:MM:SS" or decimal. 
        // Based on user example: "0.02" (decimal hours).
        // Let's handle both just in case, but assume decimal based on example.
        let duration = parseFloat(row['Duration']);

        // If parsing fails or is 0, skip
        if (isNaN(duration) || duration === 0) continue;

        result.entries.push({
          source: 'TOGGL',
          externalId: null, // Detailed report doesn't always have IDs
          date: fullDate,
          duration: duration,
          project: row['Project'] || 'No Project',
          description: row['Description'] || '',
        });
      }
    } catch (error) {
      result.errors.push(`Failed to parse Toggl CSV: ${(error as Error).message}`);
    }

    return result;
  }
}
