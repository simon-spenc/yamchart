import { useMemo, useCallback } from 'react';
import GridLayout, { type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { DashboardLayout, DashboardWidget } from '../../api/types';
import { useEditMode } from './EditModeContext';
import { ChartWidget, TextWidget, WidgetWrapper } from './widgets';

interface DashboardGridProps {
  layout: DashboardLayout;
  onLayoutChange?: (layout: DashboardLayout) => void;
}

export function DashboardGrid({ layout, onLayoutChange }: DashboardGridProps) {
  const { isEditing, setPendingLayout } = useEditMode();

  // Convert dashboard layout to react-grid-layout format
  const { gridLayout, widgets } = useMemo(() => {
    const items: LayoutItem[] = [];
    const widgetMap: Map<string, { widget: DashboardWidget; rowIndex: number }> = new Map();

    let yOffset = 0;
    layout.rows.forEach((row, rowIndex) => {
      let xOffset = 0;
      row.widgets.forEach((widget, widgetIndex) => {
        const key = `${rowIndex}-${widgetIndex}`;
        items.push({
          i: key,
          x: xOffset,
          y: yOffset,
          w: widget.cols,
          h: Math.ceil(row.height / 50),
          minW: widget.type === 'chart' ? 3 : 2,
          minH: 2,
        });
        widgetMap.set(key, { widget, rowIndex });
        xOffset += widget.cols;
      });
      yOffset += Math.ceil(row.height / 50);
    });

    return { gridLayout: items, widgets: widgetMap };
  }, [layout]);

  const handleLayoutChange = useCallback(
    (newGridLayout: LayoutItem[]) => {
      if (!isEditing) return;

      // Convert grid layout back to dashboard layout format
      // Group by y position to form rows
      const sorted = [...newGridLayout].sort((a, b) => a.y - b.y || a.x - b.x);

      const rows: { height: number; widgets: DashboardWidget[] }[] = [];
      let currentY = -1;
      let currentRow: DashboardWidget[] = [];
      let currentH = 0;

      sorted.forEach((item) => {
        const widgetData = widgets.get(item.i);
        if (!widgetData) return;

        if (item.y !== currentY) {
          if (currentRow.length > 0) {
            rows.push({ height: currentH * 50, widgets: currentRow });
          }
          currentRow = [];
          currentY = item.y;
          currentH = item.h;
        }

        currentRow.push({
          ...widgetData.widget,
          cols: item.w,
        });
        currentH = Math.max(currentH, item.h);
      });

      if (currentRow.length > 0) {
        rows.push({ height: currentH * 50, widgets: currentRow });
      }

      const newLayout: DashboardLayout = {
        gap: layout.gap,
        rows,
      };

      setPendingLayout(newLayout);
      onLayoutChange?.(newLayout);
    },
    [isEditing, widgets, layout.gap, setPendingLayout, onLayoutChange]
  );

  return (
    <GridLayout
      className="layout"
      layout={gridLayout}
      cols={12}
      rowHeight={50}
      width={1200}
      isDraggable={isEditing}
      isResizable={isEditing}
      onLayoutChange={(newLayout: unknown) => handleLayoutChange(newLayout as LayoutItem[])}
      draggableHandle=".cursor-grab"
      margin={[layout.gap ?? 16, layout.gap ?? 16] as [number, number]}
    >
      {Array.from(widgets.entries()).map(([key, { widget }]) => (
        <div key={key}>
          <WidgetWrapper>
            {widget.type === 'chart' && widget.ref && (
              <ChartWidget chartRef={widget.ref} />
            )}
            {widget.type === 'text' && widget.content && (
              <TextWidget content={widget.content} />
            )}
          </WidgetWrapper>
        </div>
      ))}
    </GridLayout>
  );
}
