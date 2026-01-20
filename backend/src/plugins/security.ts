import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Security plugin
 * Registers helmet (security headers) and rate limiting
 */
export default fp(async (fastify: FastifyInstance) => {
  // Register helmet for security headers
  await fastify.register(helmet);

  // Register rate limiting to prevent brute force attacks
  await fastify.register(rateLimit, {
    max: 5, // Maximum 5 requests
    timeWindow: '15 minutes', // per 15 minute window
    cache: 10000, // Cache up to 10k different IPs
    allowList: (req: FastifyRequest) => {
      // Don't rate limit health check endpoints
      return req.url.includes('/health') || req.url.includes('/api/health');
    },
  });
});
