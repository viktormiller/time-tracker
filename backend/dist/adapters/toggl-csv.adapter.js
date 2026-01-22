"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TogglCsvAdapter = void 0;
const sync_1 = require("csv-parse/sync");
class TogglCsvAdapter {
    async parse(fileContent) {
        const result = { entries: [], errors: [] };
        try {
            // 1. Bereinigung: BOM manuell entfernen
            // Manche Dateien starten mit unsichtbaren Zeichen (\uFEFF), die den Parser verwirren.
            let cleanContent = fileContent;
            if (cleanContent.charCodeAt(0) === 0xFEFF) {
                cleanContent = cleanContent.slice(1);
            }
            cleanContent = cleanContent.trim(); // Leerzeichen am Anfang/Ende weg
            // 2. Parsen
            const records = (0, sync_1.parse)(cleanContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_quotes: true, // Toleranter bei Anführungszeichen
            });
            console.log(`[Toggl] ${records.length} Zeilen gefunden.`);
            for (const row of records) {
                // Expected columns based on "Detailed Report":
                // "Description","Duration","Project","Start date","Start time"
                // Combine Date and Time into ISO Date Object
                // Format in CSV: 2025-12-05 (ISO-like)
                const dateStr = row['Start date'];
                const timeStr = row['Start time'];
                if (!dateStr)
                    continue;
                const fullDate = new Date(`${dateStr}T${timeStr || '00:00:00'}`);
                const durationRaw = row['Duration'];
                const duration = this.parseDuration(durationRaw);
                if (isNaN(duration) || duration <= 0)
                    continue;
                const project = row['Project'] || 'No Project';
                const description = row['Description'] || '';
                // NEU: Synthetische ID generieren
                // Wir nehmen Datum + Zeit + Projekt als Eindeutigkeitsmerkmal für CSVs
                // .getTime() liefert den Timestamp als Zahl
                const syntheticId = `CSV_TOGGL_${fullDate.getTime()}_${project.replace(/\s/g, '')}`;
                result.entries.push({
                    source: 'TOGGL',
                    externalId: syntheticId,
                    date: fullDate,
                    duration: duration,
                    project: project,
                    description: description,
                    startTime: null,
                    endTime: null,
                });
            }
        }
        catch (error) {
            result.errors.push(`Failed to parse Toggl CSV: ${error.message}`);
        }
        return result;
    }
    parseDuration(input) {
        if (!input)
            return 0;
        // Fall A: HH:MM:SS Format
        if (input.includes(':')) {
            const parts = input.split(':').map(Number);
            // Stunden + Minuten/60 + Sekunden/3600
            let hours = 0;
            if (parts.length === 3) {
                hours = parts[0] + parts[1] / 60 + parts[2] / 3600;
            }
            else if (parts.length === 2) {
                hours = parts[0] + parts[1] / 60;
            }
            return hours;
        }
        // Fall B: Dezimal (z.B. "1.5")
        return parseFloat(input);
    }
}
exports.TogglCsvAdapter = TogglCsvAdapter;
