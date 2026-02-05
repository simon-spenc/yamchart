import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useConfig, useDashboards, useHealth } from '../../hooks';
import { ConnectionStatus } from '../ConnectionStatus';

interface AppLayoutProps {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function AppLayout({ children, currentPath, onNavigate }: AppLayoutProps) {
  const { data: config } = useConfig();
  const { data: dashboards } = useDashboards();
  const { data: health } = useHealth();

  const charts = config?.charts || [];
  const dashboardList = dashboards || [];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        dashboards={dashboardList}
        charts={charts}
        currentPath={currentPath}
        onNavigate={onNavigate}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">
              {config?.name || 'Yamchart'}
            </h1>
            {config?.description && (
              <span className="text-sm text-gray-500 hidden md:block">
                {config.description}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus status={health?.status} connection={health?.connection} />
            <span className="text-xs text-gray-400">v{health?.version}</span>
          </div>
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
