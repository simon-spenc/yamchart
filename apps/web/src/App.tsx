import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from './components/layout';
import { ChartView } from './components/ChartView';
import { Dashboard } from './components/dashboard';
import { useConfig, useDashboards } from './hooks';

function parseHash(hash: string): { type: 'dashboard' | 'chart'; name: string } | null {
  const match = hash.match(/^#?\/(dashboards|charts)\/(.+)$/);
  if (match && match[1] && match[2]) {
    return {
      type: match[1] === 'dashboards' ? 'dashboard' : 'chart',
      name: decodeURIComponent(match[2]),
    };
  }
  return null;
}

function App() {
  const { data: config, isLoading: configLoading } = useConfig();
  const { data: dashboards, isLoading: dashboardsLoading } = useDashboards();

  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.hash.replace(/^#/, '') || '';
  });

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(window.location.hash.replace(/^#/, '') || '');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
    setCurrentPath(path);
  }, []);

  // Set initial route once data loads
  useEffect(() => {
    if (configLoading || dashboardsLoading) return;
    if (currentPath) return; // Already have a path

    // Default to first dashboard, or first chart
    if (dashboards && dashboards.length > 0 && dashboards[0]) {
      navigate(`/dashboards/${dashboards[0].name}`);
    } else if (config?.charts && config.charts.length > 0 && config.charts[0]) {
      navigate(`/charts/${config.charts[0].name}`);
    }
  }, [configLoading, dashboardsLoading, dashboards, config, currentPath, navigate]);

  if (configLoading || dashboardsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const parsed = parseHash(currentPath);

  const renderContent = () => {
    if (!parsed) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          Select a dashboard or chart from the sidebar
        </div>
      );
    }

    if (parsed.type === 'dashboard') {
      return <Dashboard dashboardId={parsed.name} />;
    }

    return (
      <div className="p-6">
        <ChartView chartName={parsed.name} />
      </div>
    );
  };

  return (
    <AppLayout currentPath={currentPath} onNavigate={navigate}>
      {renderContent()}
    </AppLayout>
  );
}

export default App;
