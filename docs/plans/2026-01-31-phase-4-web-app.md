# Dashbook Phase 4: Web App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the React frontend that renders interactive charts with filters, completing the MVP end-to-end experience.

**Architecture:** Vite + React app consuming the API server. React Query manages server state (chart data), Zustand manages UI state (filters). ECharts renders visualizations. Each chart fetches independently, enabling partial updates without full page refresh.

**Tech Stack:** Vite, React 18, TypeScript, React Query (TanStack Query), Zustand, ECharts, Tailwind CSS, date-fns

**Prerequisites:** Phase 0-3 complete (schema, query, server packages)

---

## Task 1: Create Web App Package Structure

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`

**Step 1: Create apps/web/package.json**

```json
{
  "name": "@dashbook/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tanstack/react-query": "^5.62.0",
    "zustand": "^5.0.0",
    "echarts": "^5.5.0",
    "echarts-for-react": "^3.0.2",
    "date-fns": "^4.1.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "jsdom": "^25.0.0"
  }
}
```

**Step 2: Create apps/web/tsconfig.json**

```json
{
  "extends": "@dashbook/config/tsconfig.react.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 3: Create apps/web/tsconfig.node.json**

```json
{
  "extends": "@dashbook/config/tsconfig.node.json",
  "include": ["vite.config.ts"]
}
```

**Step 4: Create apps/web/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 5: Create apps/web/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashbook</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/tsconfig.node.json apps/web/vite.config.ts apps/web/index.html
git commit -m "chore: add web app package structure"
```

---

## Task 2: Setup Tailwind CSS

**Files:**
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/src/index.css`

**Step 1: Create apps/web/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

**Step 2: Create apps/web/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 3: Create apps/web/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-background: #ffffff;
  --color-surface: #f9fafb;
  --color-border: #e5e7eb;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
}

body {
  font-family: 'Inter', system-ui, sans-serif;
  background-color: var(--color-background);
  color: var(--color-text-primary);
}

/* Chart container defaults */
.chart-container {
  @apply bg-white rounded-lg border border-gray-200 shadow-sm;
}
```

**Step 4: Commit**

```bash
git add apps/web/tailwind.config.js apps/web/postcss.config.js apps/web/src/index.css
git commit -m "chore: setup Tailwind CSS"
```

---

## Task 3: Create App Entry Point and Providers

**Files:**
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/providers/QueryProvider.tsx`

**Step 1: Create apps/web/src/main.tsx**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider } from './providers/QueryProvider';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>
);
```

**Step 2: Create apps/web/src/providers/QueryProvider.tsx**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30, // 30 minutes
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Step 3: Create apps/web/src/App.tsx**

```typescript
import { Header } from './components/Header';
import { ChartView } from './components/ChartView';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ChartView chartName="revenue-trend" />
      </main>
    </div>
  );
}

export default App;
```

**Step 4: Commit**

```bash
git add apps/web/src/main.tsx apps/web/src/App.tsx apps/web/src/providers/
git commit -m "feat(web): add app entry point and React Query provider"
```

---

## Task 4: Create API Client

**Files:**
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/api/types.ts`

**Step 1: Create apps/web/src/api/types.ts**

```typescript
// API Response Types

export interface Column {
  name: string;
  type: string;
}

export interface QueryMeta {
  cached: boolean;
  durationMs: number;
  rowCount: number;
  cacheKey: string;
}

export interface QueryResponse {
  columns: Column[];
  rows: Array<Record<string, unknown>>;
  meta: QueryMeta;
}

export interface ChartParameter {
  name: string;
  type: 'date_range' | 'select' | 'multi_select' | 'text' | 'number';
  label?: string;
  default?: string | number | string[];
  options?: Array<string | { value: string; label: string }>;
}

export interface AxisConfig {
  field: string;
  type: 'temporal' | 'quantitative' | 'ordinal' | 'nominal';
  format?: string;
  label?: string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'table' | 'metric';
  x: AxisConfig;
  y: AxisConfig;
  series?: Array<{
    field: string;
    name?: string;
    color?: string;
  }>;
}

export interface ChartDefinition {
  name: string;
  title: string;
  description?: string;
  parameters: ChartParameter[];
  chart: ChartConfig;
}

export interface ProjectConfig {
  name: string;
  version: string;
  description?: string;
  charts: Array<{
    name: string;
    title: string;
    description?: string;
    type: string;
  }>;
  connections: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  project: string;
}
```

