import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useRef, useEffect } from 'react';

interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  loading?: boolean;
  onEvents?: Record<string, (params: unknown) => void>;
}

export function EChart({
  option,
  height = 400,
  loading = false,
  onEvents,
}: EChartProps) {
  const chartRef = useRef<ReactECharts>(null);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      chartRef.current?.getEchartsInstance()?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height, width: '100%' }}
      showLoading={loading}
      onEvents={onEvents}
      opts={{ renderer: 'svg' }}
    />
  );
}
