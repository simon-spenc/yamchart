import { createContext, useContext, useState, ReactNode } from 'react';
import type { DashboardLayout } from '../../api/types';

interface EditModeContextValue {
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  pendingLayout: DashboardLayout | null;
  setPendingLayout: (layout: DashboardLayout | null) => void;
  hasChanges: boolean;
}

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const [pendingLayout, setPendingLayout] = useState<DashboardLayout | null>(null);

  const hasChanges = pendingLayout !== null;

  return (
    <EditModeContext.Provider
      value={{
        isEditing,
        setIsEditing,
        pendingLayout,
        setPendingLayout,
        hasChanges,
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