**Step 2: Create apps/web/src/api/client.ts**

```typescript
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
```

**Step 3: Commit**

```bash
git add apps/web/src/api/
git commit -m "feat(web): add API client with TypeScript types"
```

---

## Task 5: Create Filter Store (Zustand)

**Files:**
- Create: `apps/web/src/stores/filterStore.ts`
- Create: `apps/web/src/__tests__/filterStore.test.ts`

**Step 1: Write failing test for filter store**

Create `apps/web/src/__tests__/filterStore.test.ts`:

```typescript
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
```

**Step 2: Create vitest config**

Create `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

**Step 3: Create test setup**

Create `apps/web/src/__tests__/setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

**Step 4: Run test to verify it fails**

Run: `pnpm --filter @dashbook/web test`

Expected: FAIL - cannot find module '../stores/filterStore'

**Step 5: Implement filter store**

Create `apps/web/src/stores/filterStore.ts`:

```typescript
import { create } from 'zustand';

export type FilterValue = string | number | boolean | string[] | null;

export interface FilterStore {
  // State
  globalFilters: Record<string, FilterValue>;
  chartFilters: Record<string, Record<string, FilterValue>>;

  // Actions
  setGlobalFilter: (name: string, value: FilterValue) => void;
  setChartFilter: (chartName: string, filterName: string, value: FilterValue) => void;
  getEffectiveFilters: (chartName: string) => Record<string, FilterValue>;
  resetFilters: () => void;
  resetChartFilters: (chartName: string) => void;
}

export const useFilterStore = create<FilterStore>((set, get) => ({
  globalFilters: {},
  chartFilters: {},

  setGlobalFilter: (name, value) =>
    set((state) => ({
      globalFilters: { ...state.globalFilters, [name]: value },
    })),

  setChartFilter: (chartName, filterName, value) =>
    set((state) => ({
      chartFilters: {
        ...state.chartFilters,
        [chartName]: {
          ...state.chartFilters[chartName],
          [filterName]: value,
        },
      },
    })),

  getEffectiveFilters: (chartName) => {
    const { globalFilters, chartFilters } = get();
    return {
      ...globalFilters,
      ...chartFilters[chartName],
    };
  },

  resetFilters: () =>
    set({
      globalFilters: {},
      chartFilters: {},
    }),

  resetChartFilters: (chartName) =>
    set((state) => {
      const { [chartName]: _, ...rest } = state.chartFilters;
      return { chartFilters: rest };
    }),
}));
```

**Step 6: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/web test`

Expected: All tests pass.

**Step 7: Commit**

```bash
git add apps/web/src/stores/ apps/web/src/__tests__/ apps/web/vitest.config.ts
git commit -m "feat(web): add Zustand filter store"
```

---

## Task 6: Create React Query Hooks

**Files:**
- Create: `apps/web/src/hooks/useChart.ts`
- Create: `apps/web/src/hooks/useChartData.ts`
- Create: `apps/web/src/hooks/useConfig.ts`
- Create: `apps/web/src/hooks/index.ts`

**Step 1: Create apps/web/src/hooks/useConfig.ts**

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
    staleTime: Infinity, // Config rarely changes
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000, // Check health every 30s
  });
}
```

**Step 2: Create apps/web/src/hooks/useChart.ts**

```typescript
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
```

