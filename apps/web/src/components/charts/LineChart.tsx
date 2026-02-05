import type { EChartsOption } from 'echarts';
import { forwardRef } from 'react';
import { EChart } from './EChart';
import type { EChartHandle } from './EChart';
import type { Column, AxisConfig } from '../../api/types';
import { format, parseISO } from 'date-fns';

interface LineChartProps {
  data: Array<Record<string, unknown>>;
  columns: Column[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  height?: number | string;
  loading?: boolean;
}

// Convert strftime format to date-fns format
function strftimeToDateFns(strftimeFormat: string): string {
  return strftimeFormat
    .replace(/%Y/g, 'yyyy')    // 4-digit year
    .replace(/%y/g, 'yy')      // 2-digit year
    .replace(/%m/g, 'MM')      // Month number
    .replace(/%b/g, 'MMM')     // Abbreviated month
    .replace(/%B/g, 'MMMM')    // Full month
    .replace(/%d/g, 'dd')      // Day of month
    .replace(/%H/g, 'HH')      // Hour 24h
    .replace(/%I/g, 'hh')      // Hour 12h
    .replace(/%M/g, 'mm')      // Minutes
    .replace(/%S/g, 'ss')      // Seconds
    .replace(/%p/g, 'a')       // AM/PM
    .replace(/%P/g, 'a');      // am/pm
}

// Format date as quarter (Q1 '25)
function formatQuarter(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  const year = date.getFullYear().toString().slice(-2);
  return `Q${quarter} '${year}`;
}

export const LineChart = forwardRef<EChartHandle, LineChartProps>(function LineChart(
  { data, xAxis, yAxis, height = 400, loading = false },
  ref
) {
  // Extract x and y values
  const xValues = data.map((row) => {
    const value = row[xAxis.field];
    if (xAxis.type === 'temporal' && typeof value === 'string') {
      try {
        const date = parseISO(value);
        // Special handling for quarter format
        if (xAxis.format === 'quarter') {
          return formatQuarter(date);
        }
        const dateFormat = xAxis.format
          ? strftimeToDateFns(xAxis.format)
          : 'MMM yyyy';
        return format(date, dateFormat);
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
      bottom: '10%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: xValues as string[],
      name: xAxis.label,
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        color: '#6B7280',
        fontSize: 12,
      },
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
      nameGap: 80,
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

  return <EChart ref={ref} option={option} height={height} loading={loading} />;
});
