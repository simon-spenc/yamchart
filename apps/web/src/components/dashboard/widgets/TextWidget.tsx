import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useEditMode } from '../EditModeContext';
import { clsx } from 'clsx';

interface TextWidgetProps {
  content: string;
  onUpdate?: (content: string) => void;
}

// Extract chart references from content like {{chart-ref}} or {{chart-ref.field}}
function extractChartRefs(content: string): string[] {
  const regex = /\{\{([a-zA-Z0-9_-]+)(?:\.[a-zA-Z0-9_]+)?\}\}/g;
  const refs = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    refs.add(match[1]);
  }
  return Array.from(refs);
}

// Format a value based on chart config
function formatKpiValue(
  value: number,
  format?: { type: string; currency?: string; decimals?: number }
): string {
  if (!format) return value.toLocaleString();

  const decimals = format.decimals ?? 0;

  switch (format.type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: format.currency || 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    case 'percent':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value / 100);
    default:
      return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  }
}

// Hook to fetch chart data for variable references
function useChartVariables(chartRefs: string[]) {
  const chartQueries = useQueries({
    queries: chartRefs.map(ref => ({
      queryKey: ['chartData', ref, {}],
      queryFn: () => api.queryChart(ref, {}),
      enabled: chartRefs.length > 0,
    })),
  });

  const configQueries = useQueries({
    queries: chartRefs.map(ref => ({
      queryKey: ['chart', ref],
      queryFn: () => api.getChart(ref),
      enabled: chartRefs.length > 0,
    })),
  });

  const values: Record<string, { value: number; formatted: string; change?: number }> = {};

  chartRefs.forEach((ref, index) => {
    const dataResult = chartQueries[index];
    const configResult = configQueries[index];

    if (dataResult.data?.rows?.[0] && configResult.data?.chart) {
      const row = dataResult.data.rows[0];
      const config = configResult.data.chart;

      if (config.type === 'kpi' && config.value?.field) {
        const rawValue = row[config.value.field] as number;
        values[ref] = {
          value: rawValue,
          formatted: formatKpiValue(rawValue, config.format),
        };

        // Calculate change if comparison is enabled
        if (config.comparison?.enabled && config.comparison.field) {
          const previousValue = row[config.comparison.field] as number;
          if (previousValue && previousValue !== 0) {
            if (config.comparison.type === 'percent_change') {
              values[ref].change = ((rawValue - previousValue) / previousValue) * 100;
            } else {
              values[ref].change = rawValue - previousValue;
            }
          }
        }
      }
    }
  });

  const isLoading = chartQueries.some(q => q.isLoading) || configQueries.some(q => q.isLoading);

  return { values, isLoading };
}

// Replace variables in content with actual values
function replaceVariables(
  content: string,
  values: Record<string, { value: number; formatted: string; change?: number }>
): string {
  return content.replace(/\{\{([a-zA-Z0-9_-]+)(?:\.([a-zA-Z0-9_]+))?\}\}/g, (match, ref, field) => {
    const data = values[ref];
    if (!data) return match; // Keep original if not found

    if (!field || field === 'formatted') {
      return data.formatted;
    }
    if (field === 'value') {
      return data.value.toString();
    }
    if (field === 'change' && data.change !== undefined) {
      const prefix = data.change >= 0 ? '+' : '';
      return `${prefix}${data.change.toFixed(1)}%`;
    }

    return match;
  });
}

