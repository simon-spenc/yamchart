import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { api } from '../api/client';
import { useFilterStore } from '../stores/filterStore';

export function useChartData(chartName: string) {
  // Subscribe to both global and chart-specific filters for reactivity
  const globalFilters = useFilterStore((s) => s.globalFilters);
  const chartFilters = useFilterStore((s) => s.chartFilters);

  // Merge filters (chart filters override global)
  const filters = useMemo(() => ({
    ...globalFilters,
    ...chartFilters[chartName],
  }), [globalFilters, chartFilters, chartName]);

  // Remove null/undefined values from filters
  const cleanFilters = useMemo(() =>
    Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v != null)
    ),
    [filters]
  );

  return useQuery({
    queryKey: ['chartData', chartName, cleanFilters],
    queryFn: () => api.queryChart(chartName, cleanFilters),
    enabled: !!chartName,
  });
}

/**
 * Combined hook that fetches chart config + data in a single request.
 * More efficient than separate useChart + useChartData calls.
 */
export function useChartWithData(chartName: string) {
  const globalFilters = useFilterStore((s) => s.globalFilters);
  const chartFilters = useFilterStore((s) => s.chartFilters);

  const filters = useMemo(() => ({
    ...globalFilters,
    ...chartFilters[chartName],
  }), [globalFilters, chartFilters, chartName]);

  const cleanFilters = useMemo(() =>
    Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v != null)
    ),
    [filters]
  );

  return useQuery({
    queryKey: ['chartWithData', chartName, cleanFilters],
    queryFn: () => api.queryChart(chartName, cleanFilters, { includeConfig: true }),
    enabled: !!chartName,
  });
}

export function useInvalidateChart() {
  const queryClient = useQueryClient();

  return async (chartName: string) => {
    await api.invalidateChart(chartName);
    // Invalidate all queries for this chart
    queryClient.invalidateQueries({
      queryKey: ['chartData', chartName],
    });
  };
}

export function useRefreshChart() {
  const queryClient = useQueryClient();

  return (chartName: string) => {
    // Invalidate both old and new query patterns
    queryClient.invalidateQueries({
      queryKey: ['chartData', chartName],
    });
    queryClient.invalidateQueries({
      queryKey: ['chartWithData', chartName],
    });
  };
}
