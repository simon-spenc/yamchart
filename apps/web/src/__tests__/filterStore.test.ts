import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterStore } from '../stores/filterStore';

describe('filterStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useFilterStore.setState({
      globalFilters: {},
      chartFilters: {},
    });
  });

  it('sets global filter', () => {
    const { setGlobalFilter } = useFilterStore.getState();

    setGlobalFilter('date_range', 'last_30_days');

    const { globalFilters } = useFilterStore.getState();
    expect(globalFilters.date_range).toBe('last_30_days');
  });

  it('sets chart-specific filter', () => {
    const { setChartFilter } = useFilterStore.getState();

    setChartFilter('revenue-trend', 'granularity', 'weekly');

    const { chartFilters } = useFilterStore.getState();
    expect(chartFilters['revenue-trend']?.granularity).toBe('weekly');
  });

  it('gets effective filters merging global and chart filters', () => {
    const { setGlobalFilter, setChartFilter, getEffectiveFilters } =
      useFilterStore.getState();

    setGlobalFilter('date_range', 'last_30_days');
    setGlobalFilter('region', 'US');
    setChartFilter('revenue-trend', 'granularity', 'weekly');
    setChartFilter('revenue-trend', 'region', 'EU'); // Override global

    const effective = getEffectiveFilters('revenue-trend');

    expect(effective.date_range).toBe('last_30_days');
    expect(effective.region).toBe('EU'); // Chart filter overrides
    expect(effective.granularity).toBe('weekly');
  });

  it('resets filters', () => {
    const { setGlobalFilter, setChartFilter, resetFilters } =
      useFilterStore.getState();

    setGlobalFilter('date_range', 'last_30_days');
    setChartFilter('revenue-trend', 'granularity', 'weekly');

    resetFilters();

    const { globalFilters, chartFilters } = useFilterStore.getState();
    expect(globalFilters).toEqual({});
    expect(chartFilters).toEqual({});
  });

  it('resets only chart filters', () => {
    const { setGlobalFilter, setChartFilter, resetChartFilters } =
      useFilterStore.getState();

    setGlobalFilter('date_range', 'last_30_days');
    setChartFilter('revenue-trend', 'granularity', 'weekly');

    resetChartFilters('revenue-trend');

    const { globalFilters, chartFilters } = useFilterStore.getState();
    expect(globalFilters.date_range).toBe('last_30_days');
    expect(chartFilters['revenue-trend']).toBeUndefined();
  });
});
