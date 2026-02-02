import { useChart, useChartData, useRefreshChart } from '../hooks';
import { ChartContainer } from './ChartContainer';
import { FilterBar } from './filters';
import { LineChart } from './charts';

interface ChartViewProps {
  chartName: string;
}

export function ChartView({ chartName }: ChartViewProps) {
  const { data: chartDef, isLoading: isLoadingDef } = useChart(chartName);
  const { data: chartData, isLoading: isLoadingData, error } = useChartData(chartName);
  const refresh = useRefreshChart();

  const isLoading = isLoadingDef || isLoadingData;

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

    switch (chartDef.chart.type) {
      case 'line':
        if (!chartDef.chart.x || !chartDef.chart.y) {
          return (
            <div className="h-80 flex items-center justify-center text-gray-500">
              Missing axis configuration
            </div>
          );
        }
        return (
          <LineChart
            data={chartData.rows}
            columns={chartData.columns}
            xAxis={chartDef.chart.x}
            yAxis={chartDef.chart.y}
            loading={isLoadingData}
          />
        );

      // Add more chart types here as they're implemented
      // case 'bar':
      //   return <BarChart ... />;

      default:
        return (
          <div className="h-80 flex items-center justify-center text-gray-500">
            Chart type "{chartDef.chart.type}" not yet implemented
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      {chartDef.parameters.length > 0 && (
        <FilterBar parameters={chartDef.parameters} chartName={chartName} />
      )}

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
