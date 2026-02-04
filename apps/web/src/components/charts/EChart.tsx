import ReactECharts from 'echarts-for-react';
import type { EChartsOption, ECharts } from 'echarts';
import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  loading?: boolean;
  onEvents?: Record<string, (params: unknown) => void>;
}

export interface EChartHandle {
  getDataURL: (type: 'png' | 'svg') => string | undefined;
  getInstance: () => ECharts | undefined;
}

export const EChart = forwardRef<EChartHandle, EChartProps>(function EChart(
  { option, height = 400, loading = false, onEvents },
  ref
) {
  const chartRef = useRef<ReactECharts>(null);

  useImperativeHandle(ref, () => ({
    getDataURL: (type: 'png' | 'svg') => {
      const instance = chartRef.current?.getEchartsInstance();
      if (!instance) return undefined;

      // For PNG, we need to render to canvas first
      // Since we use SVG renderer, we'll use the built-in conversion
      try {
        return instance.getDataURL({
          type: type === 'png' ? 'png' : 'svg',
          pixelRatio: 2,
          backgroundColor: '#fff',
        });
      } catch {
        // Fallback: try getting as SVG and converting if needed
        return instance.getDataURL({
          type: 'svg',
          pixelRatio: 2,
          backgroundColor: '#fff',
        });
      }
    },
    getInstance: () => chartRef.current?.getEchartsInstance(),
  }));

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
      opts={{ renderer: 'canvas' }}
    />
  );
});
