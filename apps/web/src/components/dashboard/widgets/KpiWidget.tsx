import { clsx } from 'clsx';
import { useChartData } from '../../../hooks/useChartData';
import { useChart, useRefreshChart } from '../../../hooks';
import { ChartActions } from '../../charts';
import { exportToCSV } from '../../../utils/export';

interface KpiWidgetProps {
  chartRef: string;
}

function formatValue(
  value: number,
  format?: { type: string; currency?: string; decimals?: number }
): string {
  if (!format) return value.toLocaleString();

  const decimals = format.decimals ?? 0;

  switch (format.type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: format.currency || 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    case 'percent':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value / 100);
    default:
      return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  }
}

function formatChange(value: number, type: 'percent_change' | 'absolute'): string {
  const prefix = value >= 0 ? '+' : '';
  if (type === 'percent_change') {
    return `${prefix}${value.toFixed(1)}%`;
  }
  return `${prefix}${value.toLocaleString()}`;
}

export function KpiWidget({ chartRef }: KpiWidgetProps) {
  const { data: chartConfig } = useChart(chartRef);
  const { data, isLoading, error, isFetching } = useChartData(chartRef);
  const refreshChart = useRefreshChart();

  const handleRefresh = () => {
    refreshChart(chartRef);
  };

  const handleExportCSV = () => {
    if (!data || !chartConfig) return;
    const filename = chartConfig.name || chartRef;
    exportToCSV(data.rows, data.columns, filename);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 h-12 w-24 rounded" />
      </div>
    );
  }

  if (error || !data?.rows?.[0]) {
    return (
      <div className="h-full flex items-center justify-center text-red-500 text-sm">
        Failed to load
      </div>
    );
  }

  const row = data.rows[0];
  const config = chartConfig?.chart;

  if (!config?.value?.field) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Invalid KPI config
      </div>
    );
  }

  const value = row[config.value.field] as number;
  const formattedValue = formatValue(value, config.format);

  let change: number | null = null;
  let changeType: 'percent_change' | 'absolute' = 'percent_change';

  if (config.comparison?.enabled && config.comparison.field) {
    const previousValue = row[config.comparison.field] as number;
    changeType = config.comparison.type;

    if (previousValue && previousValue !== 0) {
      if (changeType === 'percent_change') {
        change = ((value - previousValue) / previousValue) * 100;
      } else {
        change = value - previousValue;
      }
    }
  }

  return (
    <div className="h-full flex flex-col p-4 group relative">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChartActions
          onRefresh={handleRefresh}
          onExportCSV={handleExportCSV}
          onExportPNG={handleExportCSV}
          onExportSVG={handleExportCSV}
          isRefreshing={isFetching}
          hideImageExport
        />
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-3xl font-bold text-gray-900">{formattedValue}</div>
        <div className="text-sm text-gray-500 mt-1">{chartConfig?.title}</div>
        {change !== null && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className={clsx(
                'text-sm font-medium px-2 py-0.5 rounded',
                change >= 0
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              )}
            >
              {formatChange(change, changeType)}
            </span>
            {config.comparison?.label && (
              <span className="text-xs text-gray-400">{config.comparison.label}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
