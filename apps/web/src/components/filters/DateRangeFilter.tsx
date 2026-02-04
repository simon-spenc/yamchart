import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useFilterStore } from '../../stores/filterStore';
import { DatePicker } from './DatePicker';

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
  { value: 'custom', label: 'Custom range...' },
];

export interface CustomDateRange {
  type: 'custom';
  start: string;
  end: string;
}

export type DateRangeValue = string | CustomDateRange;

interface DateRangeFilterProps {
  name: string;
  label?: string;
  chartName?: string;
  defaultValue?: string;
}

function isCustomRange(value: unknown): value is CustomDateRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as CustomDateRange).type === 'custom'
  );
}

function getDisplayValue(value: DateRangeValue): string {
  if (isCustomRange(value)) {
    return `${value.start} to ${value.end}`;
  }
  return DATE_PRESETS.find((p) => p.value === value)?.label || value;
}

export function DateRangeFilter({
  name,
  label,
  chartName,
  defaultValue = 'last_30_days',
}: DateRangeFilterProps) {
  const [showPicker, setShowPicker] = useState(false);
  const globalFilters = useFilterStore((s) => s.globalFilters);
  const chartFilters = useFilterStore((s) => s.chartFilters);
  const setGlobalFilter = useFilterStore((s) => s.setGlobalFilter);
  const setChartFilter = useFilterStore((s) => s.setChartFilter);

  const currentValue: DateRangeValue = chartName
    ? (chartFilters[chartName]?.[name] as DateRangeValue) ??
      (globalFilters[name] as DateRangeValue) ??
      defaultValue
    : (globalFilters[name] as DateRangeValue) ?? defaultValue;

  // Set default value in store on mount if not already set
  useEffect(() => {
    const existingValue = chartName
      ? chartFilters[chartName]?.[name] ?? globalFilters[name]
      : globalFilters[name];

    if (existingValue === undefined && defaultValue) {
      if (chartName) {
        setChartFilter(chartName, name, defaultValue);
      } else {
        setGlobalFilter(name, defaultValue);
      }
    }
  }, [chartName, name, defaultValue, globalFilters, chartFilters, setGlobalFilter, setChartFilter]);

  const handleChange = (value: DateRangeValue) => {
    if (chartName) {
      setChartFilter(chartName, name, value);
    } else {
      setGlobalFilter(name, value);
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'custom') {
      setShowPicker(true);
    } else {
      handleChange(value);
    }
  };

  const handleCustomApply = (start: string, end: string) => {
    handleChange({ type: 'custom', start, end });
    setShowPicker(false);
  };

  const selectValue = isCustomRange(currentValue) ? 'custom' : currentValue;

  return (
    <div className="flex flex-col gap-1 relative">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="relative">
        <select
          value={selectValue}
          onChange={handleSelectChange}
          className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[180px]"
        >
          {DATE_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.value === 'custom' && isCustomRange(currentValue)
                ? getDisplayValue(currentValue)
                : preset.label}
            </option>
          ))}
        </select>
        {showPicker && (
          <DatePicker
            startDate={isCustomRange(currentValue) ? currentValue.start : undefined}
            endDate={isCustomRange(currentValue) ? currentValue.end : undefined}
            onApply={handleCustomApply}
            onCancel={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
