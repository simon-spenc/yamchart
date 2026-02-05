import { describe, it, expect } from 'vitest';
import { detectColumnTypes } from '../../generate/detector.js';
import type { DbtColumn } from '../../dbt/types.js';

describe('detectColumnTypes', () => {
  it('detects date columns by type', () => {
    const columns: DbtColumn[] = [
      { name: 'order_date', data_type: 'date', description: '', hints: [] },
      { name: 'amount', data_type: 'numeric', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dateColumns).toEqual(['order_date']);
  });

  it('detects date columns by name pattern', () => {
    const columns: DbtColumn[] = [
      { name: 'created_at', data_type: 'string', description: '', hints: [] },
      { name: 'updated_at', data_type: 'string', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dateColumns).toContain('created_at');
    expect(result.dateColumns).toContain('updated_at');
  });

  it('detects metric columns (numeric, non-key)', () => {
    const columns: DbtColumn[] = [
      { name: 'id', data_type: 'integer', description: '', hints: ['primary_key'] },
      { name: 'amount', data_type: 'numeric', description: '', hints: [] },
      { name: 'quantity', data_type: 'integer', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.metricColumns).toEqual(['amount', 'quantity']);
    expect(result.metricColumns).not.toContain('id');
  });

  it('detects dimension columns', () => {
    const columns: DbtColumn[] = [
      { name: 'category', data_type: 'varchar', description: '', hints: [] },
      { name: 'region', data_type: 'string', description: '', hints: [] },
      { name: 'customer_id', data_type: 'string', description: '', hints: ['fk:customers'] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dimensionColumns).toContain('category');
    expect(result.dimensionColumns).toContain('region');
    expect(result.dimensionColumns).not.toContain('customer_id');
  });

  it('excludes foreign keys from dimensions', () => {
    const columns: DbtColumn[] = [
      { name: 'user_id', data_type: 'string', description: '', hints: ['fk:users'] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dimensionColumns).not.toContain('user_id');
  });

  it('detects all date type variants', () => {
    const columns: DbtColumn[] = [
      { name: 'col1', data_type: 'timestamp', description: '', hints: [] },
      { name: 'col2', data_type: 'datetime', description: '', hints: [] },
      { name: 'col3', data_type: 'timestamptz', description: '', hints: [] },
      { name: 'col4', data_type: 'timestamp_ntz', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dateColumns).toHaveLength(4);
  });

  it('detects primary key by name "id"', () => {
    const columns: DbtColumn[] = [
      { name: 'id', data_type: 'integer', description: '', hints: [] },
      { name: 'user_id', data_type: 'integer', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.primaryKeys).toEqual(['id']);
    expect(result.metricColumns).toContain('user_id');
  });

  it('detects primary key by unique hint', () => {
    const columns: DbtColumn[] = [
      { name: 'email', data_type: 'varchar', description: '', hints: ['unique'] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.primaryKeys).toEqual(['email']);
  });

  it('detects date columns by _time suffix', () => {
    const columns: DbtColumn[] = [
      { name: 'event_time', data_type: 'string', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dateColumns).toContain('event_time');
  });

  it('treats boolean columns as dimensions', () => {
    const columns: DbtColumn[] = [
      { name: 'is_active', data_type: 'boolean', description: '', hints: [] },
      { name: 'has_purchased', data_type: 'bool', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dimensionColumns).toContain('is_active');
    expect(result.dimensionColumns).toContain('has_purchased');
  });

  it('treats unknown types as dimensions', () => {
    const columns: DbtColumn[] = [
      { name: 'metadata', data_type: 'jsonb', description: '', hints: [] },
      { name: 'user_uuid', data_type: 'uuid', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dimensionColumns).toContain('metadata');
    expect(result.dimensionColumns).toContain('user_uuid');
  });

  it('handles missing data_type', () => {
    const columns: DbtColumn[] = [
      { name: 'some_column', description: '', hints: [] },
    ];
    const result = detectColumnTypes(columns);
    expect(result.dimensionColumns).toContain('some_column');
  });
});
