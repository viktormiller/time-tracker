import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { createEstimateSchema, updateEstimateSchema } from '../schemas/estimate.schema';

const prisma = new PrismaClient();

export async function estimateRoutes(fastify: FastifyInstance) {
  // Get all estimates with actual hours
  fastify.get('/estimates', async (request, reply) => {
    try {
      const estimates = await prisma.projectEstimate.findMany({
        include: {
          projects: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculate actual hours for each estimate
      const estimatesWithActual = await Promise.all(
        estimates.map(async (estimate) => {
          const projectNames = estimate.projects.map((p) => p.projectName);

          const result = await prisma.timeEntry.aggregate({
            where: {
              project: {
                in: projectNames,
              },
            },
            _sum: {
              duration: true,
            },
          });

          const actualHours = result._sum.duration || 0;
          const percentage = estimate.estimatedHours > 0
            ? (actualHours / estimate.estimatedHours) * 100
            : 0;

          let status: 'green' | 'yellow' | 'red';
          if (percentage < 75) {
            status = 'green';
          } else if (percentage < 100) {
            status = 'yellow';
          } else {
            status = 'red';
          }

          return {
            ...estimate,
            actualHours,
            percentage,
            status,
          };
        })
      );

      return estimatesWithActual;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch estimates' });
    }
  });

  // Create estimate
  fastify.post('/estimates', async (request, reply) => {
    try {
      const data = createEstimateSchema.parse(request.body);

      const estimate = await prisma.projectEstimate.create({
        data: {
          clientName: data.clientName,
          name: data.name,
          estimatedHours: data.estimatedHours,
          notes: data.notes,
          projects: {
            create: data.projects.map((projectName: string) => ({
              projectName,
            })),
          },
        },
        include: {
          projects: true,
        },
      });

      reply.status(201).send(estimate);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({ error: 'Validation error', details: error });
      } else {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Failed to create estimate' });
      }
    }
  });

  // Update estimate
  fastify.put('/estimates/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateEstimateSchema.parse(request.body);

      // Use transaction to update estimate and replace project links
      const estimate = await prisma.$transaction(async (tx) => {
        // Update basic fields
        const updated = await tx.projectEstimate.update({
          where: { id },
          data: {
            clientName: data.clientName,
            name: data.name,
            estimatedHours: data.estimatedHours,
            notes: data.notes,
          },
        });

        // If projects are provided, replace all project links
        if (data.projects) {
          // Delete existing project links
          await tx.estimateProject.deleteMany({
            where: { estimateId: id },
          });

          // Create new project links
          await tx.estimateProject.createMany({
            data: data.projects.map((projectName: string) => ({
              estimateId: id,
              projectName,
            })),
          });
        }

        // Return updated estimate with projects
        return tx.projectEstimate.findUnique({
          where: { id },
          include: {
            projects: true,
          },
        });
      });

      return estimate;
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        reply.status(400).send({ error: 'Validation error', details: error });
      } else {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Failed to update estimate' });
      }
    }
  });

  // Delete estimate
  fastify.delete('/estimates/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      await prisma.projectEstimate.delete({
        where: { id },
      });

      reply.status(204).send();
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to delete estimate' });
    }
  });

  // Get unique project names with context
  fastify.get('/projects/unique', async (request, reply) => {
    try {
      // Get distinct projects
      const projects = await prisma.timeEntry.findMany({
        where: {
          project: {
            not: null,
          },
        },
        distinct: ['project'],
        select: {
          project: true,
        },
        orderBy: {
          project: 'asc',
        },
      });

      // For each project, get total hours and entry count
      const projectsWithContext = await Promise.all(
        projects
          .filter((p): p is { project: string } => p.project !== null)
          .map(async (p) => {
            const stats = await prisma.timeEntry.aggregate({
              where: { project: p.project },
              _sum: { duration: true },
              _count: true,
            });

            return {
              name: p.project,
              totalHours: stats._sum.duration || 0,
              entryCount: stats._count,
            };
          })
      );

      return projectsWithContext;
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch projects' });
    }
  });
}
