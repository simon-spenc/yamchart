// apps/cli/src/generate/prompts.ts
import { confirm, select, checkbox } from '@inquirer/prompts';
import type { DetectedColumns } from './detector.js';
import type { MetricColumn } from './variants.js';

export interface DateColumnChoice {
  name: string;
  value: string | null;
  checked: boolean;
}

export interface MetricChoice {
  name: string;
  value: MetricColumn;
  checked: boolean;
}

export interface DimensionChoice {
  name: string;
  value: string;
  checked: boolean;
}

export function buildDateColumnChoices(detected: DetectedColumns): DateColumnChoice[] {
  const choices: DateColumnChoice[] = detected.dateColumns.map((col, i) => ({
    name: col,
    value: col,
    checked: i === 0,
  }));
  choices.push({ name: 'Skip time series', value: null, checked: false });
  return choices;
}

export function buildMetricChoices(detected: DetectedColumns): MetricChoice[] {
  return detected.metricColumns.map(col => ({
    name: `${col} (sum)`,
    value: { name: col, aggregation: 'sum' as const },
    checked: true,
  }));
}

export function buildDimensionChoices(detected: DetectedColumns): DimensionChoice[] {
  return detected.dimensionColumns.map(col => ({
    name: col,
    value: col,
    checked: true,
  }));
}

export async function promptDateColumn(modelName: string, detected: DetectedColumns): Promise<string | null> {
  if (detected.dateColumns.length === 0) return null;

  const defaultCol = detected.dateColumns[0];
  const confirmed = await confirm({
    message: `${modelName}: Use '${defaultCol}' for time series?`,
    default: true,
  });

  if (confirmed) return defaultCol;

  if (detected.dateColumns.length === 1) return null;

  return select({
    message: 'Select date column:',
    choices: buildDateColumnChoices(detected).map(c => ({ name: c.name, value: c.value })),
  });
}

export async function promptMetrics(modelName: string, detected: DetectedColumns): Promise<MetricColumn[]> {
  if (detected.metricColumns.length === 0) return [];

  const choices = buildMetricChoices(detected);
  const selected = await checkbox({
    message: `${modelName}: Select metrics to aggregate:`,
    choices: choices.map(c => ({ name: c.name, value: c.value, checked: c.checked })),
  });

  return selected;
}

export async function promptDimensions(modelName: string, detected: DetectedColumns): Promise<string[]> {
  if (detected.dimensionColumns.length === 0) return [];

  const choices = buildDimensionChoices(detected);
  const selected = await checkbox({
    message: `${modelName}: Select dimensions for grouping:`,
    choices: choices.map(c => ({ name: c.name, value: c.value, checked: c.checked })),
  });

  return selected;
}

export async function promptConfirmVariants(modelName: string, variantNames: string[]): Promise<string[]> {
  const choices = variantNames.map(name => ({ name, value: name, checked: true }));

  return checkbox({
    message: `${modelName}: Generate these stubs?`,
    choices,
  });
}

export async function promptOverwrite(filename: string): Promise<'overwrite' | 'skip' | 'rename'> {
  return select({
    message: `${filename} already exists:`,
    choices: [
      { name: 'Overwrite', value: 'overwrite' as const },
      { name: 'Skip', value: 'skip' as const },
      { name: 'Rename (add suffix)', value: 'rename' as const },
    ],
  });
}
