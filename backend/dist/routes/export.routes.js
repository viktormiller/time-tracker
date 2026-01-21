"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pdf_generator_1 = require("../services/pdf-generator");
const exportRoutes = async (fastify) => {
    // POST /api/export/pdf - Generate PDF from time entries
    fastify.post('/export/pdf', async (request, reply) => {
        const { entries, dateRange, totalHours } = request.body;
        // Validate request
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return reply.code(400).send({ error: 'No entries provided or entries array is empty' });
        }
        if (!dateRange || !dateRange.from || !dateRange.to) {
            return reply.code(400).send({ error: 'Date range is required (from and to)' });
        }
        if (typeof totalHours !== 'number') {
            return reply.code(400).send({ error: 'Total hours must be a number' });
        }
        try {
            // Generate PDF
            const pdfBuffer = await (0, pdf_generator_1.generatePDF)(entries, dateRange, totalHours);
            // Format filename from date range
            const fromDate = dateRange.from.split('T')[0]; // Extract YYYY-MM-DD
            const toDate = dateRange.to.split('T')[0];
            const filename = `timetracker-${fromDate}-to-${toDate}.pdf`;
            // Set response headers
            reply.header('Content-Type', 'application/pdf');
            reply.header('Content-Disposition', `attachment; filename="${filename}"`);
            return reply.send(pdfBuffer);
        }
        catch (error) {
            fastify.log.error({ error }, 'PDF generation failed');
            return reply.code(500).send({ error: 'Failed to generate PDF report' });
        }
    });
};
exports.default = exportRoutes;
