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
});