**Step 3: Create apps/web/src/hooks/useChartData.ts**

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useFilterStore, type FilterValue } from '../stores/filterStore';

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
```

**Step 4: Create apps/web/src/hooks/index.ts**

```typescript
export { useConfig, useHealth } from './useConfig';
export { useChart } from './useChart';
export { useChartData, useInvalidateChart, useRefreshChart } from './useChartData';
```

**Step 5: Commit**

```bash
git add apps/web/src/hooks/
git commit -m "feat(web): add React Query hooks for chart data fetching"
```

---

## Task 7: Create Header Component

**Files:**
- Create: `apps/web/src/components/Header.tsx`

**Step 1: Create apps/web/src/components/Header.tsx**

```typescript
import { useConfig, useHealth } from '../hooks';

export function Header() {
  const { data: config } = useConfig();
  const { data: health } = useHealth();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {config?.name || 'Dashbook'}
            </h1>
            {config?.description && (
              <span className="text-sm text-gray-500">{config.description}</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Connection status */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {health?.status === 'ok' ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Version */}
            <span className="text-xs text-gray-400">v{health?.version}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/Header.tsx
git commit -m "feat(web): add Header component with connection status"
```

---

## Task 8: Create Filter Components

**Files:**
- Create: `apps/web/src/components/filters/DateRangeFilter.tsx`
- Create: `apps/web/src/components/filters/SelectFilter.tsx`
- Create: `apps/web/src/components/filters/FilterBar.tsx`
- Create: `apps/web/src/components/filters/index.ts`

**Step 1: Create apps/web/src/components/filters/DateRangeFilter.tsx**

```typescript
import { useFilterStore } from '../../stores/filterStore';

const DATE_PRESETS = [
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
  { value: 'last_12_months', label: 'Last 12 months' },
  { value: 'year_to_date', label: 'Year to date' },
  { value: 'month_to_date', label: 'Month to date' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'previous_quarter', label: 'Previous quarter' },
  { value: 'previous_year', label: 'Previous year' },
];

interface DateRangeFilterProps {
  name: string;
  label?: string;
  chartName?: string;
  defaultValue?: string;
}

export function DateRangeFilter({
  name,
  label,
  chartName,
  defaultValue = 'last_30_days',
}: DateRangeFilterProps) {
  const globalFilters = useFilterStore((s) => s.globalFilters);
  const chartFilters = useFilterStore((s) => s.chartFilters);
  const setGlobalFilter = useFilterStore((s) => s.setGlobalFilter);
  const setChartFilter = useFilterStore((s) => s.setChartFilter);

  const currentValue = chartName
    ? chartFilters[chartName]?.[name] ?? globalFilters[name] ?? defaultValue
    : globalFilters[name] ?? defaultValue;

  const handleChange = (value: string) => {
    if (chartName) {
      setChartFilter(chartName, name, value);
    } else {
      setGlobalFilter(name, value);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <select
        value={currentValue as string}
        onChange={(e) => handleChange(e.target.value)}
        className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        {DATE_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

**Step 2: Create apps/web/src/components/filters/SelectFilter.tsx**

```typescript
import { useFilterStore } from '../../stores/filterStore';

interface Option {
  value: string;
  label: string;
}

interface SelectFilterProps {
  name: string;
  label?: string;
  options: Option[];
  chartName?: string;
  defaultValue?: string;
}

export function SelectFilter({
  name,
  label,
  options,
  chartName,
  defaultValue,
}: SelectFilterProps) {
  const globalFilters = useFilterStore((s) => s.globalFilters);
  const chartFilters = useFilterStore((s) => s.chartFilters);
  const setGlobalFilter = useFilterStore((s) => s.setGlobalFilter);
  const setChartFilter = useFilterStore((s) => s.setChartFilter);

  const currentValue = chartName
    ? chartFilters[chartName]?.[name] ?? globalFilters[name] ?? defaultValue
    : globalFilters[name] ?? defaultValue;

  const handleChange = (value: string) => {
    if (chartName) {
      setChartFilter(chartName, name, value);
    } else {
      setGlobalFilter(name, value);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <select
        value={(currentValue as string) ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

**Step 3: Create apps/web/src/components/filters/FilterBar.tsx**

```typescript
import type { ChartParameter } from '../../api/types';
import { DateRangeFilter } from './DateRangeFilter';
import { SelectFilter } from './SelectFilter';

interface FilterBarProps {
  parameters: ChartParameter[];
  chartName?: string;
}

export function FilterBar({ parameters, chartName }: FilterBarProps) {
  if (parameters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {parameters.map((param) => {
        const label = param.label || param.name;
        const defaultValue =
          typeof param.default === 'string' ? param.default : undefined;

        switch (param.type) {
          case 'date_range':
            return (
              <DateRangeFilter
                key={param.name}
                name={param.name}
                label={label}
                chartName={chartName}
                defaultValue={defaultValue}
              />
            );

          case 'select':
            const options = (param.options || []).map((opt) =>
              typeof opt === 'string' ? { value: opt, label: opt } : opt
            );
            return (
              <SelectFilter
                key={param.name}
                name={param.name}
                label={label}
                options={options}
                chartName={chartName}
                defaultValue={defaultValue}
              />
            );

          default:
            // Unsupported filter type - render as text for now
            return (
              <div key={param.name} className="text-sm text-gray-500">
                {label}: {param.type} (not supported)
              </div>
            );
        }
      })}
    </div>
  );
}
```

**Step 4: Create apps/web/src/components/filters/index.ts**

```typescript
export { DateRangeFilter } from './DateRangeFilter';
export { SelectFilter } from './SelectFilter';
export { FilterBar } from './FilterBar';
```

**Step 5: Commit**

```bash
git add apps/web/src/components/filters/
git commit -m "feat(web): add filter components (DateRange, Select, FilterBar)"
```

---

## Task 9: Create ECharts Wrapper

**Files:**
- Create: `apps/web/src/components/charts/EChart.tsx`
- Create: `apps/web/src/components/charts/LineChart.tsx`
- Create: `apps/web/src/components/charts/index.ts`

**Step 1: Create apps/web/src/components/charts/EChart.tsx**

```typescript
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useRef, useEffect } from 'react';

interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  loading?: boolean;
  onEvents?: Record<string, (params: unknown) => void>;
}

export function EChart({
  option,
  height = 400,
  loading = false,
  onEvents,
}: EChartProps) {
  const chartRef = useRef<ReactECharts>(null);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      chartRef.current?.getEchartsInstance()?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height, width: '100%' }}
      showLoading={loading}
      onEvents={onEvents}
      opts={{ renderer: 'svg' }}
    />
  );
}
```

**Step 2: Create apps/web/src/components/charts/LineChart.tsx**

```typescript
import type { EChartsOption } from 'echarts';
import { EChart } from './EChart';
import type { Column, AxisConfig } from '../../api/types';
import { format, parseISO } from 'date-fns';

interface LineChartProps {
  data: Array<Record<string, unknown>>;
  columns: Column[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  height?: number;
  loading?: boolean;
}

export function LineChart({
  data,
  columns,
  xAxis,
  yAxis,
  height = 400,
  loading = false,
}: LineChartProps) {
  // Extract x and y values
  const xValues = data.map((row) => {
    const value = row[xAxis.field];
    if (xAxis.type === 'temporal' && typeof value === 'string') {
      try {
        const date = parseISO(value);
        return format(date, xAxis.format || 'MMM yyyy');
      } catch {
        return value;
      }
    }
    return value;
  });

  const yValues = data.map((row) => {
    const value = row[yAxis.field];
    return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
  });

  // Format y-axis values
  const formatYValue = (value: number): string => {
    if (yAxis.format) {
      // Simple format handling for common patterns
      if (yAxis.format.includes('$')) {
        return `$${value.toLocaleString()}`;
      }
      if (yAxis.format.includes('%')) {
        return `${value.toFixed(1)}%`;
      }
    }
    return value.toLocaleString();
  };

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = params as Array<{ name: string; value: number; marker: string }>;
        if (!Array.isArray(p) || p.length === 0) return '';
        const point = p[0];
        return `
          <div style="padding: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${point.name}</div>
            <div>${point.marker} ${yAxis.label || yAxis.field}: ${formatYValue(point.value)}</div>
          </div>
        `;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: xValues as string[],
      axisLabel: {
        color: '#6B7280',
        fontSize: 12,
      },
      axisLine: {
        lineStyle: { color: '#E5E7EB' },
      },
      axisTick: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      name: yAxis.label,
      nameLocation: 'middle',
      nameGap: 50,
      nameTextStyle: {
        color: '#6B7280',
        fontSize: 12,
      },
      axisLabel: {
        color: '#6B7280',
        fontSize: 12,
        formatter: (value: number) => formatYValue(value),
      },
      axisLine: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          color: '#E5E7EB',
          type: 'dashed',
        },
      },
    },
    series: [
      {
        type: 'line',
        data: yValues,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 2,
          color: '#3B82F6',
        },
        itemStyle: {
          color: '#3B82F6',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' },
            ],
          },
        },
      },
    ],
    animation: true,
    animationDuration: 300,
  };

  return <EChart option={option} height={height} loading={loading} />;
}
```

**Step 3: Create apps/web/src/components/charts/index.ts**

```typescript
export { EChart } from './EChart';
export { LineChart } from './LineChart';
```

**Step 4: Commit**

```bash
git add apps/web/src/components/charts/
git commit -m "feat(web): add ECharts wrapper and LineChart component"
```

---

## Task 10: Create ChartContainer and ChartView Components

**Files:**
- Create: `apps/web/src/components/ChartContainer.tsx`
- Create: `apps/web/src/components/ChartView.tsx`

**Step 1: Create apps/web/src/components/ChartContainer.tsx**

```typescript
import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface ChartContainerProps {
  title: string;
  description?: string;
  loading?: boolean;
  error?: Error | null;
  cached?: boolean;
  durationMs?: number;
  onRefresh?: () => void;
  children: ReactNode;
}

