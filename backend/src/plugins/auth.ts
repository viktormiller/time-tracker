import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import fs from 'fs';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Load secret from Docker Secrets or environment variable
 * @param name Secret name (e.g., 'jwt_secret')
 * @returns Secret value
 */
export function loadSecret(name: string): string {
  try {
    // Try Docker Secrets path first (/run/secrets/<name>)
    return fs.readFileSync(`/run/secrets/${name}`, 'utf8').trim();
  } catch (err) {
    // Fallback to environment variable for development
    const envName = name.toUpperCase();
    const envValue = process.env[envName];

    if (!envValue) {
      throw new Error(
        `Secret ${name} not found in /run/secrets or environment variable ${envName}`
      );
    }

    // Validate secret strength (minimum 32 characters)
    if (envValue.length < 32) {
      throw new Error(
        `Secret ${name} must be at least 32 characters long (found ${envValue.length})`
      );
    }

    return envValue;
  }
}

/**
 * JWT authentication plugin
 * Registers @fastify/jwt and provides authenticate decorator
 */
export default fp(async (fastify: FastifyInstance) => {
  const jwtSecret = loadSecret('jwt_secret');

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
