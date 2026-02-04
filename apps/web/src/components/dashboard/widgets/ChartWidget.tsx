import { useRef } from 'react';
import { useChart, useChartData, useRefreshChart } from '../../../hooks';
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
import { exportToCSV, downloadDataURL } from '../../../utils/export';

interface ChartWidgetProps {
  chartRef: string;
}

export function ChartWidget({ chartRef }: ChartWidgetProps) {
  const { data: chartConfig, isLoading: isLoadingConfig } = useChart(chartRef);
  const { data: chartData, isLoading: isLoadingData, isFetching } = useChartData(chartRef);
  const refreshChart = useRefreshChart();
  const echartRef = useRef<EChartHandle>(null);

  const handleRefresh = () => {
    refreshChart(chartRef);
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

  return (
    <div className="h-full p-2 flex flex-col group">
      <div className="flex items-center justify-between mb-2 px-2 flex-shrink-0">
        <div className="text-sm font-medium text-gray-700">
          {chartConfig.title}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ChartActions
            onRefresh={handleRefresh}
            onExportCSV={handleExportCSV}
            onExportPNG={isEChartType ? handleExportPNG : handleExportCSV}
            onExportSVG={isEChartType ? handleExportSVG : handleExportCSV}
            isRefreshing={isFetching}
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {renderChart()}
      </div>
    </div>
  );
}
