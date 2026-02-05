import { useState } from 'react';
import { useChart, useChartData, useRefreshChart } from '../hooks';
import { ChartContainer } from './ChartContainer';
import { FilterBar } from './filters';
import { LineChart, BarChart, AreaChart, PieChart, DonutChart } from './charts';
import { useFilterStore } from '../stores/filterStore';
import { clsx } from 'clsx';

// Map granularity value to display label and format
const granularityConfig: Record<string, { label: string; format: string }> = {
  day: { label: 'Date', format: '%b %d, %Y' },        // Feb 03, 2025
  week: { label: 'Week Starting', format: '%b %d' },  // Feb 03
  month: { label: 'Month', format: "%b '%y" },        // Feb '25
  quarter: { label: 'Quarter', format: 'quarter' },   // Q1 '25 (special handling)
  year: { label: 'Year', format: '%Y' },              // 2025
};

// Copy to clipboard helper
function CopyReferenceButton({ chartName }: { chartName: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const reference = `{{${chartName}}}`;
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
      title={`Copy {{${chartName}}} for use in markdown widgets`}
    >
      {copied ? (
        <>
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-600">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Copy Reference</span>
        </>
      )}
    </button>
  );
}

// KPI value formatting
function formatKpiValue(
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

// KPI Display component for standalone chart view
interface KpiDisplayProps {
  data: Array<Record<string, unknown>>;
  config: {
    type: string;
    value?: { field: string };
    format?: { type: string; currency?: string; decimals?: number };
    comparison?: {
      enabled: boolean;
      field?: string;
      label?: string;
      type: 'percent_change' | 'absolute';
    };
  };
  title?: string;
}

function KpiDisplay({ data, config, title }: KpiDisplayProps) {
  if (!data?.[0] || !config.value?.field) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400">
        No data available
      </div>
    );
  }

  const row = data[0];
  const value = row[config.value.field] as number;
  const formattedValue = formatKpiValue(value, config.format);

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
    <div className="h-80 flex flex-col items-center justify-center p-8">
      <div className="text-6xl font-bold text-gray-900 tabular-nums">{formattedValue}</div>
      {title && <div className="text-lg text-gray-500 mt-3">{title}</div>}
      {change !== null && (
        <div className="mt-4 flex items-center gap-3">
          <span
            className={clsx(
              'text-lg font-medium px-3 py-1 rounded',
              change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}
          >
            {formatChange(change, changeType)}
          </span>
          {config.comparison?.label && (
            <span className="text-sm text-gray-400">{config.comparison.label}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface ChartViewProps {
  chartName: string;
}

export function ChartView({ chartName }: ChartViewProps) {
  const { data: chartDef, isLoading: isLoadingDef } = useChart(chartName);
  const { data: chartData, isLoading: isLoadingData, error } = useChartData(chartName);
  const refresh = useRefreshChart();
  const getEffectiveFilters = useFilterStore((state) => state.getEffectiveFilters);

  const isLoading = isLoadingDef || isLoadingData;

  // Get dynamic x-axis config from granularity filter if present
  const filters = getEffectiveFilters(chartName);
  const granularity = filters.granularity as string | undefined;
  const granularitySettings = granularity ? granularityConfig[granularity] : undefined;
  const dynamicXLabel = granularitySettings?.label;
  const dynamicXFormat = granularitySettings?.format;

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

    const chartType = chartDef.chart.type;

    switch (chartType) {
      case 'line':
        if (!chartDef.chart.x || !chartDef.chart.y) {
          return (
            <div className="h-80 flex items-center justify-center text-gray-500">
              Missing axis configuration
            </div>
          );
        }
        {
          const xAxisConfig = granularitySettings
            ? { ...chartDef.chart.x, label: dynamicXLabel, format: dynamicXFormat }
            : chartDef.chart.x;
          return (
            <LineChart
              data={chartData.rows}
              columns={chartData.columns}
              xAxis={xAxisConfig}
              yAxis={chartDef.chart.y}
              loading={isLoadingData}
            />
          );
        }

      case 'bar':
        if (!chartDef.chart.x || !chartDef.chart.y) {
          return (
            <div className="h-80 flex items-center justify-center text-gray-500">
              Missing axis configuration
            </div>
          );
        }
        {
          const xAxisConfig = granularitySettings
            ? { ...chartDef.chart.x, label: dynamicXLabel, format: dynamicXFormat }
            : chartDef.chart.x;
          return (
            <BarChart
              data={chartData.rows}
              xAxis={xAxisConfig}
              yAxis={chartDef.chart.y}
              loading={isLoadingData}
            />
          );
        }

      case 'area':
        if (!chartDef.chart.x || !chartDef.chart.y) {
          return (
            <div className="h-80 flex items-center justify-center text-gray-500">
              Missing axis configuration
            </div>
          );
        }
        {
          const xAxisConfig = granularitySettings
            ? { ...chartDef.chart.x, label: dynamicXLabel, format: dynamicXFormat }
            : chartDef.chart.x;
          return (
            <AreaChart
              data={chartData.rows}
              xAxis={xAxisConfig}
              yAxis={chartDef.chart.y}
              loading={isLoadingData}
            />
          );
        }

      case 'pie':
        if (!chartDef.chart.x || !chartDef.chart.y) {
          return (
            <div className="h-80 flex items-center justify-center text-gray-500">
              Missing pie chart configuration
            </div>
          );
        }
        return (
          <PieChart
            data={chartData.rows}
            xAxis={chartDef.chart.x}
            yAxis={chartDef.chart.y}
            loading={isLoadingData}
          />
        );

      case 'donut':
        if (!chartDef.chart.x || !chartDef.chart.y) {
          return (
            <div className="h-80 flex items-center justify-center text-gray-500">
              Missing donut chart configuration
            </div>
          );
        }
        return (
          <DonutChart
            data={chartData.rows}
            xAxis={chartDef.chart.x}
            yAxis={chartDef.chart.y}
            centerValue={chartDef.chart.centerValue}
            loading={isLoadingData}
          />
        );

      case 'kpi':
        return <KpiDisplay data={chartData.rows} config={chartDef.chart} title={chartDef.title} />;

      default:
        return (
          <div className="h-80 flex items-center justify-center text-gray-500">
            Chart type "{chartType}" not yet implemented
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar with Filters and Copy Reference */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* Filters */}
        {chartDef.parameters.length > 0 ? (
          <FilterBar parameters={chartDef.parameters} chartName={chartName} />
        ) : (
          <div />
        )}

        {/* Copy Reference Button */}
        <CopyReferenceButton chartName={chartName} />
      </div>

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
