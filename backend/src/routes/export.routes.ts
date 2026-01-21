import { FastifyPluginAsync } from 'fastify';
import { generatePDF } from '../services/pdf-generator';

interface ExportPdfBody {
  entries: Array<{
    date: string;
    duration: number;
    project: string;
    description: string;
    source: string;
  }>;
  dateRange: {
    from: string;
    to: string;
  };
  totalHours: number;
}

const exportRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/export/pdf - Generate PDF from time entries
  fastify.post<{ Body: ExportPdfBody }>('/export/pdf', async (request, reply) => {
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
      const pdfBuffer = await generatePDF(entries, dateRange, totalHours);

      // Format filename from date range
      const fromDate = dateRange.from.split('T')[0]; // Extract YYYY-MM-DD
      const toDate = dateRange.to.split('T')[0];
      const filename = `timetracker-${fromDate}-to-${toDate}.pdf`;

      // Set response headers
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(pdfBuffer);
    } catch (error) {
      fastify.log.error({ error }, 'PDF generation failed');
      return reply.code(500).send({ error: 'Failed to generate PDF report' });
    }
  });
};

export default exportRoutes;
