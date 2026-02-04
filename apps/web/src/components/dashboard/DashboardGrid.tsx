import { useMemo, useCallback, useRef, useEffect } from 'react';
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

// Generate a stable ID for a widget based on its content (NOT position)
function getWidgetId(widget: DashboardWidget): string {
  if (widget.type === 'chart' && widget.ref) {
    return `chart-${widget.ref}`;
  }
  if (widget.type === 'text') {
    // Use content-based ID only - no index since that changes with position
    const contentSlug = (widget.content || 'empty')
      .slice(0, 50)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_');
    return `text-${contentSlug}`;
  }
  return `widget-unknown`;
}

export function DashboardGrid({ layout, onLayoutChange }: DashboardGridProps) {
  const { isEditing, setPendingLayout, setOriginalLayout, currentLayout, removeWidget, updateWidget } = useEditMode();
  const lastLayoutRef = useRef<string>('');

  // Set the original layout when layout prop changes (compare by JSON to avoid infinite loops)
  useEffect(() => {
    const layoutJson = JSON.stringify(layout);
    if (layoutJson !== lastLayoutRef.current) {
      lastLayoutRef.current = layoutJson;
      setOriginalLayout(layout);
    }
  }, [layout, setOriginalLayout]);

  // Use currentLayout from context (which includes any pending changes) or fall back to prop
  const effectiveLayout = currentLayout || layout;

  // Convert dashboard layout to react-grid-layout format using stable IDs
  const { gridLayout, widgetMap, widgetList } = useMemo(() => {
    const items: LayoutItem[] = [];
    const idToWidget: Map<string, { widget: DashboardWidget; rowIndex: number; widgetIndex: number }> = new Map();
    const allWidgets: Array<{ id: string; widget: DashboardWidget; rowIndex: number; widgetIndex: number }> = [];

    let yOffset = 0;

    effectiveLayout.rows.forEach((row, rowIndex) => {
      let xOffset = 0;
      row.widgets.forEach((widget, widgetIndex) => {
        const id = getWidgetId(widget);
        const item: LayoutItem = {
          i: id,
          x: xOffset,
          y: yOffset,
          w: widget.cols,
          h: Math.ceil(row.height / 50),
          minW: widget.type === 'chart' ? 3 : 2,
          minH: 2,
          static: !isEditing,
        };
        items.push(item);
        idToWidget.set(id, { widget, rowIndex, widgetIndex });
        allWidgets.push({ id, widget, rowIndex, widgetIndex });
        xOffset += widget.cols;
      });
      yOffset += Math.ceil(row.height / 50);
    });

    return { gridLayout: items, widgetMap: idToWidget, widgetList: allWidgets };
  }, [effectiveLayout, isEditing]);

  const handleLayoutChange = useCallback(
    (newGridLayout: LayoutItem[]) => {
      if (!isEditing) {
        return;
      }

      // Filter to only items we know about and sort by position
      const knownItems = newGridLayout.filter(item => widgetMap.has(item.i));
      const sorted = [...knownItems].sort((a, b) => a.y - b.y || a.x - b.x);

      // Group by y position to form rows
      const rows: { height: number; widgets: DashboardWidget[] }[] = [];
      let currentY = -1;
      let currentRow: DashboardWidget[] = [];
      let currentH = 0;

      sorted.forEach((item) => {
        const widgetData = widgetMap.get(item.i);
        if (!widgetData) {
          return;
        }

        // Check if we need to start a new row (different y position)
        if (currentY === -1 || item.y >= currentY + currentH) {
          if (currentRow.length > 0) {
            rows.push({ height: currentH * 50, widgets: [...currentRow] });
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
        rows.push({ height: currentH * 50, widgets: [...currentRow] });
      }

      const newLayout: DashboardLayout = {
        gap: effectiveLayout.gap,
        rows,
      };

      setPendingLayout(newLayout);
      onLayoutChange?.(newLayout);
    },
    [isEditing, widgetMap, effectiveLayout.gap, setPendingLayout, onLayoutChange]
  );

  const handleRemoveWidget = useCallback((rowIndex: number, widgetIndex: number) => {
    removeWidget(rowIndex, widgetIndex);
  }, [removeWidget]);

  const handleUpdateTextContent = useCallback((rowIndex: number, widgetIndex: number, content: string) => {
    updateWidget(rowIndex, widgetIndex, { content });
  }, [updateWidget]);

  return (
    <>
      {!isEditing && (
        <style>{`.react-resizable-handle { display: none !important; }`}</style>
      )}
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
        margin={[effectiveLayout.gap ?? 16, effectiveLayout.gap ?? 16] as [number, number]}
        compactType={null}
        preventCollision={true}
        autoSize={true}
      >
        {widgetList.map(({ id, widget, rowIndex, widgetIndex }) => (
          <div key={id} className="h-full">
            <WidgetWrapper onRemove={() => handleRemoveWidget(rowIndex, widgetIndex)}>
              {widget.type === 'chart' && widget.ref && (
                <ChartWidget chartRef={widget.ref} />
              )}
              {widget.type === 'text' && widget.content && (
                <TextWidget
                  content={widget.content}
                  onUpdate={(content) => handleUpdateTextContent(rowIndex, widgetIndex, content)}
                />
              )}
            </WidgetWrapper>
          </div>
        ))}
      </GridLayout>
    </>
  );
}
