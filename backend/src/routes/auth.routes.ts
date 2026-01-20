import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { loadSecret } from '../plugins/auth';

// Extend session data interface
declare module '@fastify/secure-session' {
  interface SessionData {
    userId: number;
    authenticated: boolean;
  }
}

/**
 * Authentication routes
 * Provides login, refresh, and logout endpoints
 */
export default async function (fastify: FastifyInstance) {
  /**
   * POST /api/auth/login
   * Validates credentials and issues JWT tokens
   */
  fastify.post<{
    Body: { username: string; password: string };
  }>(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: 5, // Maximum 5 login attempts
          timeWindow: '15 minutes', // per 15 minute window
        },
      },
    },
    async (request, reply) => {
    const { username, password } = request.body;

    // Validate required fields
    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password required' });
    }

    // Validate username matches admin user
    const adminUser = process.env.ADMIN_USER || 'admin';
    if (username !== adminUser) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Load admin password hash
    let adminPasswordHash: string;
    try {
      adminPasswordHash = loadSecret('admin_password_hash');
    } catch (err) {
      fastify.log.error({ err }, 'Failed to load admin password hash');
      return reply.code(500).send({ error: 'Server configuration error' });
    }

    // Verify password with bcrypt
    const isValid = await bcrypt.compare(password, adminPasswordHash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // CRITICAL: Prevent session fixation attack (CVE-2023-29019)
    // Delete old session before creating new one
    request.session.delete();

    // Set session data (using direct property assignment)
    request.session.set('userId', 1);
    request.session.set('authenticated', true);

    // Generate access token (short-lived: 15 minutes)
    const accessToken = fastify.jwt.sign(
      { userId: 1, role: 'admin' },
      { expiresIn: '15m' }
    );

    // Generate refresh token (long-lived: 30 days)
    const refreshToken = fastify.jwt.sign(
      { userId: 1, type: 'refresh' },
      { expiresIn: '30d' }
    );

    // Store refresh token in HttpOnly cookie (CSRF protection)
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    });

    // Return access token to client
    return {
      accessToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }
  );

  /**
   * POST /api/auth/refresh
   * Issues new access token using refresh token
   */
  fastify.post('/api/auth/refresh', async (request, reply) => {
    // Read refresh token from cookie
    const refreshToken = request.cookies.refreshToken;

    if (!refreshToken) {
      return reply.code(401).send({ error: 'Refresh token required' });
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = fastify.jwt.verify(refreshToken);
    } catch (err) {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }

    // Validate token type
    if (decoded.type !== 'refresh') {
      return reply.code(401).send({ error: 'Invalid token type' });
    }

    // Generate NEW access token
    const accessToken = fastify.jwt.sign(
      { userId: decoded.userId, role: 'admin' },
      { expiresIn: '15m' }
    );

    // Generate NEW refresh token (rotation prevents token reuse)
    const newRefreshToken = fastify.jwt.sign(
      { userId: decoded.userId, type: 'refresh' },
      { expiresIn: '30d' }
    );

    // Update refresh token cookie
    reply.setCookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    });

    // Return new access token
    return {
      accessToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  });

  /**
   * POST /api/auth/logout
   * Clears session and refresh token
   */
  fastify.post(
    '/api/auth/logout',
    {
      preHandler: [fastify.authenticate], // Requires valid access token
    },
    async (request, reply) => {
      // Delete session
      request.session.delete();

      // Clear refresh token cookie
      reply.clearCookie('refreshToken', {
        path: '/',
      });

      return { message: 'Logged out' };
    }
  );
}
