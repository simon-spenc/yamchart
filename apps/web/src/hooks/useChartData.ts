import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useFilterStore } from '../stores/filterStore';

export function useChartData(chartName: string) {
  const getEffectiveFilters = useFilterStore((s) => s.getEffectiveFilters);
  const filters = getEffectiveFilters(chartName);

  // Remove null/undefined values from filters
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) => v != null)
  );

  return useQuery({
    queryKey: ['chartData', chartName, cleanFilters],
    queryFn: () => api.queryChart(chartName, cleanFilters),
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
    queryClient.invalidateQueries({
      queryKey: ['chartData', chartName],
    });
  };
}
