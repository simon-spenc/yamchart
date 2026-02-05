import { describe, it, expect } from 'vitest';
import { parseSchemaYml, extractHintsFromTests } from '../../dbt/parser.js';

describe('extractHintsFromTests', () => {
  it('extracts unique hint', () => {
    const tests = ['unique'];
    expect(extractHintsFromTests(tests)).toContain('unique');
  });

  it('extracts required from not_null', () => {
    const tests = ['not_null'];
    expect(extractHintsFromTests(tests)).toContain('required');
  });

  it('extracts fk from relationships', () => {
    const tests = [
      { relationships: { to: "ref('customers')", field: 'id' } },
    ];
    expect(extractHintsFromTests(tests)).toContain('fk:customers');
  });

  it('extracts primary_key from meta', () => {
    const tests = [{ dbt_constraints: { type: 'primary_key' } }];
    expect(extractHintsFromTests(tests)).toBeDefined();
  });
});

describe('parseSchemaYml', () => {
  it('parses minimal schema', () => {
    const yaml = `
version: 2
models:
  - name: orders
`;
    const result = parseSchemaYml(yaml, 'models/marts/_schema.yml');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('orders');
  });

  it('parses model with description and columns', () => {
    const yaml = `
version: 2
models:
  - name: orders
    description: "Daily order transactions"
    columns:
      - name: order_id
        description: "Unique identifier"
        data_type: string
        tests:
          - unique
          - not_null
      - name: customer_id
        tests:
          - not_null
          - relationships:
              to: ref('customers')
              field: id
`;
    const result = parseSchemaYml(yaml, 'models/marts/_schema.yml');
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Daily order transactions');
    expect(result[0].columns).toHaveLength(2);
    expect(result[0].columns[0].hints).toContain('unique');
    expect(result[0].columns[0].hints).toContain('required');
    expect(result[0].columns[1].hints).toContain('fk:customers');
  });

  it('parses model with tags and meta', () => {
    const yaml = `
version: 2
models:
  - name: orders
    meta:
      yamchart: true
      owner: analytics
    tags:
      - bi
      - finance
`;
    const result = parseSchemaYml(yaml, 'models/marts/_schema.yml');
    expect(result[0].tags).toEqual(['bi', 'finance']);
    expect(result[0].meta).toEqual({ yamchart: true, owner: 'analytics' });
  });

  it('derives path from schema file location', () => {
    const yaml = `
version: 2
models:
  - name: orders
`;
    const result = parseSchemaYml(yaml, 'models/marts/_schema.yml');
    expect(result[0].path).toBe('models/marts/orders.sql');
  });

  it('returns empty array for schema with no models', () => {
    const yaml = `
version: 2
sources:
  - name: raw_data
`;
    const result = parseSchemaYml(yaml, 'models/_schema.yml');
    expect(result).toHaveLength(0);
  });
});
