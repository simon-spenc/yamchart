import { describe, it, expect } from 'vitest';
import { ModelMetadataSchema, type ModelMetadata } from '../model.js';

describe('ModelMetadataSchema', () => {
  it('validates minimal model metadata', () => {
    const input = {
      name: 'monthly_revenue',
    };

    const result = ModelMetadataSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('validates model with parameters', () => {
    const input = {
      name: 'monthly_revenue',
      description: 'Monthly revenue aggregated by category',
      params: [
        { name: 'start_date', type: 'date', default: 'current_date()' },
        { name: 'end_date', type: 'date' },
        { name: 'granularity', type: 'string', default: 'month', options: ['day', 'week', 'month'] },
      ],
    };

    const result = ModelMetadataSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.params).toHaveLength(3);
      expect(result.data.params![0].name).toBe('start_date');
    }
  });

  it('validates model with returns', () => {
    const input = {
      name: 'monthly_revenue',
      returns: [
        { name: 'period', type: 'date', description: 'The time period' },
        { name: 'revenue', type: 'number', description: 'Total revenue' },
      ],
    };

    const result = ModelMetadataSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.returns).toHaveLength(2);
    }
  });

  it('validates model with tests', () => {
    const input = {
      name: 'monthly_revenue',
      tests: [
        'revenue >= 0',
        'order_count >= 0',
        'period is not null',
      ],
    };

    const result = ModelMetadataSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tests).toHaveLength(3);
    }
  });

  it('rejects model without name', () => {
    const input = {
      description: 'No name model',
    };

    const result = ModelMetadataSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
