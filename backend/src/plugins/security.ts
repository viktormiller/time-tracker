import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';

/**
 * Security plugin
 * Registers helmet (security headers) and rate limiting
 */
export default fp(async (fastify: FastifyInstance) => {
  // Register helmet for security headers
  await fastify.register(helmet);

  // Register rate limiting plugin (configured per-route, not globally)
  // This makes the rate limiter available but doesn't apply it to all routes
  await fastify.register(rateLimit, {
    global: false, // Don't apply to all routes
    max: 5, // Default: 5 requests
    timeWindow: '15 minutes', // Default: per 15 minute window
    cache: 10000, // Cache up to 10k different IPs
  });
});
