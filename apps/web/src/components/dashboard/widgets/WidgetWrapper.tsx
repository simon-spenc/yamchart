import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { useEditMode } from '../EditModeContext';

interface WidgetWrapperProps {
  children: ReactNode;
}

export function WidgetWrapper({ children }: WidgetWrapperProps) {
  const { isEditing } = useEditMode();

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden relative',
        isEditing && 'ring-2 ring-blue-200'
      )}
    >
      {isEditing && (
        <div className="absolute top-2 left-2 z-10">
          <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center cursor-grab active:cursor-grabbing">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
