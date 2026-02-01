import { Header } from './components/Header';
import { ChartView } from './components/ChartView';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ChartView chartName="revenue-trend" />
      </main>
    </div>
  );
}

export default App;
