import { LRUCache } from 'lru-cache';

export interface CachedQueryResult {
  columns: Array<{ name: string; type: string }>;
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
  cachedAt: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
}

export interface CacheProvider {
  get(key: string): Promise<CachedQueryResult | null>;
  set(key: string, value: CachedQueryResult, ttlMs?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): CacheStats;
}

export interface MemoryCacheOptions {
  maxSize: number;
  defaultTtlMs: number;
}

export class MemoryCache implements CacheProvider {
  private cache: LRUCache<string, CachedQueryResult>;
  private defaultTtlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(options: MemoryCacheOptions) {
    this.defaultTtlMs = options.defaultTtlMs;
    this.cache = new LRUCache<string, CachedQueryResult>({
      max: options.maxSize,
      ttl: options.defaultTtlMs,
      ttlAutopurge: true,
    });
  }

  async get(key: string): Promise<CachedQueryResult | null> {
    const value = this.cache.get(key);
    if (value) {
      this.hits++;
      return value;
    }
    this.misses++;
    return null;
  }

  async set(key: string, value: CachedQueryResult, ttlMs?: number): Promise<void> {
    this.cache.set(key, value, { ttl: ttlMs ?? this.defaultTtlMs });
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*'); // Convert * to .*

    const regex = new RegExp(`^${regexPattern}$`);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

/**
 * Parse TTL string (e.g., "1h", "30m", "5s") to milliseconds.
 */
export function parseTtl(ttl: string): number {
  const match = ttl.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }

  const value = parseInt(match[1] ?? '0', 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown TTL unit: ${unit}`);
  }
}
