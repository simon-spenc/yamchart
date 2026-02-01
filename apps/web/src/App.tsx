import { Header } from './components/Header';
import { ChartView } from './components/ChartView';
import { useConfig } from './hooks';

function App() {
  const { data: config, isLoading } = useConfig();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // For MVP, show the first chart or revenue-trend
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
