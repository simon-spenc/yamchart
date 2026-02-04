import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { DashboardSummary } from '../../api/types';

interface SidebarProps {
  dashboards: DashboardSummary[];
  charts: Array<{ name: string; title: string }>;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const COLLAPSED_KEY = 'yamchart-sidebar-collapsed';

export function Sidebar({ dashboards, charts, currentPath, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const isActive = (path: string) => currentPath === path;

  return (
    <aside
      className={clsx(
        'bg-white border-r border-gray-200 flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && (
          <span className="font-semibold text-gray-900 text-sm">Navigation</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={clsx('w-4 h-4 transition-transform', collapsed && 'rotate-180')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Dashboards */}
      {dashboards.length > 0 && (
        <div className="py-2">
          {!collapsed && (
            <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dashboards
            </div>
          )}
          {dashboards.map((dashboard) => {
            const path = `/dashboards/${dashboard.name}`;
            const active = isActive(path);
            return (
              <button
                key={dashboard.name}
                onClick={() => onNavigate(path)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
                title={collapsed ? dashboard.title : undefined}
              >
                <svg
                  className={clsx('w-5 h-5 flex-shrink-0', active ? 'text-blue-600' : 'text-gray-400')}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
                {!collapsed && (
                  <span className="truncate">{dashboard.title}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Divider */}
      {dashboards.length > 0 && charts.length > 0 && (
        <div className="mx-4 border-t border-gray-200" />
      )}

      {/* Charts */}
      {charts.length > 0 && (
        <div className="py-2 flex-1 overflow-y-auto">
          {!collapsed && (
            <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Charts
            </div>
          )}
          {charts.map((chart) => {
            const path = `/charts/${chart.name}`;
            const active = isActive(path);
            return (
              <button
                key={chart.name}
                onClick={() => onNavigate(path)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
                title={collapsed ? chart.title : undefined}
              >
                <svg
                  className={clsx('w-5 h-5 flex-shrink-0', active ? 'text-blue-600' : 'text-gray-400')}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                </svg>
                {!collapsed && (
                  <span className="truncate">{chart.title}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
