import type { DbtModel, DbtColumn } from './types.js';
import type { YamchartModel } from './scanner.js';

export interface CatalogModel extends DbtModel {
  yamchartModels: YamchartModel[];
}

export interface CatalogData {
  syncedAt: string;
  source: { type: string; path?: string; repo?: string };
  stats: { modelsIncluded: number; modelsExcluded: number };
  models: CatalogModel[];
}

/**
 * Generate catalog.md content.
 */
export function generateCatalogMd(data: CatalogData): string {
  const lines: string[] = [];

  // Header
  lines.push('# Data Catalog');
  lines.push('');
  lines.push(`> Source: ${data.source.type}:${data.source.path || data.source.repo || 'unknown'}`);
  lines.push(`> Last synced: ${data.syncedAt.split('T')[0]}`);
  lines.push(`> Models: ${data.stats.modelsIncluded} included, ${data.stats.modelsExcluded} filtered out`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Models');
  lines.push('');

  // Each model
  for (const model of data.models) {
    lines.push(`### ${model.name}`);
    lines.push('');
    lines.push(model.description);
    lines.push('');

    if (model.table) {
      lines.push(`**Table:** \`${model.table}\``);
    }

    if (model.tags.length > 0) {
      lines.push(`**Tags:** ${model.tags.map(t => `\`${t}\``).join(', ')}`);
    }

    lines.push('');

    // Column table
    if (model.columns.length > 0) {
      lines.push('| Column | Type | Description | Hints |');
      lines.push('|--------|------|-------------|-------|');

      for (const col of model.columns) {
        const type = col.data_type || '';
        const hints = col.hints.join(', ');
        lines.push(`| ${col.name} | ${type} | ${col.description} | ${hints} |`);
      }

      lines.push('');
    }

    // Yamchart models using this
    lines.push('**Yamchart models:**');
    if (model.yamchartModels.length > 0) {
      for (const ym of model.yamchartModels) {
        lines.push(`- [\`${ym.name}\`](../${ym.path}) - ${ym.description || 'No description'}`);
      }
    } else {
      lines.push('None yet');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate catalog.json content.
 */
export function generateCatalogJson(data: CatalogData): string {
  return JSON.stringify(data, null, 2);
}
