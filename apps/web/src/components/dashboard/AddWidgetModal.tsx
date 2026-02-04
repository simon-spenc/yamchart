import { useState, useEffect, useRef } from 'react';
import { useConfig } from '../../hooks';
import type { DashboardWidget } from '../../api/types';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (widget: DashboardWidget) => void;
  existingCharts: string[];
}

export function AddWidgetModal({ isOpen, onClose, onAdd, existingCharts }: AddWidgetModalProps) {
  const { data: config } = useConfig();
  const [search, setSearch] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const charts = config?.charts || [];
  const filteredCharts = charts.filter(chart =>
    chart.title.toLowerCase().includes(search.toLowerCase()) ||
    chart.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (chartName: string) => {
    onAdd({
      type: 'chart',
      ref: chartName,
      cols: 6,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
      >
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Add Chart</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            placeholder="Search charts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filteredCharts.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No charts found
            </div>
          ) : (
            <div className="p-2">
              {filteredCharts.map((chart) => {
                const isAlreadyAdded = existingCharts.includes(chart.name);
                return (
                  <button
                    key={chart.name}
                    onClick={() => handleAdd(chart.name)}
                    disabled={isAlreadyAdded}
                    className="w-full text-left px-3 py-3 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{chart.title}</div>
                      <div className="text-sm text-gray-500">{chart.name}</div>
                      {chart.description && (
                        <div className="text-xs text-gray-400 mt-1">{chart.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                        {chart.type}
                      </span>
                      {isAlreadyAdded ? (
                        <span className="text-xs text-green-600">Added</span>
                      ) : (
                        <svg className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
