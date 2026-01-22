"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TempoCsvAdapter = void 0;
const sync_1 = require("csv-parse/sync");
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale"); // Import English locale for "Dec", "Jan"
class TempoCsvAdapter {
    async parse(fileContent) {
        const result = { entries: [], errors: [] };
        try {
            // Parse as arrays (no headers yet, because headers are dynamic dates)
            const rows = (0, sync_1.parse)(fileContent, {
                skip_empty_lines: true,
                trim: true,
            });
            if (rows.length < 2) {
                result.errors.push("Tempo CSV is too short");
                return result;
            }
            // 1. Analyze Header Row to find Date Columns
            // Example Header: ,Issue,Key,Logged,01/Dec/25,02/Dec/25...
            const headerRow = rows[0];
            const dateColumnMap = {};
            headerRow.forEach((colName, index) => {
                // Pattern: dd/MMM/yy (e.g., 01/Dec/25)
                // We assume date columns start after fixed columns. 
                // Let's try to parse every column header as a date.
                if (colName.includes('/')) {
                    try {
                        // Parse "01/Dec/25" using English locale
                        const parsedDate = (0, date_fns_1.parse)(colName, 'dd/MMM/yy', new Date(), { locale: locale_1.enUS });
                        if (!isNaN(parsedDate.getTime())) {
                            dateColumnMap[index] = parsedDate;
                        }
                    }
                    catch (e) {
                        // Not a date column, ignore
                    }
                }
            });
            // 2. Iterate Data Rows
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                // Skip "Total" row usually at the bottom
                if (row[0] === 'Total' || row[1] === 'Total')
                    continue;
                const issue = row[1]; // "Issue" -> Description
                const key = row[2]; // "Key" -> Project / External ID
                // Iterate through the columns that we identified as dates
                for (const [colIndex, dateObj] of Object.entries(dateColumnMap)) {
                    const index = parseInt(colIndex);
                    const cellValue = row[index];
                    // If cell has a value (e.g. "4.2")
                    if (cellValue && cellValue.trim() !== '') {
                        const hours = parseFloat(cellValue);
                        if (!isNaN(hours) && hours > 0) {
                            // Synthetische ID
                            // Datum (als Timestamp) + IssueKey + Dauer verhindert Duplikate beim erneuten Import
                            // ACHTUNG: Wenn du am gleichen Tag 2x 2h am gleichen Ticket gearbeitet hast, 
                            // fasst Tempo CSV das meist eh zusammen. Falls nicht, wäre das hier ein Problem.
                            // Für die Matrix-Ansicht ist das aber okay.
                            const syntheticId = `CSV_TEMPO_${dateObj.getTime()}_${key}_${hours}`;
                            result.entries.push({
                                source: 'TEMPO',
                                externalId: syntheticId,
                                date: dateObj,
                                duration: hours,
                                project: key,
                                description: issue,
                                startTime: null,
                                endTime: null,
                            });
                        }
                    }
                }
            }
        }
        catch (error) {
            result.errors.push(`Failed to parse Tempo CSV: ${error.message}`);
        }
        return result;
    }
}
exports.TempoCsvAdapter = TempoCsvAdapter;
