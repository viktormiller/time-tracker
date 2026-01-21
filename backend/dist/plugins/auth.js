"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSecret = loadSecret;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const fs_1 = __importDefault(require("fs"));
/**
 * Load secret from Docker Secrets or environment variable
 * @param name Secret name (e.g., 'jwt_secret')
 * @returns Secret value
 */
function loadSecret(name) {
    try {
        // Try Docker Secrets path first (/run/secrets/<name>)
        return fs_1.default.readFileSync(`/run/secrets/${name}`, 'utf8').trim();
    }
    catch (err) {
        // Fallback to environment variable for development
        const envName = name.toUpperCase();
        const envValue = process.env[envName];
        if (!envValue) {
            throw new Error(`Secret ${name} not found in /run/secrets or environment variable ${envName}`);
        }
        // Validate secret strength (minimum 32 characters)
        if (envValue.length < 32) {
            throw new Error(`Secret ${name} must be at least 32 characters long (found ${envValue.length})`);
        }
        return envValue;
    }
}
/**
 * JWT authentication plugin
 * Registers @fastify/jwt and provides authenticate decorator
 */
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    const jwtSecret = loadSecret('jwt_secret');
    // Register JWT plugin
    await fastify.register(jwt_1.default, {
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
    fastify.decorate('authenticate', async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });
});
