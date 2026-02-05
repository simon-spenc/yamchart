import type { EChartsOption } from 'echarts';
import { forwardRef } from 'react';
import { EChart } from './EChart';
import type { EChartHandle } from './EChart';
import type { AxisConfig } from '../../api/types';
import { format, parseISO } from 'date-fns';

interface BarChartProps {
  data: Array<Record<string, unknown>>;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  height?: number | string;
  loading?: boolean;
  horizontal?: boolean;
}

function strftimeToDateFns(strftimeFormat: string): string {
  return strftimeFormat
    .replace(/%Y/g, 'yyyy')
    .replace(/%y/g, 'yy')
    .replace(/%m/g, 'MM')
    .replace(/%b/g, 'MMM')
    .replace(/%B/g, 'MMMM')
    .replace(/%d/g, 'dd')
    .replace(/%H/g, 'HH')
    .replace(/%I/g, 'hh')
    .replace(/%M/g, 'mm')
    .replace(/%S/g, 'ss')
    .replace(/%p/g, 'a')
    .replace(/%P/g, 'a');
}

function formatQuarter(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  const year = date.getFullYear().toString().slice(-2);
  return `Q${quarter} '${year}`;
}

export const BarChart = forwardRef<EChartHandle, BarChartProps>(function BarChart(
  { data, xAxis, yAxis, height = 400, loading = false, horizontal = false },
  ref
) {
  const xValues = data.map((row) => {
    const value = row[xAxis.field];
    if (xAxis.type === 'temporal' && typeof value === 'string') {
      try {
        const date = parseISO(value);
        if (xAxis.format === 'quarter') {
          return formatQuarter(date);
        }
        const dateFormat = xAxis.format
          ? strftimeToDateFns(xAxis.format)
          : 'MMM yyyy';
        return format(date, dateFormat);
      } catch {
        return String(value ?? '');
      }
    }
    return String(value ?? '');
  });
  const yValues = data.map((row) => {
    const value = row[yAxis.field];
    return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
  });

  const formatValue = (value: number): string => {
    if (yAxis.format) {
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
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const p = params as Array<{ name: string; value: number; marker: string }>;
        if (!Array.isArray(p) || p.length === 0) return '';
        const point = p[0]!;
        return `
          <div style="padding: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${point.name}</div>
            <div>${point.marker} ${yAxis.label || yAxis.field}: ${formatValue(point.value)}</div>
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
    xAxis: horizontal
      ? {
          type: 'value',
          axisLabel: {
            color: '#6B7280',
            fontSize: 12,
            formatter: (value: number) => formatValue(value),
          },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#E5E7EB', type: 'dashed' } },
        }
      : {
          type: 'category',
          data: xValues,
          name: xAxis.label,
          nameLocation: 'middle',
          nameGap: 30,
          nameTextStyle: { color: '#6B7280', fontSize: 12 },
          axisLabel: { color: '#6B7280', fontSize: 12 },
          axisLine: { lineStyle: { color: '#E5E7EB' } },
          axisTick: { show: false },
        },
    yAxis: horizontal
      ? {
          type: 'category',
          data: xValues,
          axisLabel: { color: '#6B7280', fontSize: 12 },
          axisLine: { show: false },
          axisTick: { show: false },
        }
      : {
          type: 'value',
          name: yAxis.label,
          nameLocation: 'middle',
          nameGap: 80,
          nameTextStyle: { color: '#6B7280', fontSize: 12 },
          axisLabel: {
            color: '#6B7280',
            fontSize: 12,
            formatter: (value: number) => formatValue(value),
          },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#E5E7EB', type: 'dashed' } },
        },
    series: [
      {
        type: 'bar',
        data: yValues,
        barWidth: '60%',
        itemStyle: {
          color: '#3B82F6',
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: {
            color: '#2563EB',
          },
        },
      },
    ],
    animation: true,
    animationDuration: 300,
  };

  return <EChart ref={ref} option={option} height={height} loading={loading} />;
});
