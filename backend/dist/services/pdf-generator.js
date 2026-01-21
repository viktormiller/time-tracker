"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePDF = generatePDF;
const puppeteer_1 = __importDefault(require("puppeteer"));
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
}
/**
 * Generates HTML content for PDF report
 */
function generateReportHTML(entries, dateRange, totalHours) {
    const entriesRows = entries.map(entry => {
        const entryDate = new Date(entry.date);
        const formattedDate = (0, date_fns_1.format)(entryDate, 'dd.MM.yyyy HH:mm', { locale: locale_1.de });
        const hours = entry.duration.toFixed(2);
        return `
      <tr>
        <td>${escapeHtml(formattedDate)}</td>
        <td>${escapeHtml(entry.source)}</td>
        <td>${escapeHtml(entry.project)}</td>
        <td>${escapeHtml(entry.description)}</td>
        <td style="text-align: right;">${hours}</td>
      </tr>
    `;
    }).join('');
    const fromDate = (0, date_fns_1.format)(new Date(dateRange.from), 'dd.MM.yyyy', { locale: locale_1.de });
    const toDate = (0, date_fns_1.format)(new Date(dateRange.to), 'dd.MM.yyyy', { locale: locale_1.de });
    const generatedAt = (0, date_fns_1.format)(new Date(), 'dd.MM.yyyy HH:mm:ss', { locale: locale_1.de });
    return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zeiterfassung Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #333;
      padding: 20px;
    }

    h1 {
      font-size: 20pt;
      font-weight: 600;
      margin-bottom: 10px;
      color: #1a1a1a;
    }

    .header {
      margin-bottom: 30px;
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
    }

    .date-range {
      font-size: 11pt;
      color: #666;
      margin-bottom: 5px;
    }

    .summary {
      background-color: #f5f5f5;
      padding: 15px;
      margin-bottom: 25px;
      border-radius: 4px;
      display: flex;
      gap: 30px;
    }

    .summary-item {
      font-size: 10pt;
    }

    .summary-label {
      color: #666;
      font-weight: 500;
    }

    .summary-value {
      font-size: 14pt;
      font-weight: 600;
      color: #1a1a1a;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    thead {
      background-color: #333;
      color: white;
    }

    th {
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 10px 8px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 9pt;
    }

    tbody tr:nth-child(even) {
      background-color: #f9f9f9;
    }

    tbody tr:hover {
      background-color: #f0f0f0;
    }

    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e0e0e0;
      font-size: 8pt;
      color: #999;
      text-align: center;
    }

    @media print {
      body {
        padding: 0;
      }

      .summary {
        background-color: #f5f5f5 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      thead {
        background-color: #333 !important;
        color: white !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      tbody tr:nth-child(even) {
        background-color: #f9f9f9 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Zeiterfassung Report</h1>
    <div class="date-range">Zeitraum: ${fromDate} - ${toDate}</div>
  </div>

  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">Gesamtstunden</div>
      <div class="summary-value">${totalHours.toFixed(2)} h</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Anzahl Einträge</div>
      <div class="summary-value">${entries.length}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Datum</th>
        <th style="width: 10%;">Quelle</th>
        <th style="width: 25%;">Projekt</th>
        <th style="width: 40%;">Beschreibung</th>
        <th style="width: 10%; text-align: right;">Stunden</th>
      </tr>
    </thead>
    <tbody>
      ${entriesRows}
    </tbody>
  </table>

  <div class="footer">
    Generiert am ${generatedAt}
  </div>
</body>
</html>
  `;
}
/**
 * Generates a PDF report from time entries
 */
async function generatePDF(entries, dateRange, totalHours) {
    let browser;
    try {
        browser = await puppeteer_1.default.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
        const page = await browser.newPage();
        const html = generateReportHTML(entries, dateRange, totalHours);
        await page.setContent(html, { waitUntil: 'networkidle2' });
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '1cm',
                right: '1cm',
                bottom: '1.5cm',
                left: '1cm'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div style="font-size: 9px; color: #666; width: 100%; text-align: center; padding: 5px;">Zeiterfassung Report</div>',
            footerTemplate: '<div style="font-size: 9px; color: #666; width: 100%; text-align: center; padding: 5px;">Seite <span class="pageNumber"></span> von <span class="totalPages"></span></div>'
        });
        return Buffer.from(pdf);
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
}
