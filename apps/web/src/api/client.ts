import type {
  HealthResponse,
  ProjectConfig,
  ChartDefinition,
  QueryResponse,
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
    params: Record<string, unknown> = {}
  ): Promise<QueryResponse> =>
    fetchJson(`/charts/${encodeURIComponent(name)}/query`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  invalidateChart: (name: string): Promise<{ success: boolean }> =>
    fetchJson(`/charts/${encodeURIComponent(name)}/invalidate`, {
      method: 'POST',
    }),
};

export { ApiError };