export function TextWidget({ content, onUpdate }: TextWidgetProps) {
  const { isEditing } = useEditMode();
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Fetch available charts for reference picker
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.getConfig(),
  });

  // Filter to only KPI charts for variable references
  const kpiCharts = useMemo(() => {
    return config?.charts.filter(c => c.type === 'kpi') || [];
  }, [config]);

  // Extract and fetch chart references
  const chartRefs = useMemo(() => extractChartRefs(content), [content]);
  const { values, isLoading } = useChartVariables(chartRefs);

  // Process content with variable replacements
  const processedContent = useMemo(() => {
    if (isLoading || Object.keys(values).length === 0) return content;
    return replaceVariables(content, values);
  }, [content, values, isLoading]);

  const handleSave = () => {
    onUpdate?.(editedContent);
    setIsEditingContent(false);
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditingContent(false);
  };

  const handleStartEdit = () => {
    setEditedContent(content);
    setIsEditingContent(true);
  };

  const handleCopyRef = async (chartName: string) => {
    const ref = `{{${chartName}}}`;
    await navigator.clipboard.writeText(ref);
    setCopiedRef(chartName);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;

    const textarea = e.currentTarget;
    const { selectionStart, value } = textarea;

    // Find the current line
    const beforeCursor = value.substring(0, selectionStart);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const currentLine = beforeCursor.substring(lineStart);

    // Check for unordered list (- or *)
    const unorderedMatch = currentLine.match(/^(\s*)([-*])\s(.*)$/);
    if (unorderedMatch) {
      const [, indent, marker, content] = unorderedMatch;

      // If line is empty (just marker), remove it
      if (!content.trim()) {
        e.preventDefault();
        const newValue = value.substring(0, lineStart) + value.substring(selectionStart);
        setEditedContent(newValue);
        // Set cursor position after React updates
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = lineStart;
        }, 0);
        return;
      }

      // Add new list item
      e.preventDefault();
      const newLine = `\n${indent}${marker} `;
      const newValue = value.substring(0, selectionStart) + newLine + value.substring(selectionStart);
      setEditedContent(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = selectionStart + newLine.length;
      }, 0);
      return;
    }

    // Check for ordered list (1. 2. etc)
    const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
    if (orderedMatch) {
      const [, indent, num, content] = orderedMatch;

      // If line is empty (just number), remove it
      if (!content.trim()) {
        e.preventDefault();
        const newValue = value.substring(0, lineStart) + value.substring(selectionStart);
        setEditedContent(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = lineStart;
        }, 0);
        return;
      }

      // Add new list item with incremented number
      e.preventDefault();
      const nextNum = parseInt(num, 10) + 1;
      const newLine = `\n${indent}${nextNum}. `;
      const newValue = value.substring(0, selectionStart) + newLine + value.substring(selectionStart);
      setEditedContent(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = selectionStart + newLine.length;
      }, 0);
      return;
    }
  };

  if (isEditing && isEditingContent) {
    return (
      <div className="h-full flex flex-col p-2 overflow-hidden">
        <div className="flex-1 flex gap-2 min-h-0">
          {/* Editor */}
          <div className="flex-1 flex flex-col min-w-0">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 w-full p-2 border border-gray-300 rounded-md resize-none font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="# Heading
## Subheading
- List item
1. Ordered item
**bold** *italic*

Reference KPIs: {{revenue-kpi}}"
            />
          </div>

          {/* Chart references sidebar */}
          {kpiCharts.length > 0 && (
            <div className="w-44 flex-shrink-0 border-l border-gray-200 pl-2 overflow-y-auto">
              <div className="text-xs font-medium text-gray-500 mb-1">KPI References</div>
              <div className="space-y-1">
                {kpiCharts.map(chart => (
                  <button
                    key={chart.name}
                    onClick={() => handleCopyRef(chart.name)}
                    className={clsx(
                      'w-full text-left px-2 py-1 rounded text-xs transition-colors',
                      copiedRef === chart.name
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    )}
                  >
                    <div className="font-medium truncate">{chart.title}</div>
                    <div className="text-gray-400 font-mono truncate">
                      {copiedRef === chart.name ? 'Copied!' : `{{${chart.name}}}`}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-2 flex-shrink-0">
          <button
            onClick={handleCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 overflow-auto relative group">
      <div className="prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
        <ReactMarkdown>{processedContent}</ReactMarkdown>
      </div>
      {isEditing && onUpdate && (
        <button
          onClick={handleStartEdit}
          className="absolute bottom-2 right-2 p-1.5 bg-blue-100 hover:bg-blue-200 rounded text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Edit content"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
    </div>
  );
}
