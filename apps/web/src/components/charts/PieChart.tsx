import type { EChartsOption } from 'echarts';
import { EChart } from './EChart';
import type { AxisConfig } from '../../api/types';

interface PieChartProps {
  data: Array<Record<string, unknown>>;
  xAxis: AxisConfig; // Used as category/name field
  yAxis: AxisConfig; // Used as value field
  height?: number | string;
  loading?: boolean;
}

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

export function PieChart({
  data,
  xAxis,
  yAxis,
  height = 400,
  loading = false,
}: PieChartProps) {
  const pieData = data.map((row, index) => {
    const rawValue = row[yAxis.field];
    const value = typeof rawValue === 'number'
      ? rawValue
      : parseFloat(String(rawValue)) || 0;
    return {
      name: String(row[xAxis.field] ?? ''),
      value,
      itemStyle: { color: COLORS[index % COLORS.length] },
    };
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
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number; marker: string };
        return `
          <div style="padding: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${p.name}</div>
            <div>${p.marker} ${yAxis.label || yAxis.field}: ${formatValue(p.value as number)}</div>
            <div style="color: #6B7280; font-size: 12px;">${p.percent.toFixed(1)}%</div>
          </div>
        `;
      },
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#6B7280', fontSize: 12 },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: false,
        },
        data: pieData,
      },
    ],
    animation: true,
    animationDuration: 300,
  };

  return <EChart option={option} height={height} loading={loading} />;
}
