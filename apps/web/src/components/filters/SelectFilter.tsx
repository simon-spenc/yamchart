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
