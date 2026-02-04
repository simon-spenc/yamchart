import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { useEditMode } from '../EditModeContext';

interface WidgetWrapperProps {
  children: ReactNode;
  onRemove?: () => void;
}

export function WidgetWrapper({ children, onRemove }: WidgetWrapperProps) {
  const { isEditing } = useEditMode();

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden relative',
        isEditing && 'ring-2 ring-blue-200'
      )}
    >
      {isEditing && (
        <>
          {/* Drag handle - semi-transparent */}
          <div className="absolute top-1 left-1 z-10">
            <div className="w-5 h-5 bg-white/70 hover:bg-gray-100 rounded flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors">
              <svg
                className="w-3 h-3 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
              </svg>
            </div>
          </div>

          {/* Delete button - semi-transparent */}
          {onRemove && (
            <div className="absolute top-1 right-1 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="w-5 h-5 bg-white/70 hover:bg-red-100 rounded flex items-center justify-center transition-colors"
                title="Remove widget"
              >
                <svg
                  className="w-3 h-3 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
      <div className={clsx('h-full', isEditing && 'pt-6')}>
        {children}
      </div>
    </div>
  );
}
