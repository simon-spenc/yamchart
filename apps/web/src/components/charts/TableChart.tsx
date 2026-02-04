import { useState, useMemo } from 'react';
import type { Column, AxisConfig } from '../../api/types';

interface TableChartProps {
  data: Array<Record<string, unknown>>;
  columns: Column[];
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  height?: number | string;
  loading?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

function formatCellValue(value: unknown, format?: string): string {
  if (value === null || value === undefined) return '-';

  if (typeof value === 'number') {
    if (format?.includes('$')) {
      return `$${value.toLocaleString()}`;
    }
    if (format?.includes('%')) {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString();
  }

  return String(value);
}

export function TableChart({
  data,
  columns,
  height = 400,
  loading = false,
}: TableChartProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse bg-gray-100 w-full h-full rounded" />
      </div>
    );
  }

  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className="h-full overflow-auto" style={{ maxHeight: heightStyle }}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((col) => (
              <th
                key={col.name}
                className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort(col.name)}
              >
                <div className="flex items-center gap-2">
                  <span>{col.name}</span>
                  <span className="text-gray-400">
                    {sortColumn === col.name && sortDirection === 'asc' && '↑'}
                    {sortColumn === col.name && sortDirection === 'desc' && '↓'}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              {columns.map((col) => (
                <td key={col.name} className="px-4 py-3 text-gray-700">
                  {formatCellValue(row[col.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sortedData.length === 0 && (
        <div className="text-center py-8 text-gray-400">No data</div>
      )}
    </div>
  );
}
