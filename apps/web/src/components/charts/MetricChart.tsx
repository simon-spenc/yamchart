import type { AxisConfig } from '../../api/types';

interface MetricChartProps {
  data: Array<Record<string, unknown>>;
  yAxis: AxisConfig;
  height?: number | string;
  loading?: boolean;
  title?: string;
}

function formatValue(value: number, format?: string): string {
  if (format?.includes('$')) {
    return `$${value.toLocaleString()}`;
  }
  if (format?.includes('%')) {
    return `${value.toFixed(1)}%`;
  }

  // Abbreviate large numbers
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toLocaleString();
}

export function MetricChart({
  data,
  yAxis,
  loading = false,
  title,
}: MetricChartProps) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 h-16 w-32 rounded" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No data
      </div>
    );
  }

  const row = data[0];
  const rawValue = row?.[yAxis.field];
  const value = typeof rawValue === 'number'
    ? rawValue
    : parseFloat(String(rawValue)) || 0;

  const formattedValue = formatValue(value, yAxis.format);
  const label = yAxis.label || yAxis.field;

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="text-4xl font-bold text-gray-900 tabular-nums">
        {formattedValue}
      </div>
      {(title || label) && (
        <div className="text-sm text-gray-500 mt-2 text-center">
          {title || label}
        </div>
      )}
    </div>
  );
}
