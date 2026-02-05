import { describe, it, expect } from 'vitest';
import {
  DbtColumnSchema,
  DbtModelSchema,
  DbtProjectConfigSchema,
  type DbtColumn,
  type DbtModel,
} from '../../dbt/types.js';

describe('DbtColumnSchema', () => {
  it('parses minimal column', () => {
    const result = DbtColumnSchema.safeParse({ name: 'id' });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('id');
    expect(result.data?.hints).toEqual([]);
  });

  it('parses column with all fields', () => {
    const result = DbtColumnSchema.safeParse({
      name: 'order_id',
      description: 'Unique order identifier',
      data_type: 'string',
      hints: ['primary_key', 'unique'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.hints).toEqual(['primary_key', 'unique']);
  });
});

describe('DbtModelSchema', () => {
  it('parses minimal model', () => {
    const result = DbtModelSchema.safeParse({
      name: 'orders',
      path: 'models/marts/orders.sql',
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('No description');
  });

  it('parses model with columns and tags', () => {
    const result = DbtModelSchema.safeParse({
      name: 'orders',
      path: 'models/marts/orders.sql',
      description: 'Order transactions',
      table: 'analytics.marts.orders',
      tags: ['bi', 'finance'],
      columns: [{ name: 'id', description: 'Primary key' }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.tags).toEqual(['bi', 'finance']);
    expect(result.data?.columns).toHaveLength(1);
  });
});

describe('DbtProjectConfigSchema', () => {
  it('parses project config', () => {
    const result = DbtProjectConfigSchema.safeParse({
      name: 'analytics',
      version: '1.0.0',
      profile: 'analytics',
      model_paths: ['models'],
      target_path: 'target',
    });
    expect(result.success).toBe(true);
  });
});
