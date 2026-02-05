import { describe, it, expect } from 'vitest';
import { buildDateColumnChoices, buildMetricChoices, buildDimensionChoices } from '../../generate/prompts.js';
import type { DetectedColumns } from '../../generate/detector.js';

describe('prompt builders', () => {
  it('buildDateColumnChoices includes detected columns plus skip option', () => {
    const detected: DetectedColumns = {
      dateColumns: ['order_date', 'created_at'],
      metricColumns: [],
      dimensionColumns: [],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildDateColumnChoices(detected);

    expect(choices).toHaveLength(3); // 2 columns + skip
    expect(choices[0]).toEqual({ name: 'order_date', value: 'order_date', checked: true });
    expect(choices[2]).toEqual({ name: 'Skip time series', value: null, checked: false });
  });

  it('buildDateColumnChoices returns only skip when no date columns', () => {
    const detected: DetectedColumns = {
      dateColumns: [],
      metricColumns: [],
      dimensionColumns: [],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildDateColumnChoices(detected);

    expect(choices).toHaveLength(1);
    expect(choices[0]).toEqual({ name: 'Skip time series', value: null, checked: false });
  });

  it('buildDateColumnChoices marks only first column as checked', () => {
    const detected: DetectedColumns = {
      dateColumns: ['order_date', 'created_at', 'updated_at'],
      metricColumns: [],
      dimensionColumns: [],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildDateColumnChoices(detected);

    expect(choices[0].checked).toBe(true);
    expect(choices[1].checked).toBe(false);
    expect(choices[2].checked).toBe(false);
    expect(choices[3].checked).toBe(false); // skip option
  });

  it('buildMetricChoices includes aggregation type', () => {
    const detected: DetectedColumns = {
      dateColumns: [],
      metricColumns: ['amount', 'quantity'],
      dimensionColumns: [],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildMetricChoices(detected);

    expect(choices).toHaveLength(2);
    expect(choices[0].value).toEqual({ name: 'amount', aggregation: 'sum' });
  });

  it('buildMetricChoices marks all metrics as checked by default', () => {
    const detected: DetectedColumns = {
      dateColumns: [],
      metricColumns: ['amount', 'quantity', 'price'],
      dimensionColumns: [],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildMetricChoices(detected);

    expect(choices).toHaveLength(3);
    expect(choices.every(c => c.checked)).toBe(true);
  });

  it('buildMetricChoices includes display name with aggregation', () => {
    const detected: DetectedColumns = {
      dateColumns: [],
      metricColumns: ['total_amount'],
      dimensionColumns: [],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildMetricChoices(detected);

    expect(choices[0].name).toBe('total_amount (sum)');
  });

  it('buildMetricChoices returns empty array when no metrics', () => {
    const detected: DetectedColumns = {
      dateColumns: [],
      metricColumns: [],
      dimensionColumns: [],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildMetricChoices(detected);

    expect(choices).toHaveLength(0);
  });

  it('buildDimensionChoices returns dimension columns', () => {
    const detected: DetectedColumns = {
      dateColumns: [],
      metricColumns: [],
      dimensionColumns: ['category', 'region'],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildDimensionChoices(detected);

    expect(choices).toHaveLength(2);
    expect(choices[0]).toEqual({ name: 'category', value: 'category', checked: true });
  });

  it('buildDimensionChoices marks all dimensions as checked by default', () => {
    const detected: DetectedColumns = {
      dateColumns: [],
      metricColumns: [],
      dimensionColumns: ['category', 'region', 'status'],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildDimensionChoices(detected);

    expect(choices).toHaveLength(3);
    expect(choices.every(c => c.checked)).toBe(true);
  });

  it('buildDimensionChoices returns empty array when no dimensions', () => {
    const detected: DetectedColumns = {
      dateColumns: [],
      metricColumns: [],
      dimensionColumns: [],
      primaryKeys: [],
      foreignKeys: [],
    };
    const choices = buildDimensionChoices(detected);

    expect(choices).toHaveLength(0);
  });
});
