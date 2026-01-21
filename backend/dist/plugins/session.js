"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const secure_session_1 = __importDefault(require("@fastify/secure-session"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const auth_1 = require("./auth");
/**
 * Secure session plugin
 * Registers @fastify/cookie and @fastify/secure-session for HttpOnly cookie sessions
 */
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    const sessionSecret = (0, auth_1.loadSecret)('session_secret');
    // @fastify/secure-session requires secret as Buffer (32 bytes for libsodium)
    // Our hex string is 64 chars = 32 bytes
    const secretBuffer = Buffer.from(sessionSecret, 'hex');
    if (secretBuffer.length !== 32) {
        throw new Error(`Session secret must be exactly 32 bytes (64 hex chars), got ${secretBuffer.length} bytes`);
    }
    // Register cookie plugin first (required by secure-session)
    await fastify.register(cookie_1.default);
    // Register secure session plugin
    // Use 'key' instead of 'secret' for libsodium encryption
    await fastify.register(secure_session_1.default, {
        key: secretBuffer,
        cookie: {
            path: '/',
            httpOnly: true, // Prevent JavaScript access (XSS protection)
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'strict', // CSRF protection
        },
    });
});
