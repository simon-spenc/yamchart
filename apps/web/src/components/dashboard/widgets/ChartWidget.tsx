import { useRef, useState } from 'react';
import { useChart, useChartData, useRefreshChart } from '../../../hooks';
import { useFilterStore } from '../../../stores/filterStore';
import { KpiWidget } from './KpiWidget';
import {
  LineChart,
  BarChart,
  AreaChart,
  PieChart,
  ScatterChart,
  TableChart,
  MetricChart,
  ChartActions,
} from '../../charts';
import type { EChartHandle } from '../../charts';
import { exportToCSV, downloadDataURL, exportChartAsPDF } from '../../../utils/export';
import { FilterBar } from '../../filters';

interface ChartWidgetProps {
  chartRef: string;
}

export function ChartWidget({ chartRef }: ChartWidgetProps) {
  const { data: chartConfig, isLoading: isLoadingConfig } = useChart(chartRef);
  const { data: chartData, isLoading: isLoadingData, isFetching } = useChartData(chartRef);
  const refreshChart = useRefreshChart();
  const echartRef = useRef<EChartHandle>(null);
  const [showFilters, setShowFilters] = useState(false);

  const chartFilters = useFilterStore((s) => s.chartFilters);
  const resetChartFilters = useFilterStore((s) => s.resetChartFilters);

  // Check if this chart has custom filter overrides
  const hasCustomFilters = chartFilters[chartRef] && Object.keys(chartFilters[chartRef]).length > 0;

  const handleRefresh = () => {
    refreshChart(chartRef);
  };

  const handleResetFilters = () => {
    resetChartFilters(chartRef);
    setShowFilters(false);
  };

  const handleExportCSV = () => {
    if (!chartData || !chartConfig) return;
    const filename = chartConfig.name || chartRef;
    exportToCSV(chartData.rows, chartData.columns, filename);
  };

  const handleExportPNG = () => {
    const dataURL = echartRef.current?.getDataURL('png');
    if (dataURL && chartConfig) {
      downloadDataURL(dataURL, `${chartConfig.name || chartRef}.png`);
    }
  };

  const handleExportSVG = () => {
    const dataURL = echartRef.current?.getDataURL('svg');
    if (dataURL && chartConfig) {
      downloadDataURL(dataURL, `${chartConfig.name || chartRef}.svg`);
    }
  };

  const handleExportPDF = async () => {
    const dataURL = echartRef.current?.getDataURL('png');
    if (dataURL && chartConfig) {
      await exportChartAsPDF(dataURL, chartConfig.name || chartRef, chartConfig.title);
    }
  };

  if (isLoadingConfig) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!chartConfig) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        Chart not found: {chartRef}
      </div>
    );
  }

  // Check if this is a KPI chart
  if (chartConfig.chart?.type === 'kpi') {
    return <KpiWidget chartRef={chartRef} />;
  }

  // Regular chart - render in compact mode (no header, fills container)
  if (isLoadingData || !chartData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse bg-gray-100 w-full h-full rounded" />
      </div>
    );
  }

  const isEChartType = ['line', 'bar', 'area', 'pie', 'scatter'].includes(chartConfig.chart.type);

  const renderChart = () => {
    switch (chartConfig.chart.type) {
      case 'line':
        if (!chartConfig.chart.x || !chartConfig.chart.y) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Missing axis configuration
            </div>
          );
        }
        return (
          <LineChart
            ref={echartRef}
            data={chartData.rows}
            columns={chartData.columns}
            xAxis={chartConfig.chart.x}
            yAxis={chartConfig.chart.y}
            height="100%"
            loading={isFetching}
          />
        );

      case 'bar':
        if (!chartConfig.chart.x || !chartConfig.chart.y) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Missing axis configuration
            </div>
          );
        }
        return (
          <BarChart
            ref={echartRef}
            data={chartData.rows}
            xAxis={chartConfig.chart.x}
            yAxis={chartConfig.chart.y}
            height="100%"
            loading={isFetching}
          />
        );

      case 'area':
        if (!chartConfig.chart.x || !chartConfig.chart.y) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Missing axis configuration
            </div>
          );
        }
        return (
          <AreaChart
            ref={echartRef}
            data={chartData.rows}
            xAxis={chartConfig.chart.x}
            yAxis={chartConfig.chart.y}
            height="100%"
            loading={isFetching}
          />
        );

      case 'pie':
        if (!chartConfig.chart.x || !chartConfig.chart.y) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Missing axis configuration
            </div>
          );
        }
        return (
          <PieChart
            ref={echartRef}
            data={chartData.rows}
            xAxis={chartConfig.chart.x}
            yAxis={chartConfig.chart.y}
            height="100%"
            loading={isFetching}
          />
        );

      case 'scatter':
        if (!chartConfig.chart.x || !chartConfig.chart.y) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Missing axis configuration
            </div>
          );
        }
        return (
          <ScatterChart
            ref={echartRef}
            data={chartData.rows}
            xAxis={chartConfig.chart.x}
            yAxis={chartConfig.chart.y}
            height="100%"
            loading={isFetching}
          />
        );

      case 'table':
        return (
          <TableChart
            data={chartData.rows}
            columns={chartData.columns}
            height="100%"
            loading={isFetching}
          />
        );

      case 'metric':
        if (!chartConfig.chart.y) {
          return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Missing value configuration
            </div>
          );
        }
        return (
          <MetricChart
            data={chartData.rows}
            yAxis={chartConfig.chart.y}
            title={chartConfig.title}
            loading={isFetching}
          />
        );

      default:
        return (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            Chart type "{chartConfig.chart.type}" not yet implemented
          </div>
        );
    }
  };

  const hasParameters = chartConfig.parameters && chartConfig.parameters.length > 0;

  return (
    <div className="h-full p-2 flex flex-col group">
      <div className="flex items-center justify-between mb-2 px-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {chartConfig.title}
          </span>
          {hasCustomFilters && (
            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
              Filtered
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasParameters && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded hover:bg-gray-100 ${showFilters ? 'bg-gray-100' : ''}`}
              title={showFilters ? 'Hide filters' : 'Override filters'}
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          )}
          <ChartActions
            onRefresh={handleRefresh}
            onExportCSV={handleExportCSV}
            onExportPNG={isEChartType ? handleExportPNG : handleExportCSV}
            onExportSVG={isEChartType ? handleExportSVG : handleExportCSV}
            onExportPDF={isEChartType ? handleExportPDF : undefined}
            isRefreshing={isFetching}
          />
        </div>
      </div>
      {showFilters && hasParameters && (
        <div className="mb-2 px-2 flex-shrink-0">
          <div className="flex items-end gap-2 flex-wrap">
            <FilterBar parameters={chartConfig.parameters} chartName={chartRef} />
            {hasCustomFilters && (
              <button
                onClick={handleResetFilters}
                className="px-2 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
              >
                Reset to dashboard
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        {renderChart()}
      </div>
    </div>
  );
}
