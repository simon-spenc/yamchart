import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useChart(chartName: string) {
  return useQuery({
    queryKey: ['chart', chartName],
    queryFn: () => api.getChart(chartName),
    enabled: !!chartName,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
