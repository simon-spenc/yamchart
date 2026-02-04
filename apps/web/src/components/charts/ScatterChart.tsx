import type { EChartsOption } from 'echarts';
import { EChart } from './EChart';
import type { AxisConfig } from '../../api/types';

interface ScatterChartProps {
  data: Array<Record<string, unknown>>;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  height?: number | string;
  loading?: boolean;
}

export function ScatterChart({
  data,
  xAxis,
  yAxis,
  height = 400,
  loading = false,
}: ScatterChartProps) {
  const scatterData = data.map((row) => {
    const xVal = row[xAxis.field];
    const yVal = row[yAxis.field];
    return [
      typeof xVal === 'number' ? xVal : parseFloat(String(xVal)) || 0,
      typeof yVal === 'number' ? yVal : parseFloat(String(yVal)) || 0,
    ];
  });

  const formatValue = (value: number, axis: AxisConfig): string => {
    if (axis.format) {
      if (axis.format.includes('$')) {
        return `$${value.toLocaleString()}`;
      }
      if (axis.format.includes('%')) {
        return `${value.toFixed(1)}%`;
      }
    }
    return value.toLocaleString();
  };

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { value: [number, number]; marker: string };
        return `
          <div style="padding: 8px;">
            <div>${p.marker} ${xAxis.label || xAxis.field}: ${formatValue(p.value[0], xAxis)}</div>
            <div>${p.marker} ${yAxis.label || yAxis.field}: ${formatValue(p.value[1], yAxis)}</div>
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
      type: 'value',
      name: xAxis.label,
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: '#6B7280', fontSize: 12 },
      axisLabel: {
        color: '#6B7280',
        fontSize: 12,
        formatter: (value: number) => formatValue(value, xAxis),
      },
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      splitLine: { lineStyle: { color: '#E5E7EB', type: 'dashed' } },
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
        formatter: (value: number) => formatValue(value, yAxis),
      },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#E5E7EB', type: 'dashed' } },
    },
    series: [
      {
        type: 'scatter',
        data: scatterData,
        symbolSize: 10,
        itemStyle: {
          color: '#8B5CF6',
        },
        emphasis: {
          itemStyle: {
            color: '#7C3AED',
            shadowBlur: 10,
            shadowColor: 'rgba(139, 92, 246, 0.5)',
          },
        },
      },
    ],
    animation: true,
    animationDuration: 300,
  };

  return <EChart option={option} height={height} loading={loading} />;
}