export function ChartContainer({
  title,
  description,
  loading = false,
  error = null,
  cached,
  durationMs,
  onRefresh,
  children,
}: ChartContainerProps) {
  return (
    <div className="chart-container">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Cache indicator */}
          {cached !== undefined && (
            <span
              className={clsx(
                'text-xs px-2 py-1 rounded',
                cached
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              )}
            >
              {cached ? 'Cached' : 'Fresh'}
            </span>
          )}

          {/* Duration */}
          {durationMs !== undefined && (
            <span className="text-xs text-gray-400">{durationMs}ms</span>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg
                className={clsx('w-4 h-4', loading && 'animate-spin')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error ? (
          <div className="flex items-center justify-center h-64 text-red-500">
            <div className="text-center">
              <p className="font-medium">Failed to load chart</p>
              <p className="text-sm mt-1">{error.message}</p>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create apps/web/src/components/ChartView.tsx**

```typescript
import { useChart, useChartData, useRefreshChart } from '../hooks';
import { ChartContainer } from './ChartContainer';
import { FilterBar } from './filters';
import { LineChart } from './charts';

interface ChartViewProps {
  chartName: string;
}

export function ChartView({ chartName }: ChartViewProps) {
  const { data: chartDef, isLoading: isLoadingDef } = useChart(chartName);
  const { data: chartData, isLoading: isLoadingData, error } = useChartData(chartName);
  const refresh = useRefreshChart();

  const isLoading = isLoadingDef || isLoadingData;

  if (isLoadingDef) {
    return (
      <div className="chart-container animate-pulse">
        <div className="p-4 border-b border-gray-100">
          <div className="h-6 bg-gray-200 rounded w-48" />
        </div>
        <div className="p-4">
          <div className="h-80 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!chartDef) {
    return (
      <div className="chart-container p-8 text-center text-gray-500">
        Chart not found: {chartName}
      </div>
    );
  }

  const renderChart = () => {
    if (!chartData) {
      return <div className="h-80 bg-gray-50 rounded animate-pulse" />;
    }

    switch (chartDef.chart.type) {
      case 'line':
        return (
          <LineChart
            data={chartData.rows}
            columns={chartData.columns}
            xAxis={chartDef.chart.x}
            yAxis={chartDef.chart.y}
            loading={isLoadingData}
          />
        );

      // Add more chart types here as they're implemented
      // case 'bar':
      //   return <BarChart ... />;

      default:
        return (
          <div className="h-80 flex items-center justify-center text-gray-500">
            Chart type "{chartDef.chart.type}" not yet implemented
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      {chartDef.parameters.length > 0 && (
        <FilterBar parameters={chartDef.parameters} chartName={chartName} />
      )}

      {/* Chart */}
      <ChartContainer
        title={chartDef.title}
        description={chartDef.description}
        loading={isLoading}
        error={error as Error | null}
        cached={chartData?.meta.cached}
        durationMs={chartData?.meta.durationMs}
        onRefresh={() => refresh(chartName)}
      >
        {renderChart()}
      </ChartContainer>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/ChartContainer.tsx apps/web/src/components/ChartView.tsx
git commit -m "feat(web): add ChartContainer and ChartView components"
```

---

## Task 11: Create Component Index and Final Wiring

**Files:**
- Create: `apps/web/src/components/index.ts`
- Update: `apps/web/src/App.tsx`

**Step 1: Create apps/web/src/components/index.ts**

```typescript
export { Header } from './Header';
export { ChartContainer } from './ChartContainer';
export { ChartView } from './ChartView';
export * from './filters';
export * from './charts';
```

**Step 2: Update apps/web/src/App.tsx for completeness**

```typescript
import { Header } from './components/Header';
import { ChartView } from './components/ChartView';
import { useConfig } from './hooks';

function App() {
  const { data: config, isLoading } = useConfig();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // For MVP, show the first chart or revenue-trend
  const chartName = config?.charts[0]?.name || 'revenue-trend';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ChartView chartName={chartName} />
      </main>
    </div>
  );
}

export default App;
```

**Step 3: Commit**

```bash
git add apps/web/src/components/index.ts apps/web/src/App.tsx
git commit -m "feat(web): wire up components and complete MVP app"
```

---

## Task 12: Install Dependencies and Test

**Step 1: Install all dependencies**

Run: `pnpm install`

**Step 2: Build all packages**

Run: `pnpm build`

**Step 3: Run tests**

Run: `pnpm test`

Expected: All tests pass.

**Step 4: Start development servers**

Terminal 1 (API server):
```bash
cd examples
DASHBOOK_PROJECT_DIR=. pnpm --filter @dashbook/server dev
```

Terminal 2 (Web app):
```bash
pnpm --filter @dashbook/web dev
```

**Step 5: Open browser**

Navigate to: `http://localhost:3000`

Expected: See the Dashbook header, filter controls, and a line chart showing revenue data.

**Step 6: Commit**

```bash
git add pnpm-lock.yaml
git commit -m "chore: update lockfile after web app setup"
```

---

## Task 13: Final Push

**Step 1: Push to remote**

```bash
git push origin main
```

---

## Summary

After completing these tasks, you will have a working MVP with:

1. **Web app** (`apps/web`) with:
   - Vite + React 18 + TypeScript
   - Tailwind CSS for styling
   - React Query for server state
   - Zustand for filter state
   - ECharts for visualization

2. **Components**:
   - `Header` - Project name, connection status
   - `FilterBar` - Date range and select filters
   - `ChartContainer` - Loading, error, cache states
   - `ChartView` - Full chart with filters and data
   - `LineChart` - ECharts line chart implementation

3. **Features**:
   - Independent chart data fetching
   - Filter changes trigger re-fetch
   - Cache indicators
   - Refresh button
   - Loading skeletons
   - Error states

4. **Development experience**:
   - Hot reload for both server and web
   - Vite proxy to API server
   - TypeScript throughout

**To run the full MVP:**

```bash
# Terminal 1: Start API server
cd examples && DASHBOOK_PROJECT_DIR=. pnpm --filter @dashbook/server dev

# Terminal 2: Start web app
pnpm --filter @dashbook/web dev

# Open http://localhost:3000
```
