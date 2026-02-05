import type { EChartsOption } from 'echarts';
import { forwardRef } from 'react';
import { EChart } from './EChart';
import type { EChartHandle } from './EChart';
import type { AxisConfig } from '../../api/types';

interface DonutChartProps {
  data: Array<Record<string, unknown>>;
  xAxis: AxisConfig; // Used as category/name field
  yAxis: AxisConfig; // Used as value field
  centerValue?: {
    field?: string; // Field to display in center, or 'total' for sum
    label?: string; // Label below the value
    format?: string; // Format string ($, %, etc.)
  };
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

export const DonutChart = forwardRef<EChartHandle, DonutChartProps>(function DonutChart(
  { data, xAxis, yAxis, centerValue, height = 400, loading = false },
  ref
) {
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

  // Calculate center value
  let centerDisplayValue: number | null = null;
  if (centerValue) {
    if (centerValue.field === 'total' || !centerValue.field) {
      // Sum all values
      centerDisplayValue = pieData.reduce((sum, item) => sum + item.value, 0);
    } else {
      // Use specific field from first row
      const rawVal = data[0]?.[centerValue.field];
      centerDisplayValue = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || null;
    }
  }

  const formatValue = (value: number, formatStr?: string): string => {
    if (formatStr) {
      if (formatStr.includes('$')) {
        return `$${value.toLocaleString()}`;
      }
      if (formatStr.includes('%')) {
        return `${value.toFixed(1)}%`;
      }
    }
    return value.toLocaleString();
  };

  // Build center label text
  const centerLabelText = centerDisplayValue !== null
    ? centerValue?.label
      ? `{value|${formatValue(centerDisplayValue, centerValue?.format || yAxis.format)}}\n{label|${centerValue.label}}`
      : `{value|${formatValue(centerDisplayValue, centerValue?.format || yAxis.format)}}`
    : '';

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number; marker: string };
        return `
          <div style="padding: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${p.name}</div>
            <div>${p.marker} ${yAxis.label || yAxis.field}: ${formatValue(p.value as number, yAxis.format)}</div>
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
        radius: ['45%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: centerDisplayValue !== null,
          position: 'center',
          formatter: centerLabelText,
          rich: {
            value: {
              fontSize: 22,
              fontWeight: 'bold' as const,
              color: '#1F2937',
              lineHeight: 30,
            },
            label: {
              fontSize: 12,
              color: '#6B7280',
              lineHeight: 20,
            },
          },
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
          scaleSize: 5,
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

  return <EChart ref={ref} option={option} height={height} loading={loading} />;
});
