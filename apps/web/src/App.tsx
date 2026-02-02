import { useState } from 'react';
import { Header } from './components/Header';
import { ChartView } from './components/ChartView';
import { Dashboard } from './components/dashboard';
import { useConfig, useDashboards } from './hooks';

function App() {
  const { data: config, isLoading: configLoading } = useConfig();
  const { data: dashboards, isLoading: dashboardsLoading } = useDashboards();
  const [view, setView] = useState<'chart' | 'dashboard'>('dashboard');
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);

  if (configLoading || dashboardsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // If dashboards exist, show dashboard view by default
  const hasDashboards = dashboards && dashboards.length > 0;
  const activeDashboard = selectedDashboard || dashboards?.[0]?.name;

  if (hasDashboards && view === 'dashboard' && activeDashboard) {
    return <Dashboard dashboardId={activeDashboard} />;
  }

  // Fallback to chart view
  const chartName = config?.charts[0]?.name || 'revenue-trend';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ChartView chartName={chartName} />
      </main>
    </div>
  );
}

export default App;
