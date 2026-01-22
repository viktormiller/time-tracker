"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderFactory = void 0;
const toggl_provider_1 = require("./toggl.provider");
const tempo_provider_1 = require("./tempo.provider");
class ProviderFactory {
    static getProvider(source, prisma) {
        const key = source.toUpperCase();
        // Return cached provider if exists
        if (this.providers.has(key)) {
            return this.providers.get(key);
        }
        // Create new provider instance
        let provider;
        switch (key) {
            case 'TOGGL':
                provider = new toggl_provider_1.TogglProvider(prisma);
                break;
            case 'TEMPO':
                provider = new tempo_provider_1.TempoProvider(prisma);
                break;
            default:
                throw new Error(`Unknown provider: ${source}`);
        }
        // Cache the provider
        this.providers.set(key, provider);
        return provider;
    }
    static getAllProviders(prisma) {
        return [
            this.getProvider('TOGGL', prisma),
            this.getProvider('TEMPO', prisma)
        ];
    }
    static clearCache() {
        this.providers.clear();
    }
}
exports.ProviderFactory = ProviderFactory;
ProviderFactory.providers = new Map();
