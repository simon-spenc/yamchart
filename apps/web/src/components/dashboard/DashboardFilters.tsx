import { DateRangeFilter } from '../filters/DateRangeFilter';

interface DashboardFiltersProps {
  filters: string[];
}

export function DashboardFilters({ filters }: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 p-4 mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      {filters.map((filterName) => {
        // For now, we only support date_range as a dashboard-level filter
        if (filterName === 'date_range') {
          return (
            <DateRangeFilter
              key={filterName}
              name={filterName}
              label="Date Range"
              defaultValue="last_30_days"
            />
          );
        }

        // Unknown filter type
        return (
          <div key={filterName} className="text-sm text-gray-500">
            Unknown filter: {filterName}
          </div>
        );
      })}
    </div>
  );
}
