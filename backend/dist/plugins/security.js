"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
/**
 * Security plugin
 * Registers helmet (security headers) and rate limiting
 */
exports.default = (0, fastify_plugin_1.default)(async (fastify) => {
    // Register helmet for security headers
    await fastify.register(helmet_1.default);
    // Register rate limiting plugin (configured per-route, not globally)
    // This makes the rate limiter available but doesn't apply it to all routes
    await fastify.register(rate_limit_1.default, {
        global: false, // Don't apply to all routes
        max: 5, // Default: 5 requests
        timeWindow: '15 minutes', // Default: per 15 minute window
        cache: 10000, // Cache up to 10k different IPs
    });
});
