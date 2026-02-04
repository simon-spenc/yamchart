import { useDashboard } from '../../hooks';
import { EditModeProvider } from './EditModeContext';
import { DashboardToolbar } from './DashboardToolbar';
import { DashboardGrid } from './DashboardGrid';
import { DashboardFilters } from './DashboardFilters';

interface DashboardProps {
  dashboardId: string;
  branch?: string;
}

export function Dashboard({ dashboardId, branch }: DashboardProps) {
  const { data: dashboard, isLoading, error } = useDashboard(dashboardId, branch);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">
          Failed to load dashboard: {error?.message || 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <EditModeProvider>
      <div className="min-h-screen bg-gray-50">
        <DashboardToolbar
          dashboardId={dashboardId}
          title={dashboard.title}
          currentBranch={dashboard.branch}
        />
        <div className="p-6">
          {dashboard.filters && dashboard.filters.length > 0 && (
            <DashboardFilters filters={dashboard.filters} />
          )}
          <DashboardGrid layout={dashboard.layout} />
        </div>
      </div>
    </EditModeProvider>
  );
}
