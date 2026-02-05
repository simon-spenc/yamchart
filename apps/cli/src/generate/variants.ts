// apps/cli/src/generate/variants.ts

export interface MetricColumn {
  name: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

export interface VariantConfig {
  modelName: string;
  tableName: string;
  dateColumn: string | null;
  metricColumns: MetricColumn[];
  dimensionColumns: string[];
}

export interface GeneratedVariant {
  name: string;
  filename: string;
  description: string;
  sql: string;
}

function formatDate(): string {
  return new Date().toISOString().split('T')[0];
}

function generateHeader(modelName: string, variantName: string, description: string, tableName: string): string {
  return `-- @generated: from dbt model '${modelName}' on ${formatDate()}
-- @name: ${variantName}
-- @description: ${description}
-- @source: ${tableName}

`;
}

function generateMetricSelects(metrics: MetricColumn[]): string {
  return metrics
    .map(m => `  ${m.aggregation.toUpperCase()}(${m.name}) AS ${m.aggregation}_${m.name}`)
    .join(',\n');
}

export function generateVariants(config: VariantConfig): GeneratedVariant[] {
  const variants: GeneratedVariant[] = [];
  const { modelName, tableName, dateColumn, metricColumns, dimensionColumns } = config;

  // Time series variant
  if (dateColumn && metricColumns.length > 0) {
    const name = `${modelName}_over_time`;
    const description = `${modelName} aggregated over time`;
    const sql = `${generateHeader(modelName, name, description, tableName)}SELECT
  date_trunc('{{ granularity }}', ${dateColumn}) AS period,
${generateMetricSelects(metricColumns)}
FROM ${tableName}
WHERE ${dateColumn} >= '{{ start_date }}'
  AND ${dateColumn} <= '{{ end_date }}'
GROUP BY 1
ORDER BY 1
`;
    variants.push({ name, filename: `${name}.sql`, description, sql });
  }

  // Dimension variants
  for (const dim of dimensionColumns) {
    const name = `${modelName}_by_${dim}`;
    const description = `${modelName} grouped by ${dim}`;
    let sql = generateHeader(modelName, name, description, tableName);
    sql += `SELECT
  ${dim},
${generateMetricSelects(metricColumns)}
FROM ${tableName}
`;
    if (dateColumn) {
      sql += `WHERE ${dateColumn} >= '{{ start_date }}'
  AND ${dateColumn} <= '{{ end_date }}'
`;
    }
    sql += `GROUP BY 1
ORDER BY 2 DESC
`;
    variants.push({ name, filename: `${name}.sql`, description, sql });
  }

  // KPI variant
  if (metricColumns.length > 0) {
    const name = `${modelName}_kpi`;
    const description = `${modelName} summary metrics`;
    let sql = generateHeader(modelName, name, description, tableName);
    sql += `SELECT
${generateMetricSelects(metricColumns)}
FROM ${tableName}
`;
    if (dateColumn) {
      sql += `WHERE ${dateColumn} >= '{{ start_date }}'
  AND ${dateColumn} <= '{{ end_date }}'
`;
    }
    variants.push({ name, filename: `${name}.sql`, description, sql });
  }

  return variants;
}
