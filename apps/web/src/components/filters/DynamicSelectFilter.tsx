import { useQuery } from '@tanstack/react-query';
import { useFilterStore } from '../../stores/filterStore';
import { api } from '../../api/client';

interface DynamicSelectFilterProps {
  name: string;
  label?: string;
  chartName: string;
  defaultValue?: string;
}

interface ParameterOption {
  value: string;
  label: string;
}

export function DynamicSelectFilter({
  name,
  label,
  chartName,
  defaultValue,
}: DynamicSelectFilterProps) {
  const globalFilters = useFilterStore((s) => s.globalFilters);
  const chartFilters = useFilterStore((s) => s.chartFilters);
  const setGlobalFilter = useFilterStore((s) => s.setGlobalFilter);
  const setChartFilter = useFilterStore((s) => s.setChartFilter);

  const { data, isLoading, error } = useQuery({
    queryKey: ['parameterOptions', chartName, name],
    queryFn: () => api.getParameterOptions(chartName, name),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const currentValue = chartFilters[chartName]?.[name] ?? globalFilters[name] ?? defaultValue;

  const handleChange = (value: string) => {
    setChartFilter(chartName, name, value);
  };

  const options: ParameterOption[] = data?.options ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-gray-700">{label}</label>
        )}
        <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-500 min-w-[120px]">
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-gray-700">{label}</label>
        )}
        <div className="px-3 py-2 bg-red-50 border border-red-300 rounded-md text-sm text-red-600">
          Error loading options
        </div>
      </div>
    );
  }

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
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
