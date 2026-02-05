import type {
  HealthResponse,
  ProjectConfig,
  ChartDefinition,
  QueryResponse,
  DashboardSummary,
  Dashboard,
  DashboardLayout,
  BranchesResponse,
  SaveDashboardResponse,
  ParameterOptionsResponse,
} from './types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Health check
  getHealth: (): Promise<HealthResponse> => fetchJson('/health'),

  // Project config
  getConfig: (): Promise<ProjectConfig> => fetchJson('/config'),

  // Charts
  getChart: (name: string): Promise<ChartDefinition> =>
    fetchJson(`/charts/${encodeURIComponent(name)}`),

  queryChart: (
    name: string,
    params: Record<string, unknown> = {},
    options: { includeConfig?: boolean } = {}
  ): Promise<QueryResponse> =>
    fetchJson(`/charts/${encodeURIComponent(name)}/query${options.includeConfig ? '?includeConfig=true' : ''}`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Batch query multiple charts in one request
  queryChartsBatch: (
    charts: Array<{ name: string; params?: Record<string, unknown> }>,
    options: { includeConfig?: boolean } = {}
  ): Promise<{ results: QueryResponse[] }> =>
    fetchJson('/charts/batch', {
      method: 'POST',
      body: JSON.stringify({ charts, includeConfig: options.includeConfig }),
    }),

  invalidateChart: (name: string): Promise<{ success: boolean }> =>
    fetchJson(`/charts/${encodeURIComponent(name)}/invalidate`, {
      method: 'POST',
    }),

  getParameterOptions: (
    chartName: string,
    paramName: string
  ): Promise<ParameterOptionsResponse> =>
    fetchJson(
      `/charts/${encodeURIComponent(chartName)}/parameters/${encodeURIComponent(paramName)}/options`
    ),

  // Dashboards
  getDashboards: (): Promise<DashboardSummary[]> => fetchJson('/dashboards'),

  getDashboard: (id: string, branch?: string): Promise<Dashboard> => {
    const url = branch
      ? `/dashboards/${encodeURIComponent(id)}?branch=${encodeURIComponent(branch)}`
      : `/dashboards/${encodeURIComponent(id)}`;
    return fetchJson(url);
  },

  saveDashboard: (
    id: string,
    layout: DashboardLayout,
    message?: string
  ): Promise<SaveDashboardResponse> =>
    fetchJson(`/dashboards/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({ layout, message }),
    }),

  // Warm up dashboard cache (pre-fetch all chart data)
  warmDashboardCache: (
    id: string,
    params: Record<string, unknown> = {}
  ): Promise<{ dashboard: string; charts: number; cached: number; fresh: number }> =>
    fetchJson(`/dashboards/${encodeURIComponent(id)}/warm-cache`, {
      method: 'POST',
      body: JSON.stringify({ params }),
    }),

  // Git operations
  getBranches: (): Promise<BranchesResponse> => fetchJson('/git/branches'),

  createBranch: (name: string, from?: string): Promise<{ success: boolean; branch: string }> =>
    fetchJson('/git/branches', {
      method: 'POST',
      body: JSON.stringify({ name, from }),
    }),

  checkoutBranch: (branch: string): Promise<{ success: boolean; branch: string }> =>
    fetchJson('/git/checkout', {
      method: 'POST',
      body: JSON.stringify({ branch }),
    }),
};

export { ApiError };
