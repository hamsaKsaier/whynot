interface CacheEntry {
  key: string;
  fallbackKey: string | null;
  model: string;
  models: string[];
  provider: string;
  isActive: boolean;
  expiresAt: number;
}

class PlatformKeyCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL_MS = 60_000;

  get(provider: string): CacheEntry | null {
    const entry = this.cache.get(provider);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(provider);
      return null;
    }
    return entry;
  }

  set(provider: string, entry: Omit<CacheEntry, 'expiresAt'>): void {
    this.cache.set(provider, {
      ...entry,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  invalidate(provider?: string): void {
    if (provider) {
      this.cache.delete(provider);
    } else {
      this.cache.clear();
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

export const platformKeyCache = new PlatformKeyCache();
export type { CacheEntry };
