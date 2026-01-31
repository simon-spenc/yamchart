import { describe, it, expect } from 'vitest';
import { ProjectSchema, type Project } from '../project.js';

describe('ProjectSchema', () => {
  it('validates minimal project config', () => {
    const input = {
      version: '1.0',
      name: 'my-analytics',
    };

    const result = ProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('my-analytics');
      expect(result.data.version).toBe('1.0');
    }
  });

  it('validates project with defaults', () => {
    const input = {
      version: '1.0',
      name: 'my-analytics',
      defaults: {
        connection: 'local-duckdb',
        timezone: 'America/New_York',
        cache_ttl: '1h',
      },
    };

    const result = ProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaults?.connection).toBe('local-duckdb');
    }
  });

  it('validates project with environments', () => {
    const input = {
      version: '1.0',
      name: 'my-analytics',
      environments: {
        development: {
          connection: 'duckdb-local',
          base_url: 'http://localhost:3000',
        },
        production: {
          connection: 'snowflake-prod',
          base_url: 'https://dashbook.example.com',
        },
      },
    };

    const result = ProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.environments?.development?.connection).toBe('duckdb-local');
    }
  });

  it('rejects project without name', () => {
    const input = {
      version: '1.0',
    };

    const result = ProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects project without version', () => {
    const input = {
      name: 'no-version',
    };

    const result = ProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
