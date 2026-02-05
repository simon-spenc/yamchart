import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../api/client';
import type { DashboardLayout, DashboardWidget } from '../api/types';
import { useFilterStore } from '../stores/filterStore';

export function useDashboards() {
  return useQuery({
    queryKey: ['dashboards'],
    queryFn: () => api.getDashboards(),
  });
}

// Extract chart names from dashboard layout
function extractChartNames(layout: DashboardLayout): string[] {
  const chartNames: string[] = [];
  for (const row of layout.rows) {
    for (const widget of row.widgets) {
      if (widget.type === 'chart' && widget.ref) {
        chartNames.push(widget.ref);
      }
    }
  }
  return chartNames;
}

export function useDashboard(id: string, branch?: string) {
  const queryClient = useQueryClient();
  const globalFilters = useFilterStore((s) => s.globalFilters);

  const query = useQuery({
    queryKey: ['dashboard', id, branch],
    queryFn: () => api.getDashboard(id, branch),
    enabled: !!id,
  });

  // Prefetch chart data when dashboard loads
  useEffect(() => {
    if (query.data?.layout) {
      const chartNames = extractChartNames(query.data.layout);

      // Remove null/undefined filters
      const cleanFilters = Object.fromEntries(
        Object.entries(globalFilters).filter(([_, v]) => v != null)
      );

      // Prefetch each chart's data with config
      chartNames.forEach((chartName) => {
        queryClient.prefetchQuery({
          queryKey: ['chartWithData', chartName, cleanFilters],
          queryFn: () => api.queryChart(chartName, cleanFilters, { includeConfig: true }),
          staleTime: 1000 * 60 * 5, // 5 minutes
        });
      });
    }
  }, [query.data?.layout, globalFilters, queryClient]);

  return query;
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
    // Invalidate all chart data queries (both old and new patterns)
    queryClient.invalidateQueries({ queryKey: ['chartData'] });
    queryClient.invalidateQueries({ queryKey: ['chartWithData'] });
  };
}
