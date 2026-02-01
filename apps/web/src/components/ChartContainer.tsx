import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface ChartContainerProps {
  title: string;
  description?: string;
  loading?: boolean;
  error?: Error | null;
  cached?: boolean;
  durationMs?: number;
  onRefresh?: () => void;
  children: ReactNode;
}

export function ChartContainer({
  title,
  description,
  loading = false,
  error = null,
  cached,
  durationMs,
  onRefresh,
  children,
}: ChartContainerProps) {
  return (
    <div className="chart-container">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Cache indicator */}
          {cached !== undefined && (
            <span
              className={clsx(
                'text-xs px-2 py-1 rounded',
                cached
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              )}
            >
              {cached ? 'Cached' : 'Fresh'}
            </span>
          )}

          {/* Duration */}
          {durationMs !== undefined && (
            <span className="text-xs text-gray-400">{durationMs}ms</span>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg
                className={clsx('w-4 h-4', loading && 'animate-spin')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error ? (
          <div className="flex items-center justify-center h-64 text-red-500">
            <div className="text-center">
              <p className="font-medium">Failed to load chart</p>
              <p className="text-sm mt-1">{error.message}</p>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
