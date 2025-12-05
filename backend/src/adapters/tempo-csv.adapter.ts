import { ImportAdapter, ImportResult } from './import-adapter.interface';
import { parse } from 'csv-parse/sync';
import { parse as parseDate } from 'date-fns';
import { enUS } from 'date-fns/locale'; // Import English locale for "Dec", "Jan"

export class TempoCsvAdapter implements ImportAdapter {
  async parse(fileContent: string): Promise<ImportResult> {
    const result: ImportResult = { entries: [], errors: [] };

    try {
      // Parse as arrays (no headers yet, because headers are dynamic dates)
      const rows = parse(fileContent, {
        skip_empty_lines: true,
        trim: true,
      }) as string[][];

      if (rows.length < 2) {
        result.errors.push("Tempo CSV is too short");
        return result;
      }

      // 1. Analyze Header Row to find Date Columns
      // Example Header: ,Issue,Key,Logged,01/Dec/25,02/Dec/25...
      const headerRow = rows[0];
      const dateColumnMap: Record<number, Date> = {};

      headerRow.forEach((colName, index) => {
        // Pattern: dd/MMM/yy (e.g., 01/Dec/25)
        // We assume date columns start after fixed columns. 
        // Let's try to parse every column header as a date.
        if (colName.includes('/')) {
            try {
                // Parse "01/Dec/25" using English locale
                const parsedDate = parseDate(colName, 'dd/MMM/yy', new Date(), { locale: enUS });
                if (!isNaN(parsedDate.getTime())) {
                    dateColumnMap[index] = parsedDate;
                }
            } catch (e) {
                // Not a date column, ignore
            }
        }
      });

      // 2. Iterate Data Rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        // Skip "Total" row usually at the bottom
        if (row[0] === 'Total' || row[1] === 'Total') continue;

        const issue = row[1]; // "Issue" -> Description
        const key = row[2];   // "Key" -> Project / External ID
        
        // Iterate through the columns that we identified as dates
        for (const [colIndex, dateObj] of Object.entries(dateColumnMap)) {
            const index = parseInt(colIndex);
            const cellValue = row[index];

            // If cell has a value (e.g. "4.2")
            if (cellValue && cellValue.trim() !== '') {
                const hours = parseFloat(cellValue);
                
                if (!isNaN(hours) && hours > 0) {
                    result.entries.push({
                        source: 'TEMPO',
                        externalId: key, // Tempo Key is unique
                        date: dateObj,   // The date from the header
                        duration: hours,
                        project: key,    // Use Key as Project for now
                        description: issue,
                    });
                }
            }
        }
      }

    } catch (error) {
      result.errors.push(`Failed to parse Tempo CSV: ${(error as Error).message}`);
    }

    return result;
  }
}
