import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { DashboardLayout } from '../api/types';

export function useDashboards() {
  return useQuery({
    queryKey: ['dashboards'],
    queryFn: () => api.getDashboards(),
  });
}

export function useDashboard(id: string, branch?: string) {
  return useQuery({
    queryKey: ['dashboard', id, branch],
    queryFn: () => api.getDashboard(id, branch),
    enabled: !!id,
  });
}

export function useSaveDashboard(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ layout, message }: { layout: DashboardLayout; message?: string }) =>
      api.saveDashboard(id, layout, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', id] });
    },
  });
}

export function useRefreshDashboard() {
  const queryClient = useQueryClient();

  return () => {
    // Invalidate all chart data queries
    queryClient.invalidateQueries({ queryKey: ['chartData'] });
  };
}
