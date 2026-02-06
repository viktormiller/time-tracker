import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import {
  createMeterSchema,
  updateMeterSchema,
  createReadingSchema,
  updateReadingSchema,
} from '../schemas/utility.schema';

const prisma = new PrismaClient();

export async function utilityRoutes(fastify: FastifyInstance) {
  // Register static file serving for meter photos (within protected scope)
  fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false, // Avoid decorator conflict if registered elsewhere
  });

  // GET /api/utilities/meters - List meters (active or including archived)
  fastify.get('/utilities/meters', async (request, reply) => {
    try {
      const { includeArchived } = request.query as { includeArchived?: string };

      const meters = await prisma.meter.findMany({
        where: includeArchived === 'true' ? {} : { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { readings: true },
          },
        },
      });
      return meters;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch meters' });
    }
  });

  // POST /api/utilities/meters - Create a meter
  fastify.post('/utilities/meters', async (request, reply) => {
    try {
      const data = createMeterSchema.parse(request.body);
      const meter = await prisma.meter.create({
        data,
      });
      reply.status(201).send(meter);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({ error: 'Validation error', details: error });
      } else {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Failed to create meter' });
      }
    }
  });

  // PUT /api/utilities/meters/:id - Update a meter
  fastify.put('/utilities/meters/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateMeterSchema.parse(request.body);
      const meter = await prisma.meter.update({
        where: { id },
        data,
      });
      return meter;
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({ error: 'Validation error', details: error });
      } else {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Failed to update meter' });
      }
    }
  });

  // DELETE /api/utilities/meters/:id - Soft delete a meter
  fastify.delete('/utilities/meters/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await prisma.meter.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to delete meter' });
    }
  });

  // PATCH /api/utilities/meters/:id/restore - Restore an archived meter
  fastify.patch('/utilities/meters/:id/restore', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const meter = await prisma.meter.update({
        where: { id },
        data: { deletedAt: null },
      });
      return meter;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to restore meter' });
    }
  });

  // GET /api/utilities/meters/:meterId/readings - Get readings with consumption
  fastify.get('/utilities/meters/:meterId/readings', async (request, reply) => {
    try {
      const { meterId } = request.params as { meterId: string };

      const readings = await prisma.meterReading.findMany({
        where: { meterId },
        orderBy: { readingDate: 'asc' }, // CRITICAL: asc for correct consumption calculation
        include: { meter: true },
      });

      // Calculate consumption on-demand (LOCKED DECISION: not stored)
      const readingsWithConsumption = readings.map((reading, index) => ({
        id: reading.id,
        readingDate: reading.readingDate,
        value: reading.value,
        consumption: index === 0 ? null : reading.value - readings[index - 1].value,
        unit: reading.meter.unit,
        photoPath: reading.photoPath,
        notes: reading.notes,
        createdAt: reading.createdAt,
      }));

      return readingsWithConsumption;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch readings' });
    }
  });

  // POST /api/utilities/readings - Create a reading
  fastify.post('/utilities/readings', async (request, reply) => {
    try {
      const data = createReadingSchema.parse(request.body);

      // Application-level monotonic validation (primary - gives user-friendly errors)
      // Check previous reading
      const previousReading = await prisma.meterReading.findFirst({
        where: {
          meterId: data.meterId,
          readingDate: { lt: new Date(data.readingDate) },
        },
        orderBy: { readingDate: 'desc' },
      });

      if (previousReading && data.value < previousReading.value) {
        return reply.code(400).send({
          error: 'Invalid reading',
          message: 'This reading is lower than your last one. Meter values can only increase.',
          details: {
            previousValue: previousReading.value,
            previousDate: previousReading.readingDate,
            attemptedValue: data.value,
          },
        });
      }

      // Check next reading (if inserting between existing readings)
      const nextReading = await prisma.meterReading.findFirst({
        where: {
          meterId: data.meterId,
          readingDate: { gt: new Date(data.readingDate) },
        },
        orderBy: { readingDate: 'asc' },
      });

      if (nextReading && data.value > nextReading.value) {
        return reply.code(400).send({
          error: 'Invalid reading',
          message: 'This reading is higher than a later one. Meter values must increase over time.',
          details: {
            nextValue: nextReading.value,
            nextDate: nextReading.readingDate,
            attemptedValue: data.value,
          },
        });
      }

      // Create the reading (database trigger is safety net backup)
      const reading = await prisma.meterReading.create({
        data: {
          meterId: data.meterId,
          readingDate: new Date(data.readingDate),
          value: data.value,
          notes: data.notes,
        },
      });

      reply.status(201).send(reading);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({ error: 'Validation error', details: error });
      } else {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Failed to create reading' });
      }
    }
  });

  // PUT /api/utilities/readings/:id - Update a reading
  fastify.put('/utilities/readings/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateReadingSchema.parse(request.body);

      // Get current reading for comparison
      const currentReading = await prisma.meterReading.findUnique({
        where: { id },
      });

      if (!currentReading) {
        return reply.code(404).send({ error: 'Reading not found' });
      }

      // If value or readingDate changed, re-run monotonic validation
      const valueChanged = data.value !== undefined && data.value !== currentReading.value;
      const dateChanged = data.readingDate !== undefined &&
        new Date(data.readingDate).getTime() !== currentReading.readingDate.getTime();

      if (valueChanged || dateChanged) {
        const newValue = data.value ?? currentReading.value;
        const newDate = data.readingDate ? new Date(data.readingDate) : currentReading.readingDate;

        // Check previous reading (exclude current reading by ID)
        const previousReading = await prisma.meterReading.findFirst({
          where: {
            meterId: currentReading.meterId,
            readingDate: { lt: newDate },
            id: { not: id },
          },
          orderBy: { readingDate: 'desc' },
        });

        if (previousReading && newValue < previousReading.value) {
          return reply.code(400).send({
            error: 'Invalid reading',
            message: 'This reading is lower than your last one. Meter values can only increase.',
            details: {
              previousValue: previousReading.value,
              previousDate: previousReading.readingDate,
              attemptedValue: newValue,
            },
          });
        }

        // Check next reading (exclude current reading by ID)
        const nextReading = await prisma.meterReading.findFirst({
          where: {
            meterId: currentReading.meterId,
            readingDate: { gt: newDate },
            id: { not: id },
          },
          orderBy: { readingDate: 'asc' },
        });

        if (nextReading && newValue > nextReading.value) {
          return reply.code(400).send({
            error: 'Invalid reading',
            message: 'This reading is higher than a later one. Meter values must increase over time.',
            details: {
              nextValue: nextReading.value,
              nextDate: nextReading.readingDate,
              attemptedValue: newValue,
            },
          });
        }
      }

      // Update the reading
      const updateData: any = {};
      if (data.readingDate !== undefined) {
        updateData.readingDate = new Date(data.readingDate);
      }
      if (data.value !== undefined) {
        updateData.value = data.value;
      }
      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      const reading = await prisma.meterReading.update({
        where: { id },
        data: updateData,
      });

      return reading;
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({ error: 'Validation error', details: error });
      } else {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Failed to update reading' });
      }
    }
  });

  // DELETE /api/utilities/readings/:id - Delete a reading (hard delete)
  fastify.delete('/utilities/readings/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await prisma.meterReading.delete({
        where: { id },
      });
      reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to delete reading' });
    }
  });

  // POST /api/utilities/readings/:id/photo - Upload a photo
  fastify.post('/utilities/readings/:id/photo', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.code(400).send({
          error: 'Only JPEG, PNG, and WebP images are allowed',
        });
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'meter-photos');

      // Ensure directory exists
      fs.mkdirSync(uploadDir, { recursive: true });

      const ext = path.extname(data.filename);
      const filename = `${id}-${Date.now()}${ext}`;
      const filepath = path.join(uploadDir, filename);

      // Save file
      const buffer = await data.toBuffer();
      fs.writeFileSync(filepath, buffer);

      // Update reading with photo path
      await prisma.meterReading.update({
        where: { id },
        data: { photoPath: `/uploads/meter-photos/${filename}` },
      });

      return { photoPath: `/uploads/meter-photos/${filename}` };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to upload photo' });
    }
  });
}
