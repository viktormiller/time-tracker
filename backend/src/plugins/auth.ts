import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { loadSecret } from '../utils/secrets';

/**
 * JWT authentication plugin
 * Registers @fastify/jwt and provides authenticate decorator
 */
export default fp(async (fastify: FastifyInstance) => {
  const jwtSecret = loadSecret('jwt_secret', { minLength: 32 })!;

  // Register JWT plugin
  await fastify.register(jwt, {
    secret: jwtSecret,
    sign: {
      expiresIn: '15m', // Short-lived access tokens
    },
    cookie: {
      cookieName: 'refreshToken',
      signed: false,
    },
  });

  // Decorate fastify instance with authenticate function
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});

// Extend Fastify type definitions
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
