import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { DashboardLayout, DashboardWidget } from '../../api/types';

interface EditModeContextValue {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  pendingLayout: DashboardLayout | null;
  setPendingLayout: (layout: DashboardLayout | null) => void;
  hasChanges: boolean;
  // Widget management
  originalLayout: DashboardLayout | null;
  setOriginalLayout: (layout: DashboardLayout) => void;
  currentLayout: DashboardLayout | null;
  addWidget: (widget: DashboardWidget) => void;
  removeWidget: (rowIndex: number, widgetIndex: number) => void;
  updateWidget: (rowIndex: number, widgetIndex: number, updates: Partial<DashboardWidget>) => void;
}

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const [pendingLayout, setPendingLayout] = useState<DashboardLayout | null>(null);
  const [originalLayout, setOriginalLayout] = useState<DashboardLayout | null>(null);

  const hasChanges = pendingLayout !== null;

  // The current layout is either the pending (modified) layout or the original
  const currentLayout = useMemo(() => pendingLayout || originalLayout, [pendingLayout, originalLayout]);

  const setOriginalLayoutStable = useCallback((layout: DashboardLayout) => {
    setOriginalLayout(layout);
  }, []);

  const addWidget = useCallback((widget: DashboardWidget) => {
    const base = pendingLayout || originalLayout;
    if (!base) return;

    // Determine default size based on widget type
    // KPI charts are 3 cols (fits 4 per row), regular charts are 6 cols
    const isKpi = widget.type === 'chart' && widget.ref?.toLowerCase().includes('kpi');
    const defaultCols = isKpi ? 3 : 6;
    const defaultHeight = 100;

    // Add widget to a new row at the bottom
    const newRow = {
      height: defaultHeight,
      widgets: [{ ...widget, cols: defaultCols }],  // Always use defaultCols, ignore widget.cols
    };

    const newLayout: DashboardLayout = {
      ...base,
      rows: [...base.rows, newRow],
    };

    setPendingLayout(newLayout);
  }, [pendingLayout, originalLayout]);

  const removeWidget = useCallback((rowIndex: number, widgetIndex: number) => {
    const base = pendingLayout || originalLayout;
    if (!base) return;

    const newRows = base.rows.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;

      const newWidgets = row.widgets.filter((_, wIdx) => wIdx !== widgetIndex);
      return { ...row, widgets: newWidgets };
    }).filter(row => row.widgets.length > 0); // Remove empty rows

    const newLayout: DashboardLayout = {
      ...base,
      rows: newRows,
    };

    setPendingLayout(newLayout);
  }, [pendingLayout, originalLayout]);

  const updateWidget = useCallback((rowIndex: number, widgetIndex: number, updates: Partial<DashboardWidget>) => {
    const base = pendingLayout || originalLayout;
    if (!base) return;

    const newRows = base.rows.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;

      const newWidgets = row.widgets.map((widget, wIdx) => {
        if (wIdx !== widgetIndex) return widget;
        return { ...widget, ...updates };
      });
      return { ...row, widgets: newWidgets };
    });

    const newLayout: DashboardLayout = {
      ...base,
      rows: newRows,
    };

    setPendingLayout(newLayout);
  }, [pendingLayout, originalLayout]);

  return (
    <EditModeContext.Provider
      value={{
        isEditing,
        setIsEditing,
        pendingLayout,
        setPendingLayout,
        hasChanges,
        originalLayout,
        setOriginalLayout: setOriginalLayoutStable,
        currentLayout,
        addWidget,
        removeWidget,
        updateWidget,
      }}
    >
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within EditModeProvider');
  }
  return context;
}
