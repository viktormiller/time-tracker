"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const secrets_1 = require("../utils/secrets");
/**
 * JWT authentication plugin
 * Registers @fastify/jwt and provides authenticate decorator
 */
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    const jwtSecret = (0, secrets_1.loadSecret)('jwt_secret', { minLength: 32 });
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
