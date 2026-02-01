import type { EChartsOption } from 'echarts';
import { EChart } from './EChart';
import type { Column, AxisConfig } from '../../api/types';
import { format, parseISO } from 'date-fns';

interface LineChartProps {
  data: Array<Record<string, unknown>>;
  columns: Column[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  height?: number;
  loading?: boolean;
}

export function LineChart({
  data,
  xAxis,
  yAxis,
  height = 400,
  loading = false,
}: LineChartProps) {
  // Extract x and y values
  const xValues = data.map((row) => {
    const value = row[xAxis.field];
    if (xAxis.type === 'temporal' && typeof value === 'string') {
      try {
        const date = parseISO(value);
        return format(date, xAxis.format || 'MMM yyyy');
      } catch {
        return value;
      }
    }
    return value;
  });

  const yValues = data.map((row) => {
    const value = row[yAxis.field];
    return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
  });

  // Format y-axis values
  const formatYValue = (value: number): string => {
    if (yAxis.format) {
      // Simple format handling for common patterns
      if (yAxis.format.includes('$')) {
        return `$${value.toLocaleString()}`;
      }
      if (yAxis.format.includes('%')) {
        return `${value.toFixed(1)}%`;
      }
    }
    return value.toLocaleString();
  };

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = params as Array<{ name: string; value: number; marker: string }>;
        if (!Array.isArray(p) || p.length === 0) return '';
        const point = p[0]!;
        return `
          <div style="padding: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${point.name}</div>
            <div>${point.marker} ${yAxis.label || yAxis.field}: ${formatYValue(point.value)}</div>
          </div>
        `;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: xValues as string[],
      axisLabel: {
        color: '#6B7280',
        fontSize: 12,
      },
      axisLine: {
        lineStyle: { color: '#E5E7EB' },
      },
      axisTick: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      name: yAxis.label,
      nameLocation: 'middle',
      nameGap: 50,
      nameTextStyle: {
        color: '#6B7280',
        fontSize: 12,
      },
      axisLabel: {
        color: '#6B7280',
        fontSize: 12,
        formatter: (value: number) => formatYValue(value),
      },
      axisLine: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          color: '#E5E7EB',
          type: 'dashed',
        },
      },
    },
    series: [
      {
        type: 'line',
        data: yValues,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 2,
          color: '#3B82F6',
        },
        itemStyle: {
          color: '#3B82F6',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' },
            ],
          },
        },
      },
    ],
    animation: true,
    animationDuration: 300,
  };

  return <EChart option={option} height={height} loading={loading} />;
}
