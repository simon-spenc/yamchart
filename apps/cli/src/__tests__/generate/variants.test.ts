import { describe, it, expect } from 'vitest';
import { generateVariants, type VariantConfig } from '../../generate/variants.js';

describe('generateVariants', () => {
  it('generates time series variant when date and metric exist', () => {
    const config: VariantConfig = {
      modelName: 'orders',
      tableName: 'analytics.orders',
      dateColumn: 'order_date',
      metricColumns: [{ name: 'amount', aggregation: 'sum' }],
      dimensionColumns: [],
    };
    const variants = generateVariants(config);

    const timeSeries = variants.find(v => v.name === 'orders_over_time');
    expect(timeSeries).toBeDefined();
    expect(timeSeries?.sql).toContain("date_trunc('{{ granularity }}'");
    expect(timeSeries?.sql).toContain('SUM(amount)');
  });

  it('generates dimension variant for each dimension', () => {
    const config: VariantConfig = {
      modelName: 'orders',
      tableName: 'analytics.orders',
      dateColumn: 'order_date',
      metricColumns: [{ name: 'amount', aggregation: 'sum' }],
      dimensionColumns: ['category', 'region'],
    };
    const variants = generateVariants(config);

    expect(variants.find(v => v.name === 'orders_by_category')).toBeDefined();
    expect(variants.find(v => v.name === 'orders_by_region')).toBeDefined();
  });

  it('generates KPI variant when metrics exist', () => {
    const config: VariantConfig = {
      modelName: 'orders',
      tableName: 'analytics.orders',
      dateColumn: 'order_date',
      metricColumns: [{ name: 'amount', aggregation: 'sum' }],
      dimensionColumns: [],
    };
    const variants = generateVariants(config);

    const kpi = variants.find(v => v.name === 'orders_kpi');
    expect(kpi).toBeDefined();
    expect(kpi?.sql).not.toContain('GROUP BY');
  });

  it('includes @generated comment with model name', () => {
    const config: VariantConfig = {
      modelName: 'orders',
      tableName: 'analytics.orders',
      dateColumn: null,
      metricColumns: [{ name: 'amount', aggregation: 'sum' }],
      dimensionColumns: [],
    };
    const variants = generateVariants(config);

    expect(variants[0].sql).toContain("@generated: from dbt model 'orders'");
  });

  it('handles avg aggregation', () => {
    const config: VariantConfig = {
      modelName: 'orders',
      tableName: 'analytics.orders',
      dateColumn: null,
      metricColumns: [{ name: 'price', aggregation: 'avg' }],
      dimensionColumns: [],
    };
    const variants = generateVariants(config);

    expect(variants[0].sql).toContain('AVG(price)');
  });

  it('skips time series when no date column', () => {
    const config: VariantConfig = {
      modelName: 'products',
      tableName: 'analytics.products',
      dateColumn: null,
      metricColumns: [{ name: 'price', aggregation: 'sum' }],
      dimensionColumns: ['category'],
    };
    const variants = generateVariants(config);

    expect(variants.find(v => v.name === 'products_over_time')).toBeUndefined();
    expect(variants.find(v => v.name === 'products_by_category')).toBeDefined();
  });
});
