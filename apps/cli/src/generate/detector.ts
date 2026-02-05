import type { DbtColumn } from '../dbt/types.js';

export interface DetectedColumns {
  dateColumns: string[];
  metricColumns: string[];
  dimensionColumns: string[];
  primaryKeys: string[];
  foreignKeys: string[];
}

const DATE_TYPES = ['date', 'timestamp', 'datetime', 'timestamptz', 'timestamp_ntz'];
const NUMERIC_TYPES = ['int', 'integer', 'bigint', 'smallint', 'numeric', 'decimal', 'float', 'double', 'real', 'number'];
const STRING_TYPES = ['string', 'varchar', 'char', 'text'];
const BOOLEAN_TYPES = ['boolean', 'bool', 'bit'];

function isDateColumn(col: DbtColumn): boolean {
  const typeLower = (col.data_type || '').toLowerCase();
  if (DATE_TYPES.some(t => typeLower.includes(t))) return true;

  const nameLower = col.name.toLowerCase();
  return nameLower.endsWith('_at') || nameLower.endsWith('_date') || nameLower.endsWith('_time');
}

function isNumericColumn(col: DbtColumn): boolean {
  const typeLower = (col.data_type || '').toLowerCase();
  return NUMERIC_TYPES.some(t => typeLower.includes(t));
}

function isStringColumn(col: DbtColumn): boolean {
  const typeLower = (col.data_type || '').toLowerCase();
  return STRING_TYPES.some(t => typeLower.includes(t));
}

function isBooleanColumn(col: DbtColumn): boolean {
  const typeLower = (col.data_type || '').toLowerCase();
  return BOOLEAN_TYPES.some(t => typeLower.includes(t));
}

function isPrimaryKey(col: DbtColumn): boolean {
  if (col.hints.includes('primary_key') || col.hints.includes('unique')) return true;
  return col.name === 'id';
}

function isForeignKey(col: DbtColumn): boolean {
  return col.hints.some(h => h.startsWith('fk:'));
}

export function detectColumnTypes(columns: DbtColumn[]): DetectedColumns {
  const dateColumns: string[] = [];
  const metricColumns: string[] = [];
  const dimensionColumns: string[] = [];
  const primaryKeys: string[] = [];
  const foreignKeys: string[] = [];

  for (const col of columns) {
    if (isPrimaryKey(col)) {
      primaryKeys.push(col.name);
      continue;
    }

    if (isForeignKey(col)) {
      foreignKeys.push(col.name);
      continue;
    }

    if (isDateColumn(col)) {
      dateColumns.push(col.name);
    } else if (isNumericColumn(col)) {
      metricColumns.push(col.name);
    } else {
      // String, boolean, or unknown types all become dimensions
      dimensionColumns.push(col.name);
    }
  }

  return { dateColumns, metricColumns, dimensionColumns, primaryKeys, foreignKeys };
}
