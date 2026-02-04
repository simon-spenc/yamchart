import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useEditMode } from '../EditModeContext';
import { useFilterStore } from '../../../stores/filterStore';
import { clsx } from 'clsx';

interface TextWidgetProps {
  content: string;
  onUpdate?: (content: string) => void;
}

// KPI Reference Popover Component
interface KpiRefPopoverProps {
  chartName: string;
  chartTitle: string;
  displayValue: string;
  field?: string;
  change?: number;
  previousValue?: number;
  lockedPreset?: string;
  lockedRange?: string;
  format?: { type: string };
}

function KpiRefPopover({
  chartName,
  chartTitle,
  displayValue,
  field,
  change,
  previousValue,
  lockedPreset,
  lockedRange,
  format,
}: KpiRefPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'below' as 'below' | 'above' });
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  // Update popover position when opened, with smart placement
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const popoverHeight = popoverRef.current?.offsetHeight || 180; // Estimate if not yet rendered
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const padding = 8;

      // Determine if we should show above or below
      let placement: 'below' | 'above' = 'below';
      let top: number;

      if (spaceBelow < popoverHeight + padding && spaceAbove > spaceBelow) {
        // Show above
        placement = 'above';
        top = triggerRect.top + window.scrollY - popoverHeight - padding;
      } else {
        // Show below
        top = triggerRect.bottom + window.scrollY + padding;
      }

      // Handle horizontal positioning - keep within viewport
      let left = triggerRect.left + window.scrollX;
      const popoverWidth = popoverRef.current?.offsetWidth || 220;
      if (left + popoverWidth > window.innerWidth - padding) {
        left = window.innerWidth - popoverWidth - padding;
      }
      if (left < padding) {
        left = padding;
      }

      setPosition({ top, left, placement });
    };

    // Initial position
    updatePosition();

    // Update position after popover renders (to get actual height)
    requestAnimationFrame(updatePosition);
  }, [isOpen]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Format the date context display
  const dateContext = lockedPreset
    ? lockedPreset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : lockedRange
    ? lockedRange.replace('..', ' to ')
    : null;

  // Format change display
  const changeDisplay = change !== undefined
    ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
    : null;

  const changeColor = change !== undefined
    ? change >= 0 ? 'text-green-600' : 'text-red-600'
    : '';

  return (
    <>
      <span
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="text-blue-600 font-semibold border-b border-dashed border-blue-300 cursor-pointer hover:bg-blue-50 px-0.5 rounded transition-colors"
      >
        {displayValue}
      </span>

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[220px] text-sm"
          style={{ top: position.top, left: position.left }}
        >
          {/* Header */}
          <div className="font-medium text-gray-900 mb-2">{chartTitle}</div>

          {/* Value */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-gray-900">{displayValue}</span>
            {field && field !== 'value' && field !== 'formatted' && (
              <span className="text-xs text-gray-500">({field})</span>
            )}
          </div>

          {/* Change */}
          {changeDisplay && (
            <div className={clsx('text-sm mb-2', changeColor)}>
              {changeDisplay} vs previous period
              {previousValue !== undefined && (
                <span className="text-gray-500 ml-1">
                  ({format?.type === 'currency' ? '$' : ''}{previousValue.toLocaleString()})
                </span>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-100 my-2" />

          {/* Date Context */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {dateContext ? (
              <span>{dateContext}</span>
            ) : (
              <span className="italic">Follows dashboard filter</span>
            )}
          </div>

          {/* Source */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>{chartName}</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Parsed reference from content
interface ChartRef {
  chartName: string;
  field?: string;
  locked?: {
    preset?: string;
    startDate?: string;
    endDate?: string;
  };
}

// Extract chart references from content
// Supports: {{chart}}, {{chart.field}}, {{chart@preset}}, {{chart.field@preset}}, {{chart@start..end}}
function extractChartRefs(content: string): ChartRef[] {
  const regex = /\{\{([a-zA-Z0-9_-]+)(?:\.([a-zA-Z0-9_]+))?(?:@([a-zA-Z0-9_-]+|\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}))?\}\}/g;
  const refs = new Map<string, ChartRef>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const chartName = match[1];
    const field = match[2];
    const lockedValue = match[3];

    if (!chartName) continue;

    let locked: ChartRef['locked'] | undefined;
    if (lockedValue) {
      // Check if it's a date range (YYYY-MM-DD..YYYY-MM-DD)
      const dateRangeMatch = lockedValue.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
      if (dateRangeMatch) {
        locked = { startDate: dateRangeMatch[1], endDate: dateRangeMatch[2] };
      } else {
        // It's a preset name
        locked = { preset: lockedValue };
      }
    }

    // Use full match as key to dedupe
    const key = `${chartName}:${field || ''}:${lockedValue || ''}`;
    if (!refs.has(key)) {
      refs.set(key, { chartName, field, locked });
    }
  }
  return Array.from(refs.values());
}

// Get unique chart names from refs
function getUniqueChartNames(refs: ChartRef[]): string[] {
  return Array.from(new Set(refs.map(r => r.chartName)));
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

// Build query params for a reference
function buildQueryParams(
  ref: ChartRef,
  globalFilters: Record<string, unknown>
): Record<string, unknown> {
  if (ref.locked) {
    if (ref.locked.preset) {
      return { date_range: ref.locked.preset };
    }
    if (ref.locked.startDate && ref.locked.endDate) {
      return {
        date_range: {
          type: 'custom',
          start: ref.locked.startDate,
          end: ref.locked.endDate,
        },
      };
    }
  }
  // Use global filters for non-locked refs
  return globalFilters;
}

// Generate a unique key for a reference (for deduping and lookup)
function getRefKey(ref: ChartRef): string {
  const lockKey = ref.locked
    ? ref.locked.preset || `${ref.locked.startDate}..${ref.locked.endDate}`
    : 'current';
  return `${ref.chartName}:${ref.field || 'value'}:${lockKey}`;
}

// Hook to fetch chart data for variable references
function useChartVariables(chartRefs: ChartRef[], globalFilters: Record<string, unknown>) {
  // Get unique chart names for config queries
  const chartNames = getUniqueChartNames(chartRefs);

  // Build unique query specs (chartName + params combination)
  const querySpecs = useMemo(() => {
    const specs = new Map<string, { chartName: string; params: Record<string, unknown>; refs: ChartRef[] }>();

    chartRefs.forEach(ref => {
      const params = buildQueryParams(ref, globalFilters);
      const key = `${ref.chartName}:${JSON.stringify(params)}`;

      if (!specs.has(key)) {
        specs.set(key, { chartName: ref.chartName, params, refs: [] });
      }
      specs.get(key)!.refs.push(ref);
    });

    return Array.from(specs.values());
  }, [chartRefs, globalFilters]);

  // Fetch data for each unique query spec
  const dataQueries = useQueries({
    queries: querySpecs.map(spec => ({
      queryKey: ['chartData', spec.chartName, spec.params],
      queryFn: () => api.queryChart(spec.chartName, spec.params),
      enabled: querySpecs.length > 0,
    })),
  });

  // Fetch configs for each unique chart name
  const configQueries = useQueries({
    queries: chartNames.map(name => ({
      queryKey: ['chart', name],
      queryFn: () => api.getChart(name),
      enabled: chartNames.length > 0,
    })),
  });

  // Build config lookup
  const configLookup = useMemo(() => {
    const lookup: Record<string, { chart: { type: string; value?: { field: string }; format?: { type: string; currency?: string; decimals?: number }; comparison?: { enabled: boolean; field?: string; type?: string } } }> = {};
    chartNames.forEach((name, index) => {
      const query = configQueries[index];
      if (query?.data) {
        lookup[name] = query.data;
      }
    });
    return lookup;
  }, [chartNames, configQueries]);

  // Build values lookup
  const values = useMemo(() => {
    const result: Record<string, { value: number; formatted: string; change?: number; fields: Record<string, number> }> = {};

    querySpecs.forEach((spec, specIndex) => {
      const dataResult = dataQueries[specIndex];
      const config = configLookup[spec.chartName]?.chart;

      if (!dataResult?.data?.rows?.[0] || !config) return;

      const row = dataResult.data.rows[0];

      spec.refs.forEach(ref => {
        const key = getRefKey(ref);

        if (config.type === 'kpi' && config.value?.field) {
          const valueField = config.value.field;
          const rawValue = (row[valueField] as number) ?? 0;

          const entry: { value: number; formatted: string; change?: number; fields: Record<string, number> } = {
            value: rawValue,
            formatted: formatKpiValue(rawValue, config.format),
            fields: {},
          };

          // Store all numeric fields for field access
          Object.entries(row).forEach(([fieldName, fieldValue]) => {
            if (typeof fieldValue === 'number') {
              entry.fields[fieldName] = fieldValue;
            }
          });

          // Calculate change if comparison is enabled
          if (config.comparison?.enabled && config.comparison.field) {
            const previousValue = row[config.comparison.field] as number;
            if (previousValue && previousValue !== 0) {
              if (config.comparison.type === 'percent_change') {
                entry.change = ((rawValue - previousValue) / previousValue) * 100;
              } else {
                entry.change = rawValue - previousValue;
              }
            }
          }

          result[key] = entry;
        }
      });
    });

    return result;
  }, [querySpecs, dataQueries, configLookup]);

  const isLoading = dataQueries.some(q => q.isLoading) || configQueries.some(q => q.isLoading);

  // Build chart titles lookup
  const chartTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    chartNames.forEach((name, index) => {
      const query = configQueries[index];
      if (query?.data?.title) {
        titles[name] = query.data.title;
      }
    });
    return titles;
  }, [chartNames, configQueries]);

  return { values, isLoading, getRefKey, chartTitles };
}

// Format preset name for display
function formatPresetName(preset: string): string {
  return preset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Build tooltip text for a KPI reference
function buildTooltip(chartName: string, chartTitle: string | undefined, field: string | undefined, locked: ChartRef['locked']): string {
  const parts: string[] = [];
  parts.push(chartTitle || chartName);

  if (field && field !== 'value' && field !== 'formatted') {
    parts.push(`(${field})`);
  }

  if (locked) {
    if (locked.preset) {
      parts.push(`@ ${formatPresetName(locked.preset)}`);
    } else if (locked.startDate && locked.endDate) {
      parts.push(`@ ${locked.startDate} to ${locked.endDate}`);
    }
  } else {
    parts.push('(follows filter)');
  }

  return parts.join(' ');
}

// Data structure passed to KPI refs via data attributes
interface KpiRefData {
  chartName: string;
  chartTitle: string;
  displayValue: string;
  field?: string;
  change?: number;
  previousValue?: number;
  lockedPreset?: string;
  lockedRange?: string;
}

// Replace variables in content with custom kpi-ref elements
function replaceVariables(
  content: string,
  values: Record<string, { value: number; formatted: string; change?: number; fields: Record<string, number> }>,
  chartTitles: Record<string, string>
): { content: string; refData: Record<string, KpiRefData> } {
  const refData: Record<string, KpiRefData> = {};
  let refIndex = 0;

  // Match: {{chart}}, {{chart.field}}, {{chart@preset}}, {{chart.field@preset}}, {{chart@date..date}}
  const processedContent = content.replace(
    /\{\{([a-zA-Z0-9_-]+)(?:\.([a-zA-Z0-9_]+))?(?:@([a-zA-Z0-9_-]+|\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}))?\}\}/g,
    (match, chartName, field, lockedValue) => {
      // Build the ref to find the data
      let locked: ChartRef['locked'] | undefined;
      let lockedPreset: string | undefined;
      let lockedRange: string | undefined;

      if (lockedValue) {
        const dateRangeMatch = lockedValue.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
        if (dateRangeMatch) {
          locked = { startDate: dateRangeMatch[1], endDate: dateRangeMatch[2] };
          lockedRange = lockedValue;
        } else {
          locked = { preset: lockedValue };
          lockedPreset = lockedValue;
        }
      }

      const ref: ChartRef = { chartName, field, locked };
      const key = getRefKey(ref);
      const data = values[key];

      if (!data) return match; // Keep original if not found

      let displayValue: string;

      // Handle field access
      if (field) {
        if (field === 'formatted' || field === 'value') {
          displayValue = data.formatted;
        } else if (field === 'change' && data.change !== undefined) {
          const prefix = data.change >= 0 ? '+' : '';
          displayValue = `${prefix}${data.change.toFixed(1)}%`;
        } else if (data.fields[field] !== undefined) {
          displayValue = data.fields[field].toLocaleString();
        } else {
          return match;
        }
      } else {
        displayValue = data.formatted;
      }

      // Store data for this ref
      const refId = `kpi-ref-${refIndex++}`;
      refData[refId] = {
        chartName,
        chartTitle: chartTitles[chartName] || chartName,
        displayValue,
        field,
        change: data.change,
        previousValue: data.fields['previous_value'],
        lockedPreset,
        lockedRange,
      };

      // Return custom element with ref ID
      return `<kpi-ref data-ref-id="${refId}">${displayValue}</kpi-ref>`;
    }
  );

  return { content: processedContent, refData };
}

export function TextWidget({ content, onUpdate }: TextWidgetProps) {
  const { isEditing } = useEditMode();
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Get global filters for non-locked references
  const globalFilters = useFilterStore((s) => s.globalFilters);

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
  const { values, isLoading, chartTitles } = useChartVariables(chartRefs, globalFilters as Record<string, unknown>);

  // Process content with variable replacements
  const { content: processedContent, refData } = useMemo(() => {
    if (isLoading || Object.keys(values).length === 0) {
      return { content, refData: {} };
    }
    return replaceVariables(content, values, chartTitles);
  }, [content, values, isLoading, chartTitles]);

  // Create custom component for kpi-ref elements
  const markdownComponents = useMemo(() => ({
    'kpi-ref': ({ children, ...props }: { children?: React.ReactNode; 'data-ref-id'?: string }) => {
      const refId = props['data-ref-id'];
      const data = refId ? refData[refId] : null;

      if (!data) {
        return <span>{children}</span>;
      }

      return (
        <KpiRefPopover
          chartName={data.chartName}
          chartTitle={data.chartTitle}
          displayValue={data.displayValue}
          field={data.field}
          change={data.change}
          previousValue={data.previousValue}
          lockedPreset={data.lockedPreset}
          lockedRange={data.lockedRange}
        />
      );
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any, [refData]);

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
      const indent = unorderedMatch[1] ?? '';
      const marker = unorderedMatch[2] ?? '-';
      const matchContent = unorderedMatch[3] ?? '';

      // If line is empty (just marker), remove it
      if (!matchContent.trim()) {
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
      const orderedIndent = orderedMatch[1] ?? '';
      const num = orderedMatch[2] ?? '1';
      const orderedContent = orderedMatch[3] ?? '';

      // If line is empty (just number), remove it
      if (!orderedContent.trim()) {
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
      const newLine = `\n${orderedIndent}${nextNum}. `;
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
        <ReactMarkdown rehypePlugins={[rehypeRaw]} components={markdownComponents}>{processedContent}</ReactMarkdown>
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
