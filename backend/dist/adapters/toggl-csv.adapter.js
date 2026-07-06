"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TogglCsvAdapter = void 0;
const sync_1 = require("csv-parse/sync");
const date_fns_tz_1 = require("date-fns-tz");
class TogglCsvAdapter {
    async parse(fileContent, timezone) {
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
                // Convert local date+time to UTC using the provided timezone
                const tz = timezone || 'UTC';
                const entryDate = (0, date_fns_tz_1.fromZonedTime)(`${dateStr}T${timeStr || '00:00:00'}`, tz);
                // Full datetime for synthetic ID uniqueness
                const fullDateTime = entryDate;
                const durationRaw = row['Duration'];
                const duration = this.parseDuration(durationRaw);
                if (isNaN(duration) || duration <= 0)
                    continue;
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
                    result.errors.push(`Keine Einträge gefunden (${records.length} Zeilen). Möglicherweise ist dies ein Toggl-Zusammenfassungsbericht. Bitte einen detaillierten Bericht verwenden (mit Spalten: Start date, Start time, Duration, Project, Description).`);
                }
                else {
                    result.errors.push(`Keine gültigen Einträge gefunden (${records.length} Zeilen). Bitte das CSV-Format prüfen.`);
                }
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
