import { useConfig, useHealth } from '../hooks';
import { ConnectionStatus } from './ConnectionStatus';

export function Header() {
  const { data: config } = useConfig();
  const { data: health } = useHealth();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {config?.name || 'Yamchart'}
            </h1>
            {config?.description && (
              <span className="text-sm text-gray-500">{config.description}</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <ConnectionStatus status={health?.status} connection={health?.connection} />
            <span className="text-xs text-gray-400">v{health?.version}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
