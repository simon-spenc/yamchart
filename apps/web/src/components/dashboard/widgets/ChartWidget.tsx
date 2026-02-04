import { useChart, useChartData } from '../../../hooks';
import { KpiWidget } from './KpiWidget';
import { LineChart, BarChart, AreaChart, PieChart, ScatterChart, TableChart, MetricChart } from '../../charts';

interface ChartWidgetProps {
  chartRef: string;
}

export function ChartWidget({ chartRef }: ChartWidgetProps) {
  const { data: chartConfig, isLoading: isLoadingConfig } = useChart(chartRef);
  const { data: chartData, isLoading: isLoadingData } = useChartData(chartRef);

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

  // Render based on chart type
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
        <div className="h-full p-2 flex flex-col">
          <div className="text-sm font-medium text-gray-700 mb-2 px-2 flex-shrink-0">
            {chartConfig.title}
          </div>
          <div className="flex-1 min-h-0">
            <LineChart
              data={chartData.rows}
              columns={chartData.columns}
              xAxis={chartConfig.chart.x}
              yAxis={chartConfig.chart.y}
              height="100%"
              loading={isLoadingData}
            />
          </div>
        </div>
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
        <div className="h-full p-2 flex flex-col">
          <div className="text-sm font-medium text-gray-700 mb-2 px-2 flex-shrink-0">
            {chartConfig.title}
          </div>
          <div className="flex-1 min-h-0">
            <BarChart
              data={chartData.rows}
              xAxis={chartConfig.chart.x}
              yAxis={chartConfig.chart.y}
              height="100%"
              loading={isLoadingData}
            />
          </div>
        </div>
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
        <div className="h-full p-2 flex flex-col">
          <div className="text-sm font-medium text-gray-700 mb-2 px-2 flex-shrink-0">
            {chartConfig.title}
          </div>
          <div className="flex-1 min-h-0">
            <AreaChart
              data={chartData.rows}
              xAxis={chartConfig.chart.x}
              yAxis={chartConfig.chart.y}
              height="100%"
              loading={isLoadingData}
            />
          </div>
        </div>
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
        <div className="h-full p-2 flex flex-col">
          <div className="text-sm font-medium text-gray-700 mb-2 px-2 flex-shrink-0">
            {chartConfig.title}
          </div>
          <div className="flex-1 min-h-0">
            <PieChart
              data={chartData.rows}
              xAxis={chartConfig.chart.x}
              yAxis={chartConfig.chart.y}
              height="100%"
              loading={isLoadingData}
            />
          </div>
        </div>
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
        <div className="h-full p-2 flex flex-col">
          <div className="text-sm font-medium text-gray-700 mb-2 px-2 flex-shrink-0">
            {chartConfig.title}
          </div>
          <div className="flex-1 min-h-0">
            <ScatterChart
              data={chartData.rows}
              xAxis={chartConfig.chart.x}
              yAxis={chartConfig.chart.y}
              height="100%"
              loading={isLoadingData}
            />
          </div>
        </div>
      );

    case 'table':
      return (
        <div className="h-full p-2 flex flex-col">
          <div className="text-sm font-medium text-gray-700 mb-2 px-2 flex-shrink-0">
            {chartConfig.title}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <TableChart
              data={chartData.rows}
              columns={chartData.columns}
              height="100%"
              loading={isLoadingData}
            />
          </div>
        </div>
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
          loading={isLoadingData}
        />
      );

    default:
      return (
        <div className="h-full flex items-center justify-center text-gray-500 text-sm">
          Chart type "{chartConfig.chart.type}" not yet implemented
        </div>
      );
  }
}
