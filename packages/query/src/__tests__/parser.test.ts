import { describe, it, expect } from 'vitest';
import { parseModelMetadata } from '../parser.js';

describe('parseModelMetadata', () => {
  it('parses model name', () => {
    const sql = `
-- @name: monthly_revenue
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.name).toBe('monthly_revenue');
  });

  it('parses description', () => {
    const sql = `
-- @name: monthly_revenue
-- @description: Monthly revenue aggregated by category
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.description).toBe('Monthly revenue aggregated by category');
  });

  it('parses simple parameters', () => {
    const sql = `
-- @name: monthly_revenue
-- @param start_date: date
-- @param end_date: date
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.params).toHaveLength(2);
    expect(result.params?.[0]).toEqual({ name: 'start_date', type: 'date' });
    expect(result.params?.[1]).toEqual({ name: 'end_date', type: 'date' });
  });

  it('parses parameters with defaults', () => {
    const sql = `
-- @name: monthly_revenue
-- @param start_date: date = dateadd(month, -12, current_date())
-- @param granularity: string = 'month'
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.params?.[0]?.default).toBe("dateadd(month, -12, current_date())");
    expect(result.params?.[1]?.default).toBe("'month'");
  });

  it('parses parameters with options', () => {
    const sql = `
-- @name: monthly_revenue
-- @param granularity: string = 'month' {day, week, month, quarter}
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.params?.[0]?.options).toEqual(['day', 'week', 'month', 'quarter']);
  });

  it('parses owner and tags', () => {
    const sql = `
-- @name: monthly_revenue
-- @owner: analytics-team
-- @tags: [revenue, monthly, core]
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.owner).toBe('analytics-team');
    expect(result.tags).toEqual(['revenue', 'monthly', 'core']);
  });

  it('parses return columns', () => {
    const sql = `
-- @name: monthly_revenue
-- @returns:
--   - period: date -- The time period
--   - revenue: number -- Total revenue in USD
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.returns).toHaveLength(2);
    expect(result.returns?.[0]).toEqual({
      name: 'period',
      type: 'date',
      description: 'The time period',
    });
  });

  it('parses tests', () => {
    const sql = `
-- @name: monthly_revenue
-- @tests:
--   - revenue >= 0
--   - period is not null
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.tests).toEqual(['revenue >= 0', 'period is not null']);
  });

  it('extracts SQL without metadata comments', () => {
    const sql = `
-- @name: monthly_revenue
-- @description: Test model

SELECT
    date_trunc('month', order_date) AS period,
    SUM(amount) AS revenue
FROM orders
GROUP BY 1
`;
    const result = parseModelMetadata(sql);
    expect(result.sql).toContain('SELECT');
    expect(result.sql).toContain('date_trunc');
    expect(result.sql).not.toContain('@name');
  });

  it('throws error if name is missing', () => {
    const sql = `
-- @description: No name
SELECT * FROM orders
`;
    expect(() => parseModelMetadata(sql)).toThrow('Model must have a @name');
  });
});
