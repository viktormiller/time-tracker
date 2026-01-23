import fp from 'fastify-plugin';
import fastifySecureSession from '@fastify/secure-session';
import fastifyCookie from '@fastify/cookie';
import { FastifyInstance } from 'fastify';
import { loadSecret } from '../utils/secrets';

/**
 * Secure session plugin
 * Registers @fastify/cookie and @fastify/secure-session for HttpOnly cookie sessions
 */
export default fp(async (fastify: FastifyInstance) => {
  const sessionSecret = loadSecret('session_secret', { minLength: 32 })!;

  // @fastify/secure-session requires secret as Buffer (32 bytes for libsodium)
  // Our hex string is 64 chars = 32 bytes
  const secretBuffer = Buffer.from(sessionSecret, 'hex');

  if (secretBuffer.length !== 32) {
    throw new Error(
      `Session secret must be exactly 32 bytes (64 hex chars), got ${secretBuffer.length} bytes`
    );
  }

  // Register cookie plugin first (required by secure-session)
  await fastify.register(fastifyCookie);

  // Register secure session plugin
  // Use 'key' instead of 'secret' for libsodium encryption
  await fastify.register(fastifySecureSession, {
    key: secretBuffer,
    cookie: {
      path: '/',
      httpOnly: true, // Prevent JavaScript access (XSS protection)
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // CSRF protection
    },
  });
});
