import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryCache, type CacheProvider, type CachedQueryResult } from '../services/cache.js';

describe('MemoryCache', () => {
  let cache: CacheProvider;

  beforeEach(() => {
    cache = new MemoryCache({ maxSize: 100, defaultTtlMs: 60000 });
  });

  it('stores and retrieves values', async () => {
    const result: CachedQueryResult = {
      columns: [{ name: 'id', type: 'integer' }],
      rows: [{ id: 1 }],
      rowCount: 1,
      durationMs: 100,
      cachedAt: Date.now(),
    };

    await cache.set('key1', result);
    const retrieved = await cache.get('key1');

    expect(retrieved).toEqual(result);
  });

  it('returns null for missing keys', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('respects TTL', async () => {
    // Create cache with very short TTL for testing
    const shortTtlCache = new MemoryCache({ maxSize: 100, defaultTtlMs: 50 });

    const result: CachedQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      cachedAt: Date.now(),
    };

    await shortTtlCache.set('key1', result, 50); // 50ms TTL

    // Should exist immediately
    expect(await shortTtlCache.get('key1')).not.toBeNull();

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should be expired
    expect(await shortTtlCache.get('key1')).toBeNull();
  });

  it('invalidates by exact key', async () => {
    const result: CachedQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      cachedAt: Date.now(),
    };

    await cache.set('chart:revenue', result);
    await cache.set('chart:orders', result);

    await cache.invalidate('chart:revenue');

    expect(await cache.get('chart:revenue')).toBeNull();
    expect(await cache.get('chart:orders')).not.toBeNull();
  });

  it('invalidates by pattern', async () => {
    const result: CachedQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      cachedAt: Date.now(),
    };

    await cache.set('chart:revenue:abc123', result);
    await cache.set('chart:revenue:def456', result);
    await cache.set('chart:orders:ghi789', result);

    await cache.invalidatePattern('chart:revenue:*');

    expect(await cache.get('chart:revenue:abc123')).toBeNull();
    expect(await cache.get('chart:revenue:def456')).toBeNull();
    expect(await cache.get('chart:orders:ghi789')).not.toBeNull();
  });

  it('clears all entries', async () => {
    const result: CachedQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      cachedAt: Date.now(),
    };

    await cache.set('key1', result);
    await cache.set('key2', result);

    await cache.clear();

    expect(await cache.get('key1')).toBeNull();
    expect(await cache.get('key2')).toBeNull();
  });

  it('returns cache stats', async () => {
    const result: CachedQueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      cachedAt: Date.now(),
    };

    await cache.set('key1', result);
    await cache.set('key2', result);

    await cache.get('key1'); // hit
    await cache.get('key1'); // hit
    await cache.get('missing'); // miss

    const stats = cache.getStats();

    expect(stats.size).toBe(2);
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
  });
});
