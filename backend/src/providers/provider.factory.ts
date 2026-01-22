import { PrismaClient } from '@prisma/client';
import { TimeProvider } from './provider.interface';
import { TogglProvider } from './toggl.provider';
import { TempoProvider } from './tempo.provider';

export class ProviderFactory {
  private static providers: Map<string, TimeProvider> = new Map();

  static getProvider(source: string, prisma: PrismaClient): TimeProvider {
    const key = source.toUpperCase();

    // Return cached provider if exists
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

    // Create new provider instance
    let provider: TimeProvider;

    switch (key) {
      case 'TOGGL':
        provider = new TogglProvider(prisma);
        break;
      case 'TEMPO':
        provider = new TempoProvider(prisma);
        break;
      default:
        throw new Error(`Unknown provider: ${source}`);
    }

    // Cache the provider
    this.providers.set(key, provider);
    return provider;
  }

  static getAllProviders(prisma: PrismaClient): TimeProvider[] {
    return [
      this.getProvider('TOGGL', prisma),
      this.getProvider('TEMPO', prisma)
    ];
  }

  static clearCache(): void {
    this.providers.clear();
  }
}
