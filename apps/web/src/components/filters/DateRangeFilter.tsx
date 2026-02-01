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
