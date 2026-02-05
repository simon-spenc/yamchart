import type { ConnectionInfo } from '../api/types';

function ConnectionTooltip({ connection }: { connection: ConnectionInfo }) {
  return (
    <div className="absolute right-0 top-full mt-2 z-50 min-w-[200px] bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
      <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 rotate-45" />
      <div className="space-y-1.5">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Name</span>
          <span className="font-medium">{connection.name}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Type</span>
          <span className="font-medium capitalize">{connection.type}</span>
        </div>
        {connection.type === 'duckdb' && connection.path && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Path</span>
            <span className="font-medium truncate max-w-[120px]" title={connection.path}>
              {connection.path}
            </span>
          </div>
        )}
        {connection.type === 'postgres' && (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Host</span>
              <span className="font-medium">{connection.host}:{connection.port}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Database</span>
              <span className="font-medium">{connection.database}</span>
            </div>
            {connection.schema && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-400">Schema</span>
                <span className="font-medium">{connection.schema}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ConnectionStatusProps {
  status?: 'ok' | 'error';
  connection?: ConnectionInfo;
}

export function ConnectionStatus({ status, connection }: ConnectionStatusProps) {
  return (
    <div className="relative group">
      <div className="flex items-center gap-2 cursor-default">
        <span
          className={`w-2 h-2 rounded-full ${
            status === 'ok' ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-gray-600">
          {status === 'ok' ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      {connection && <ConnectionTooltip connection={connection} />}
    </div>
  );
}
