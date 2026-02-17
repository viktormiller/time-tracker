import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import {
  createPropertySchema,
  updatePropertySchema,
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

  // === Property CRUD ===

  // GET /api/utilities/properties - List all properties (active first)
  fastify.get('/utilities/properties', async (request, reply) => {
    try {
      const properties = await prisma.property.findMany({
        orderBy: [
          { movedOut: 'asc' }, // null (active) first, then by movedOut date
          { createdAt: 'desc' },
        ],
        include: {
          _count: {
            select: { meters: true },
          },
        },
      });
      return properties;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch properties' });
    }
  });

  // POST /api/utilities/properties - Create a property
  fastify.post('/utilities/properties', async (request, reply) => {
    try {
      const data = createPropertySchema.parse(request.body);
      const property = await prisma.property.create({
        data: {
          name: data.name,
          address: data.address,
          movedIn: data.movedIn ? new Date(data.movedIn) : null,
          movedOut: data.movedOut ? new Date(data.movedOut) : null,
        },
      });
      reply.status(201).send(property);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({ error: 'Validation error', details: error });
      } else {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Failed to create property' });
      }
    }
  });

  // PUT /api/utilities/properties/:id - Update a property
  fastify.put('/utilities/properties/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updatePropertySchema.parse(request.body);
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.movedIn !== undefined) updateData.movedIn = data.movedIn ? new Date(data.movedIn) : null;
      if (data.movedOut !== undefined) updateData.movedOut = data.movedOut ? new Date(data.movedOut) : null;

      const property = await prisma.property.update({
        where: { id },
        data: updateData,
      });
      return property;
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({ error: 'Validation error', details: error });
      } else {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Failed to update property' });
      }
    }
  });

  // DELETE /api/utilities/properties/:id - Delete a property (only if no meters)
  fastify.delete('/utilities/properties/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const meterCount = await prisma.meter.count({ where: { propertyId: id } });
      if (meterCount > 0) {
        return reply.code(400).send({
          error: 'Cannot delete property with meters. Remove or reassign meters first.',
        });
      }

      await prisma.property.delete({ where: { id } });
      reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to delete property' });
    }
  });

  // === Meter CRUD ===

  // GET /api/utilities/meters - List meters (active or including archived, optionally filtered by property)
  fastify.get('/utilities/meters', async (request, reply) => {
    try {
      const { includeArchived, propertyId } = request.query as { includeArchived?: string; propertyId?: string };

      const where: any = {};
      if (includeArchived !== 'true') where.deletedAt = null;
      if (propertyId) where.propertyId = propertyId;

      const meters = await prisma.meter.findMany({
        where,
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

  // GET /api/utilities/consumption/monthly - Year-over-year monthly consumption across all properties
  fastify.get('/utilities/consumption/monthly', async (request, reply) => {
    try {
      const { type } = request.query as { type?: string };
      if (!type || !['STROM', 'GAS', 'WASSER_WARM'].includes(type)) {
        return reply.code(400).send({ error: 'type query parameter required (STROM, GAS, WASSER_WARM)' });
      }

      const meters = await prisma.meter.findMany({
        where: { type, deletedAt: null },
        include: { readings: { orderBy: { readingDate: 'asc' } } },
      });

      const unitMap: Record<string, string> = { STROM: 'kWh', GAS: 'm³', WASSER_WARM: 'm³' };
      const monthlyMap = new Map<string, number>();

      for (const meter of meters) {
        for (let i = 1; i < meter.readings.length; i++) {
          const prev = meter.readings[i - 1];
          const curr = meter.readings[i];
          const consumption = curr.value - prev.value;
          const d = new Date(prev.readingDate);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + consumption);
        }
      }

      const data = Array.from(monthlyMap.entries()).map(([key, consumption]) => {
        const [year, month] = key.split('-').map(Number);
        return { year, month, consumption: Math.round(consumption * 100) / 100 };
      });

      return { unit: unitMap[type] || 'kWh', data };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch monthly consumption' });
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

  // POST /api/utilities/meters/:meterId/readings/bulk - Bulk import readings
  fastify.post('/utilities/meters/:meterId/readings/bulk', async (request, reply) => {
    try {
      const { meterId } = request.params as { meterId: string };
      const { readings: newReadings } = request.body as {
        readings: { readingDate: string; value: number }[];
      };

      if (!Array.isArray(newReadings) || newReadings.length === 0) {
        return reply.code(400).send({ error: 'No readings provided' });
      }

      // Fetch existing readings for this meter
      const existing = await prisma.meterReading.findMany({
        where: { meterId },
        orderBy: { readingDate: 'asc' },
        select: { readingDate: true, value: true },
      });

      const existingDates = new Set(
        existing.map(r => r.readingDate.toISOString().split('T')[0])
      );

      // Separate new entries from duplicates
      const toCreate: { readingDate: string; value: number }[] = [];
      let skipped = 0;
      for (const r of newReadings) {
        if (existingDates.has(r.readingDate)) {
          skipped++;
        } else {
          toCreate.push(r);
        }
      }

      // Merge existing + new, sort by date, validate monotonic values
      const merged = [
        ...existing.map(r => ({
          readingDate: r.readingDate.toISOString().split('T')[0],
          value: r.value,
        })),
        ...toCreate,
      ].sort((a, b) => a.readingDate.localeCompare(b.readingDate));

      for (let i = 1; i < merged.length; i++) {
        if (merged[i].value < merged[i - 1].value) {
          return reply.code(400).send({
            error: 'Monotonic validation failed',
            message: `Wert ${merged[i].value} am ${merged[i].readingDate} ist kleiner als ${merged[i - 1].value} am ${merged[i - 1].readingDate}`,
            details: { date: merged[i].readingDate, value: merged[i].value, previousValue: merged[i - 1].value },
          });
        }
      }

      // Insert all in a transaction
      if (toCreate.length > 0) {
        await prisma.$transaction(
          toCreate.map(r =>
            prisma.meterReading.create({
              data: { meterId, readingDate: new Date(r.readingDate), value: r.value },
            })
          )
        );
      }

      return { created: toCreate.length, skipped };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to bulk import readings' });
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
