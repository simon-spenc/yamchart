import type { EChartsOption } from 'echarts';
import { EChart } from './EChart';
import type { AxisConfig } from '../../api/types';
import { format, parseISO } from 'date-fns';

interface AreaChartProps {
  data: Array<Record<string, unknown>>;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  height?: number | string;
  loading?: boolean;
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

export function AreaChart({
  data,
  xAxis,
  yAxis,
  height = 400,
  loading = false,
}: AreaChartProps) {
  const xValues = data.map((row) => {
    const value = row[xAxis.field];
    if (xAxis.type === 'temporal' && typeof value === 'string') {
      try {
        const date = parseISO(value);
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
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: xValues as string[],
      boundaryGap: false,
      axisLabel: { color: '#6B7280', fontSize: 12 },
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: yAxis.label,
      nameLocation: 'middle',
      nameGap: 50,
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
        type: 'line',
        data: yValues,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 2,
          color: '#10B981',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.05)' },
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
