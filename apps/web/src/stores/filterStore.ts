import { create } from 'zustand';

export interface CustomDateRange {
  type: 'custom';
  start: string;
  end: string;
}

export type FilterValue = string | number | boolean | string[] | CustomDateRange | null;

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
