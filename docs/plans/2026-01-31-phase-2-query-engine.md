# Dashbook Phase 2: Query Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the query compilation engine that transforms chart configs + SQL models into executable queries.

**Architecture:** The query package handles: parsing model metadata from SQL comments, resolving `{{ ref() }}` references, expanding date presets, and rendering Nunjucks templates. DuckDB connector executes queries and returns typed results.

**Tech Stack:** Nunjucks (Jinja-compatible templating), DuckDB Node.js bindings, date-fns (date manipulation)

**Prerequisites:** Phase 0-1 complete (monorepo structure, schema package)

---

## Task 1: Create Query Package Structure

**Files:**
- Create: `packages/query/package.json`
- Create: `packages/query/tsconfig.json`
- Create: `packages/query/vitest.config.ts`
- Create: `packages/query/src/index.ts`

**Step 1: Create packages/query/package.json**

```json
{
  "name": "@dashbook/query",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@dashbook/schema": "workspace:*",
    "nunjucks": "^3.2.4",
    "date-fns": "^4.1.0",
    "duckdb": "^1.1.0"
  },
  "devDependencies": {
    "@dashbook/config": "workspace:*",
    "@types/nunjucks": "^3.2.6",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Step 2: Create packages/query/tsconfig.json**

```json
{
  "extends": "@dashbook/config/tsconfig.node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create packages/query/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Step 4: Create packages/query/src/index.ts**

```typescript
// Dashbook Query Engine
export const VERSION = '0.1.0';
```

**Step 5: Install dependencies**

Run: `pnpm install`

**Step 6: Verify build**

Run: `pnpm --filter @dashbook/query build`

Expected: Build succeeds.

**Step 7: Commit**

```bash
git add packages/query/
git commit -m "chore: add query package structure"
```

---

## Task 2: Implement Model Parser

**Files:**
- Create: `packages/query/src/parser.ts`
- Create: `packages/query/src/__tests__/parser.test.ts`

**Step 1: Write failing tests for model parser**

Create `packages/query/src/__tests__/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseModelMetadata } from '../parser.js';

describe('parseModelMetadata', () => {
  it('parses model name', () => {
    const sql = `
-- @name: monthly_revenue
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.name).toBe('monthly_revenue');
  });

  it('parses description', () => {
    const sql = `
-- @name: monthly_revenue
-- @description: Monthly revenue aggregated by category
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.description).toBe('Monthly revenue aggregated by category');
  });

  it('parses simple parameters', () => {
    const sql = `
-- @name: monthly_revenue
-- @param start_date: date
-- @param end_date: date
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.params).toHaveLength(2);
    expect(result.params![0]).toEqual({ name: 'start_date', type: 'date' });
    expect(result.params![1]).toEqual({ name: 'end_date', type: 'date' });
  });

  it('parses parameters with defaults', () => {
    const sql = `
-- @name: monthly_revenue
-- @param start_date: date = dateadd(month, -12, current_date())
-- @param granularity: string = 'month'
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.params![0].default).toBe("dateadd(month, -12, current_date())");
    expect(result.params![1].default).toBe("'month'");
  });

  it('parses parameters with options', () => {
    const sql = `
-- @name: monthly_revenue
-- @param granularity: string = 'month' {day, week, month, quarter}
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.params![0].options).toEqual(['day', 'week', 'month', 'quarter']);
  });

  it('parses owner and tags', () => {
    const sql = `
-- @name: monthly_revenue
-- @owner: analytics-team
-- @tags: [revenue, monthly, core]
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.owner).toBe('analytics-team');
    expect(result.tags).toEqual(['revenue', 'monthly', 'core']);
  });

  it('parses return columns', () => {
    const sql = `
-- @name: monthly_revenue
-- @returns:
--   - period: date -- The time period
--   - revenue: number -- Total revenue in USD
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.returns).toHaveLength(2);
    expect(result.returns![0]).toEqual({
      name: 'period',
      type: 'date',
      description: 'The time period',
    });
  });

  it('parses tests', () => {
    const sql = `
-- @name: monthly_revenue
-- @tests:
--   - revenue >= 0
--   - period is not null
SELECT * FROM orders
`;
    const result = parseModelMetadata(sql);
    expect(result.tests).toEqual(['revenue >= 0', 'period is not null']);
  });

  it('extracts SQL without metadata comments', () => {
    const sql = `
-- @name: monthly_revenue
-- @description: Test model

SELECT
    date_trunc('month', order_date) AS period,
    SUM(amount) AS revenue
FROM orders
GROUP BY 1
`;
    const result = parseModelMetadata(sql);
    expect(result.sql).toContain('SELECT');
    expect(result.sql).toContain('date_trunc');
    expect(result.sql).not.toContain('@name');
  });

  it('throws error if name is missing', () => {
    const sql = `
-- @description: No name
SELECT * FROM orders
`;
    expect(() => parseModelMetadata(sql)).toThrow('Model must have a @name');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/query test`

Expected: FAIL - cannot find module '../parser.js'

**Step 3: Implement model parser**

Create `packages/query/src/parser.ts`:

```typescript
import type { ModelMetadata, ModelParam, ReturnColumn } from '@dashbook/schema';

export interface ParsedModel {
  metadata: ModelMetadata;
  sql: string;
}

interface ParseResult extends ModelMetadata {
  sql: string;
}

/**
 * Parse model metadata from SQL comments.
 *
 * Supports:
 * - @name: model_name
 * - @description: text
 * - @owner: team-name
 * - @tags: [tag1, tag2]
 * - @param name: type = default {option1, option2}
 * - @returns: (multiline)
 * - @tests: (multiline)
 */
export function parseModelMetadata(sql: string): ParseResult {
  const lines = sql.split('\n');
  const metadataLines: string[] = [];
  const sqlLines: string[] = [];

  let inMetadata = true;
  let inMultiline: 'returns' | 'tests' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is a metadata comment
    if (trimmed.startsWith('-- @') || (inMultiline && trimmed.startsWith('--'))) {
      metadataLines.push(trimmed);
      inMetadata = true;
    } else if (trimmed.startsWith('--') && inMetadata && metadataLines.length > 0) {
      // Continuation of metadata block
      metadataLines.push(trimmed);
    } else if (trimmed === '' && inMetadata) {
      // Empty line in metadata section, keep going
      continue;
    } else {
      // SQL content
      inMetadata = false;
      sqlLines.push(line);
    }
  }

  // Parse metadata
  const metadata = parseMetadataLines(metadataLines);

  if (!metadata.name) {
    throw new Error('Model must have a @name');
  }

  return {
    ...metadata,
    sql: sqlLines.join('\n').trim(),
  };
}

function parseMetadataLines(lines: string[]): Partial<ModelMetadata> & { sql?: string } {
  const result: Partial<ModelMetadata> = {};
  const params: ModelParam[] = [];
  const returns: ReturnColumn[] = [];
  const tests: string[] = [];

  let currentMultiline: 'returns' | 'tests' | null = null;

  for (const line of lines) {
    const content = line.replace(/^--\s*/, '').trim();

    // Check for multiline content (indented with -)
    if (currentMultiline && content.startsWith('- ')) {
      const itemContent = content.slice(2).trim();

      if (currentMultiline === 'returns') {
        const returnCol = parseReturnColumn(itemContent);
        if (returnCol) returns.push(returnCol);
      } else if (currentMultiline === 'tests') {
        tests.push(itemContent);
      }
      continue;
    }

    // Check for new directive
    if (content.startsWith('@')) {
      currentMultiline = null;

      if (content.startsWith('@name:')) {
        result.name = content.slice(6).trim();
      } else if (content.startsWith('@description:')) {
        result.description = content.slice(13).trim();
      } else if (content.startsWith('@owner:')) {
        result.owner = content.slice(7).trim();
      } else if (content.startsWith('@tags:')) {
        result.tags = parseTags(content.slice(6).trim());
      } else if (content.startsWith('@param')) {
        const param = parseParam(content.slice(6).trim());
        if (param) params.push(param);
      } else if (content.startsWith('@returns:')) {
        currentMultiline = 'returns';
      } else if (content.startsWith('@tests:')) {
        currentMultiline = 'tests';
      }
    }
  }

  if (params.length > 0) result.params = params;
  if (returns.length > 0) result.returns = returns;
  if (tests.length > 0) result.tests = tests;

  return result;
}

function parseTags(input: string): string[] {
  // Parse [tag1, tag2, tag3]
  const match = input.match(/\[(.*)\]/);
  if (!match) return [];
  return match[1].split(',').map(t => t.trim());
}

function parseParam(input: string): ModelParam | null {
  // Parse: name: type = default {option1, option2}
  // Or: name: type = default
  // Or: name: type

  const match = input.match(/^(\w+):\s*(\w+(?:\[\])?)\s*(?:=\s*([^{]+))?\s*(?:\{([^}]+)\})?/);
  if (!match) return null;

  const [, name, type, defaultValue, options] = match;

  const param: ModelParam = {
    name: name.trim(),
    type: type.trim() as ModelParam['type'],
  };

  if (defaultValue) {
    param.default = defaultValue.trim();
  }

  if (options) {
    param.options = options.split(',').map(o => o.trim());
  }

  return param;
}

function parseReturnColumn(input: string): ReturnColumn | null {
  // Parse: name: type -- description
  // Or: name: type

  const match = input.match(/^(\w+):\s*(\w+)\s*(?:--\s*(.+))?/);
  if (!match) return null;

  const [, name, type, description] = match;

  const col: ReturnColumn = {
    name: name.trim(),
    type: type.trim(),
  };

  if (description) {
    col.description = description.trim();
  }

  return col;
}
```

**Step 4: Export from index**

Update `packages/query/src/index.ts`:

```typescript
// Dashbook Query Engine
export const VERSION = '0.1.0';

export * from './parser.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/query test`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/query/src/
git commit -m "feat(query): add model metadata parser"
```

---

## Task 3: Implement Date Presets

**Files:**
- Create: `packages/query/src/presets.ts`
- Create: `packages/query/src/__tests__/presets.test.ts`

**Step 1: Write failing tests for date presets**

Create `packages/query/src/__tests__/presets.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expandDatePreset, DATE_PRESETS } from '../presets.js';

describe('expandDatePreset', () => {
  beforeEach(() => {
    // Mock current date to 2026-01-31
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));
  });

  it('expands last_7_days', () => {
    const result = expandDatePreset('last_7_days');
    expect(result.start_date).toBe('2026-01-24');
    expect(result.end_date).toBe('2026-01-31');
  });

  it('expands last_30_days', () => {
    const result = expandDatePreset('last_30_days');
    expect(result.start_date).toBe('2026-01-01');
    expect(result.end_date).toBe('2026-01-31');
  });

  it('expands last_90_days', () => {
    const result = expandDatePreset('last_90_days');
    expect(result.start_date).toBe('2025-11-02');
    expect(result.end_date).toBe('2026-01-31');
  });

  it('expands last_12_months', () => {
    const result = expandDatePreset('last_12_months');
    expect(result.start_date).toBe('2025-01-31');
    expect(result.end_date).toBe('2026-01-31');
  });

  it('expands year_to_date', () => {
    const result = expandDatePreset('year_to_date');
    expect(result.start_date).toBe('2026-01-01');
    expect(result.end_date).toBe('2026-01-31');
  });

  it('expands month_to_date', () => {
    const result = expandDatePreset('month_to_date');
    expect(result.start_date).toBe('2026-01-01');
    expect(result.end_date).toBe('2026-01-31');
  });

  it('expands quarter_to_date', () => {
    const result = expandDatePreset('quarter_to_date');
    expect(result.start_date).toBe('2026-01-01');
    expect(result.end_date).toBe('2026-01-31');
  });

  it('expands previous_month', () => {
    const result = expandDatePreset('previous_month');
    expect(result.start_date).toBe('2025-12-01');
    expect(result.end_date).toBe('2025-12-31');
  });

  it('expands previous_quarter', () => {
    const result = expandDatePreset('previous_quarter');
    expect(result.start_date).toBe('2025-10-01');
    expect(result.end_date).toBe('2025-12-31');
  });

  it('expands previous_year', () => {
    const result = expandDatePreset('previous_year');
    expect(result.start_date).toBe('2025-01-01');
    expect(result.end_date).toBe('2025-12-31');
  });

  it('returns null for unknown preset', () => {
    const result = expandDatePreset('unknown_preset');
    expect(result).toBeNull();
  });

  it('exports list of available presets', () => {
    expect(DATE_PRESETS).toContain('last_7_days');
    expect(DATE_PRESETS).toContain('last_30_days');
    expect(DATE_PRESETS).toContain('year_to_date');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/query test`

Expected: FAIL - cannot find module '../presets.js'

**Step 3: Implement date presets**

Create `packages/query/src/presets.ts`:

```typescript
import {
  subDays,
  subMonths,
  subYears,
  startOfYear,
  startOfMonth,
  startOfQuarter,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
} from 'date-fns';

export interface DateRange {
  start_date: string;
  end_date: string;
}

export const DATE_PRESETS = [
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'last_12_months',
  'year_to_date',
  'month_to_date',
  'quarter_to_date',
  'previous_month',
  'previous_quarter',
  'previous_year',
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number];

const DATE_FORMAT = 'yyyy-MM-dd';

function formatDate(date: Date): string {
  return format(date, DATE_FORMAT);
}

/**
 * Expand a date preset into start_date and end_date.
 * Returns null if preset is not recognized.
 */
export function expandDatePreset(preset: string): DateRange | null {
  const now = new Date();
  const today = formatDate(now);

  switch (preset) {
    case 'last_7_days':
      return {
        start_date: formatDate(subDays(now, 7)),
        end_date: today,
      };

    case 'last_30_days':
      return {
        start_date: formatDate(subDays(now, 30)),
        end_date: today,
      };

    case 'last_90_days':
      return {
        start_date: formatDate(subDays(now, 90)),
        end_date: today,
      };

    case 'last_12_months':
      return {
        start_date: formatDate(subMonths(now, 12)),
        end_date: today,
      };

    case 'year_to_date':
      return {
        start_date: formatDate(startOfYear(now)),
        end_date: today,
      };

    case 'month_to_date':
      return {
        start_date: formatDate(startOfMonth(now)),
        end_date: today,
      };

    case 'quarter_to_date':
      return {
        start_date: formatDate(startOfQuarter(now)),
        end_date: today,
      };

    case 'previous_month': {
      const lastMonth = subMonths(now, 1);
      return {
        start_date: formatDate(startOfMonth(lastMonth)),
        end_date: formatDate(endOfMonth(lastMonth)),
      };
    }

    case 'previous_quarter': {
      const lastQuarter = subMonths(now, 3);
      return {
        start_date: formatDate(startOfQuarter(lastQuarter)),
        end_date: formatDate(endOfQuarter(lastQuarter)),
      };
    }

    case 'previous_year': {
      const lastYear = subYears(now, 1);
      return {
        start_date: formatDate(startOfYear(lastYear)),
        end_date: formatDate(endOfYear(lastYear)),
      };
    }

    default:
      return null;
  }
}

/**
 * Check if a string is a known date preset.
 */
export function isDatePreset(value: string): value is DatePreset {
  return DATE_PRESETS.includes(value as DatePreset);
}
```

**Step 4: Export from index**

Update `packages/query/src/index.ts`:

```typescript
// Dashbook Query Engine
export const VERSION = '0.1.0';

export * from './parser.js';
export * from './presets.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/query test`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/query/src/
git commit -m "feat(query): add date preset expansion"
```

---

## Task 4: Implement Template Renderer

**Files:**
- Create: `packages/query/src/template.ts`
- Create: `packages/query/src/__tests__/template.test.ts`

**Step 1: Write failing tests for template renderer**

Create `packages/query/src/__tests__/template.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderTemplate, createTemplateContext } from '../template.js';

describe('renderTemplate', () => {
  it('substitutes simple variables', () => {
    const sql = "SELECT * FROM orders WHERE date > '{{ start_date }}'";
    const result = renderTemplate(sql, { start_date: '2025-01-01' });
    expect(result).toBe("SELECT * FROM orders WHERE date > '2025-01-01'");
  });

  it('substitutes multiple variables', () => {
    const sql = "WHERE date BETWEEN '{{ start_date }}' AND '{{ end_date }}'";
    const result = renderTemplate(sql, {
      start_date: '2025-01-01',
      end_date: '2025-12-31',
    });
    expect(result).toBe("WHERE date BETWEEN '2025-01-01' AND '2025-12-31'");
  });

  it('handles ref() function', () => {
    const sql = 'SELECT * FROM {{ ref("orders") }}';
    const context = createTemplateContext({}, { orders: 'public.orders' });
    const result = renderTemplate(sql, context);
    expect(result).toBe('SELECT * FROM public.orders');
  });

  it('handles ref() with simple table names', () => {
    const sql = 'SELECT * FROM {{ ref("orders") }} o JOIN {{ ref("customers") }} c ON o.customer_id = c.id';
    const context = createTemplateContext({}, { orders: 'orders', customers: 'customers' });
    const result = renderTemplate(sql, context);
    expect(result).toBe('SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id');
  });

  it('handles conditional blocks', () => {
    const sql = `
SELECT * FROM orders
WHERE 1=1
{% if category %}
  AND category = '{{ category }}'
{% endif %}
`;
    const withCategory = renderTemplate(sql, { category: 'Electronics' });
    expect(withCategory).toContain("AND category = 'Electronics'");

    const withoutCategory = renderTemplate(sql, {});
    expect(withoutCategory).not.toContain('AND category');
  });

  it('handles loops', () => {
    const sql = `
SELECT * FROM orders
WHERE status IN ({% for s in statuses %}'{{ s }}'{% if not loop.last %}, {% endif %}{% endfor %})
`;
    const result = renderTemplate(sql, { statuses: ['pending', 'shipped', 'delivered'] });
    expect(result).toContain("'pending', 'shipped', 'delivered'");
  });

  it('handles default filter', () => {
    const sql = "WHERE region = '{{ region | default(\"US\") }}'";

    const withValue = renderTemplate(sql, { region: 'EU' });
    expect(withValue).toContain("region = 'EU'");

    const withoutValue = renderTemplate(sql, {});
    expect(withoutValue).toContain("region = 'US'");
  });

  it('throws on undefined required variable', () => {
    const sql = "SELECT * FROM {{ undefined_table }}";
    expect(() => renderTemplate(sql, {})).toThrow();
  });
});

describe('createTemplateContext', () => {
  it('merges params with ref function', () => {
    const context = createTemplateContext(
      { start_date: '2025-01-01' },
      { orders: 'public.orders' }
    );

    expect(context.start_date).toBe('2025-01-01');
    expect(context.ref('orders')).toBe('public.orders');
  });

  it('ref throws for unknown model', () => {
    const context = createTemplateContext({}, { orders: 'orders' });
    expect(() => context.ref('unknown')).toThrow('Unknown model reference: unknown');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/query test`

Expected: FAIL - cannot find module '../template.js'

**Step 3: Implement template renderer**

Create `packages/query/src/template.ts`:

```typescript
import nunjucks from 'nunjucks';

// Configure Nunjucks environment
const env = new nunjucks.Environment(null, {
  autoescape: false, // SQL doesn't need HTML escaping
  throwOnUndefined: true, // Fail fast on missing variables
});

export interface TemplateContext {
  [key: string]: unknown;
  ref: (name: string) => string;
}

export interface ModelRefs {
  [modelName: string]: string; // model name -> table/subquery
}

/**
 * Create a template context with parameters and ref() function.
 */
export function createTemplateContext(
  params: Record<string, unknown>,
  refs: ModelRefs = {}
): TemplateContext {
  return {
    ...params,
    ref: (name: string): string => {
      const resolved = refs[name];
      if (resolved === undefined) {
        throw new Error(`Unknown model reference: ${name}`);
      }
      return resolved;
    },
  };
}

/**
 * Render a SQL template with the given context.
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  const rendered = env.renderString(template, context);
  // Clean up extra whitespace from conditionals
  return rendered
    .split('\n')
    .map(line => line.trimEnd())
    .filter((line, i, arr) => {
      // Remove consecutive blank lines
      if (line === '' && arr[i - 1] === '') return false;
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * Check if a template contains a specific variable reference.
 */
export function templateHasVariable(template: string, varName: string): boolean {
  // Match {{ varName }} or {{ varName | filter }}
  const regex = new RegExp(`\\{\\{\\s*${varName}(?:\\s*\\|[^}]+)?\\s*\\}\\}`, 'g');
  return regex.test(template);
}

/**
 * Extract all variable names from a template.
 */
export function extractTemplateVariables(template: string): string[] {
  const variables = new Set<string>();

  // Match {{ variable }} or {{ variable | filter }}
  const regex = /\{\{\s*(\w+)(?:\s*\|[^}]+)?\s*\}\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    const varName = match[1];
    // Exclude built-in functions
    if (varName !== 'ref' && varName !== 'loop') {
      variables.add(varName);
    }
  }

  return Array.from(variables);
}
```

**Step 4: Export from index**

Update `packages/query/src/index.ts`:

```typescript
// Dashbook Query Engine
export const VERSION = '0.1.0';

export * from './parser.js';
export * from './presets.js';
export * from './template.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/query test`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/query/src/
git commit -m "feat(query): add Nunjucks template renderer with ref() support"
```

---

## Task 5: Implement Query Compiler

**Files:**
- Create: `packages/query/src/compiler.ts`
- Create: `packages/query/src/__tests__/compiler.test.ts`

**Step 1: Write failing tests for query compiler**

Create `packages/query/src/__tests__/compiler.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryCompiler } from '../compiler.js';
import type { Chart } from '@dashbook/schema';

describe('QueryCompiler', () => {
  let compiler: QueryCompiler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));

    compiler = new QueryCompiler({
      models: {
        monthly_revenue: {
          metadata: {
            name: 'monthly_revenue',
            params: [
              { name: 'start_date', type: 'date', default: '2025-01-01' },
              { name: 'end_date', type: 'date', default: '2026-01-31' },
            ],
          },
          sql: `
SELECT
  date_trunc('month', order_date) AS period,
  SUM(amount) AS revenue
FROM {{ ref('orders') }}
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
`,
        },
      },
      refs: {
        orders: 'public.orders',
      },
    });
  });

  it('compiles a chart with model reference', () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    const result = compiler.compile(chart, {});

    expect(result.sql).toContain('SELECT');
    expect(result.sql).toContain('public.orders');
    expect(result.sql).toContain("'2025-01-01'");
    expect(result.sql).toContain("'2026-01-31'");
  });

  it('applies parameter overrides', () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    const result = compiler.compile(chart, {
      start_date: '2025-06-01',
      end_date: '2025-12-31',
    });

    expect(result.sql).toContain("'2025-06-01'");
    expect(result.sql).toContain("'2025-12-31'");
  });

  it('expands date presets', () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      parameters: [
        { name: 'date_range', type: 'date_range', default: 'last_30_days' },
      ],
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    const result = compiler.compile(chart, { date_range: 'last_30_days' });

    expect(result.sql).toContain("'2026-01-01'"); // 30 days before 2026-01-31
    expect(result.sql).toContain("'2026-01-31'");
    expect(result.params.start_date).toBe('2026-01-01');
    expect(result.params.end_date).toBe('2026-01-31');
  });

  it('compiles inline SQL', () => {
    const chart: Chart = {
      name: 'quick-query',
      title: 'Quick Query',
      source: {
        sql: "SELECT date, SUM(amount) as total FROM orders WHERE date > '{{ start_date }}' GROUP BY 1",
      },
      chart: {
        type: 'bar',
        x: { field: 'date', type: 'temporal' },
        y: { field: 'total', type: 'quantitative' },
      },
    };

    const result = compiler.compile(chart, { start_date: '2025-01-01' });

    expect(result.sql).toContain("date > '2025-01-01'");
  });

  it('generates cache key', () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    const result1 = compiler.compile(chart, { start_date: '2025-01-01' });
    const result2 = compiler.compile(chart, { start_date: '2025-01-01' });
    const result3 = compiler.compile(chart, { start_date: '2025-06-01' });

    expect(result1.cacheKey).toBe(result2.cacheKey);
    expect(result1.cacheKey).not.toBe(result3.cacheKey);
  });

  it('throws for unknown model', () => {
    const chart: Chart = {
      name: 'bad-chart',
      title: 'Bad Chart',
      source: { model: 'unknown_model' },
      chart: {
        type: 'line',
        x: { field: 'x', type: 'temporal' },
        y: { field: 'y', type: 'quantitative' },
      },
    };

    expect(() => compiler.compile(chart, {})).toThrow('Unknown model: unknown_model');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @dashbook/query test`

Expected: FAIL - cannot find module '../compiler.js'

**Step 3: Implement query compiler**

Create `packages/query/src/compiler.ts`:

```typescript
import type { Chart, Model, ModelMetadata } from '@dashbook/schema';
import { renderTemplate, createTemplateContext, type ModelRefs } from './template.js';
import { expandDatePreset, isDatePreset } from './presets.js';
import { createHash } from 'crypto';

export interface CompiledQuery {
  sql: string;
  params: Record<string, unknown>;
  cacheKey: string;
  chartName: string;
}

export interface CompilerConfig {
  models: Record<string, { metadata: ModelMetadata; sql: string }>;
  refs: ModelRefs;
}

export class QueryCompiler {
  private models: Map<string, { metadata: ModelMetadata; sql: string }>;
  private refs: ModelRefs;

  constructor(config: CompilerConfig) {
    this.models = new Map(Object.entries(config.models));
    this.refs = config.refs;
  }

  /**
   * Compile a chart definition into an executable SQL query.
   */
  compile(chart: Chart, inputParams: Record<string, unknown>): CompiledQuery {
    // Get SQL template
    const { sql, modelParams } = this.getSQL(chart);

    // Merge parameters: model defaults < chart defaults < input params
    const params = this.resolveParams(chart, modelParams, inputParams);

    // Expand date presets
    const expandedParams = this.expandPresets(params);

    // Create template context with params and refs
    const context = createTemplateContext(expandedParams, this.refs);

    // Render template
    const renderedSQL = renderTemplate(sql, context);

    // Generate cache key
    const cacheKey = this.generateCacheKey(chart.name, renderedSQL, expandedParams);

    return {
      sql: renderedSQL,
      params: expandedParams,
      cacheKey,
      chartName: chart.name,
    };
  }

  private getSQL(chart: Chart): { sql: string; modelParams: ModelMetadata['params'] } {
    if (chart.source.sql) {
      return { sql: chart.source.sql, modelParams: undefined };
    }

    if (chart.source.model) {
      const model = this.models.get(chart.source.model);
      if (!model) {
        throw new Error(`Unknown model: ${chart.source.model}`);
      }
      return { sql: model.sql, modelParams: model.metadata.params };
    }

    throw new Error('Chart source must specify either model or sql');
  }

  private resolveParams(
    chart: Chart,
    modelParams: ModelMetadata['params'],
    inputParams: Record<string, unknown>
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Apply model parameter defaults
    if (modelParams) {
      for (const param of modelParams) {
        if (param.default !== undefined) {
          params[param.name] = param.default;
        }
      }
    }

    // Apply chart parameter defaults
    if (chart.parameters) {
      for (const param of chart.parameters) {
        if (param.default !== undefined) {
          params[param.name] = param.default;
        }
      }
    }

    // Apply input params (overrides defaults)
    Object.assign(params, inputParams);

    return params;
  }

  private expandPresets(params: Record<string, unknown>): Record<string, unknown> {
    const expanded: Record<string, unknown> = { ...params };

    // Check for date_range preset and expand it
    if (typeof params.date_range === 'string' && isDatePreset(params.date_range)) {
      const dateRange = expandDatePreset(params.date_range);
      if (dateRange) {
        expanded.start_date = dateRange.start_date;
        expanded.end_date = dateRange.end_date;
      }
    }

    return expanded;
  }

  private generateCacheKey(
    chartName: string,
    sql: string,
    params: Record<string, unknown>
  ): string {
    const sqlHash = createHash('sha256').update(sql).digest('hex').slice(0, 8);
    const paramsHash = createHash('sha256')
      .update(JSON.stringify(params, Object.keys(params).sort()))
      .digest('hex')
      .slice(0, 8);

    return `${chartName}:${sqlHash}:${paramsHash}`;
  }

  /**
   * Add or update a model in the compiler.
   */
  addModel(name: string, metadata: ModelMetadata, sql: string): void {
    this.models.set(name, { metadata, sql });
  }

  /**
   * Add or update a ref mapping.
   */
  addRef(name: string, target: string): void {
    this.refs[name] = target;
  }
}
```

**Step 4: Export from index**

Update `packages/query/src/index.ts`:

```typescript
// Dashbook Query Engine
export const VERSION = '0.1.0';

export * from './parser.js';
export * from './presets.js';
export * from './template.js';
export * from './compiler.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/query test`

Expected: All tests pass.

**Step 6: Commit**

```bash
git add packages/query/src/
git commit -m "feat(query): add query compiler with preset expansion and cache keys"
```

---

## Task 6: Implement DuckDB Connector

**Files:**
- Create: `packages/query/src/connectors/duckdb.ts`
- Create: `packages/query/src/connectors/index.ts`
- Create: `packages/query/src/__tests__/connectors/duckdb.test.ts`

**Step 1: Create connector interface**

Create `packages/query/src/connectors/index.ts`:

```typescript
export interface QueryResult {
  columns: Array<{
    name: string;
    type: string;
  }>;
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  durationMs: number;
}

export interface Connector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute(sql: string): Promise<QueryResult>;
  isConnected(): boolean;
}

export * from './duckdb.js';
```

**Step 2: Write failing tests for DuckDB connector**

Create `packages/query/src/__tests__/connectors/duckdb.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DuckDBConnector } from '../../connectors/duckdb.js';

describe('DuckDBConnector', () => {
  let connector: DuckDBConnector;

  beforeEach(async () => {
    connector = new DuckDBConnector({ path: ':memory:' });
    await connector.connect();
  });

  afterEach(async () => {
    await connector.disconnect();
  });

  it('connects to in-memory database', () => {
    expect(connector.isConnected()).toBe(true);
  });

  it('executes simple query', async () => {
    const result = await connector.execute('SELECT 1 as value');

    expect(result.columns).toHaveLength(1);
    expect(result.columns[0].name).toBe('value');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].value).toBe(1);
    expect(result.rowCount).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('executes query with multiple columns', async () => {
    const result = await connector.execute(`
      SELECT 1 as a, 'hello' as b, 3.14 as c
    `);

    expect(result.columns).toHaveLength(3);
    expect(result.rows[0]).toEqual({ a: 1, b: 'hello', c: 3.14 });
  });

  it('executes query with multiple rows', async () => {
    const result = await connector.execute(`
      SELECT * FROM (VALUES (1, 'a'), (2, 'b'), (3, 'c')) AS t(num, letter)
    `);

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({ num: 1, letter: 'a' });
    expect(result.rows[2]).toEqual({ num: 3, letter: 'c' });
  });

  it('creates and queries tables', async () => {
    await connector.execute(`
      CREATE TABLE orders (
        id INTEGER,
        amount DECIMAL(10,2),
        order_date DATE
      )
    `);

    await connector.execute(`
      INSERT INTO orders VALUES
        (1, 100.00, '2025-01-15'),
        (2, 250.50, '2025-01-20'),
        (3, 75.25, '2025-02-01')
    `);

    const result = await connector.execute(`
      SELECT
        date_trunc('month', order_date) as period,
        SUM(amount) as revenue
      FROM orders
      GROUP BY 1
      ORDER BY 1
    `);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].revenue).toBeCloseTo(350.50);
  });

  it('handles empty result', async () => {
    await connector.execute('CREATE TABLE empty_table (id INTEGER)');
    const result = await connector.execute('SELECT * FROM empty_table');

    expect(result.rows).toHaveLength(0);
    expect(result.rowCount).toBe(0);
  });

  it('throws on invalid SQL', async () => {
    await expect(
      connector.execute('SELECT * FROM nonexistent_table')
    ).rejects.toThrow();
  });

  it('reports duration', async () => {
    const result = await connector.execute('SELECT 1');
    expect(typeof result.durationMs).toBe('number');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm --filter @dashbook/query test`

Expected: FAIL - cannot find module '../../connectors/duckdb.js'

**Step 4: Implement DuckDB connector**

Create `packages/query/src/connectors/duckdb.ts`:

```typescript
import * as duckdb from 'duckdb';
import type { Connector, QueryResult } from './index.js';

export interface DuckDBConfig {
  path: string; // file path or ':memory:'
}

export class DuckDBConnector implements Connector {
  private config: DuckDBConfig;
  private db: duckdb.Database | null = null;
  private connection: duckdb.Connection | null = null;

  constructor(config: DuckDBConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new duckdb.Database(this.config.path, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.connection = this.db!.connect();
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connection) {
        this.connection.close(() => {
          this.connection = null;
        });
      }
      if (this.db) {
        this.db.close(() => {
          this.db = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async execute(sql: string): Promise<QueryResult> {
    if (!this.connection) {
      throw new Error('Not connected to database');
    }

    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      this.connection!.all(sql, (err, rows) => {
        const durationMs = performance.now() - startTime;

        if (err) {
          reject(err);
          return;
        }

        const typedRows = rows as Array<Record<string, unknown>>;
        const columns = this.extractColumns(typedRows);

        resolve({
          columns,
          rows: typedRows,
          rowCount: typedRows.length,
          durationMs,
        });
      });
    });
  }

  isConnected(): boolean {
    return this.connection !== null;
  }

  private extractColumns(rows: Array<Record<string, unknown>>): QueryResult['columns'] {
    if (rows.length === 0) {
      return [];
    }

    const firstRow = rows[0];
    return Object.keys(firstRow).map((name) => ({
      name,
      type: this.inferType(firstRow[name]),
    }));
  }

  private inferType(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    if (typeof value === 'string') return 'string';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    return 'unknown';
  }
}
```

**Step 5: Export from main index**

Update `packages/query/src/index.ts`:

```typescript
// Dashbook Query Engine
export const VERSION = '0.1.0';

export * from './parser.js';
export * from './presets.js';
export * from './template.js';
export * from './compiler.js';
export * from './connectors/index.js';
```

**Step 6: Run tests to verify they pass**

Run: `pnpm --filter @dashbook/query test`

Expected: All tests pass.

**Step 7: Commit**

```bash
git add packages/query/src/
git commit -m "feat(query): add DuckDB connector"
```

---

## Task 7: Create Sample DuckDB Database

**Files:**
- Create: `examples/scripts/seed-data.ts`
- Update: `examples/package.json`

**Step 1: Create examples/package.json**

```json
{
  "name": "@dashbook/examples",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "seed": "tsx scripts/seed-data.ts"
  },
  "devDependencies": {
    "duckdb": "^1.1.0",
    "tsx": "^4.7.0"
  }
}
```

**Step 2: Create examples/scripts/seed-data.ts**

```typescript
import * as duckdb from 'duckdb';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'sample-data.duckdb');

console.log(`Creating sample database at: ${dbPath}`);

const db = new duckdb.Database(dbPath);
const conn = db.connect();

// Create tables
conn.run(`
  CREATE OR REPLACE TABLE customers (
    id INTEGER PRIMARY KEY,
    name VARCHAR,
    email VARCHAR,
    region VARCHAR,
    created_at DATE
  )
`);

conn.run(`
  CREATE OR REPLACE TABLE orders (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    amount DECIMAL(10,2),
    status VARCHAR,
    order_date DATE
  )
`);

conn.run(`
  CREATE OR REPLACE TABLE products (
    id INTEGER PRIMARY KEY,
    name VARCHAR,
    category VARCHAR,
    price DECIMAL(10,2)
  )
`);

// Seed customers
const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
for (let i = 1; i <= 100; i++) {
  const region = regions[Math.floor(Math.random() * regions.length)];
  const createdAt = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
  conn.run(`
    INSERT INTO customers VALUES (
      ${i},
      'Customer ${i}',
      'customer${i}@example.com',
      '${region}',
      '${createdAt.toISOString().split('T')[0]}'
    )
  `);
}

// Seed products
const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books'];
for (let i = 1; i <= 50; i++) {
  const category = categories[Math.floor(Math.random() * categories.length)];
  const price = (Math.random() * 500 + 10).toFixed(2);
  conn.run(`
    INSERT INTO products VALUES (
      ${i},
      'Product ${i}',
      '${category}',
      ${price}
    )
  `);
}

// Seed orders (2 years of data)
const statuses = ['pending', 'shipped', 'delivered', 'cancelled'];
let orderId = 1;
const startDate = new Date(2024, 0, 1);
const endDate = new Date(2026, 0, 31);

for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  // Random number of orders per day (5-20)
  const ordersPerDay = Math.floor(Math.random() * 16) + 5;

  for (let i = 0; i < ordersPerDay; i++) {
    const customerId = Math.floor(Math.random() * 100) + 1;
    const amount = (Math.random() * 1000 + 20).toFixed(2);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const orderDate = d.toISOString().split('T')[0];

    conn.run(`
      INSERT INTO orders VALUES (
        ${orderId++},
        ${customerId},
        ${amount},
        '${status}',
        '${orderDate}'
      )
    `);
  }
}

console.log(`Seeded ${orderId - 1} orders`);

// Verify data
conn.all('SELECT COUNT(*) as count FROM customers', (err, rows) => {
  console.log(`Customers: ${(rows as any)[0].count}`);
});

conn.all('SELECT COUNT(*) as count FROM orders', (err, rows) => {
  console.log(`Orders: ${(rows as any)[0].count}`);
});

conn.all('SELECT COUNT(*) as count FROM products', (err, rows) => {
  console.log(`Products: ${(rows as any)[0].count}`);
});

conn.all(`
  SELECT
    date_trunc('month', order_date) as month,
    SUM(amount) as revenue
  FROM orders
  WHERE order_date >= '2025-01-01'
  GROUP BY 1
  ORDER BY 1
  LIMIT 5
`, (err, rows) => {
  console.log('\nSample revenue data:');
  console.table(rows);

  conn.close(() => {
    db.close(() => {
      console.log('\nDatabase created successfully!');
    });
  });
});
```

**Step 3: Install dependencies and run seed**

Run: `pnpm install && pnpm --filter @dashbook/examples seed`

Expected: Database created with sample data.

**Step 4: Add sample-data.duckdb to .gitignore**

Update `.gitignore` to add:

```
# Sample data (generated)
examples/sample-data.duckdb
```

**Step 5: Commit**

```bash
git add examples/ .gitignore
git commit -m "feat: add sample data seeding script for examples"
```

---

## Task 8: Integration Test - Full Compilation Pipeline

**Files:**
- Create: `packages/query/src/__tests__/integration.test.ts`

**Step 1: Write integration test**

Create `packages/query/src/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { QueryCompiler } from '../compiler.js';
import { parseModelMetadata } from '../parser.js';
import { DuckDBConnector } from '../connectors/duckdb.js';
import type { Chart } from '@dashbook/schema';

describe('Query Engine Integration', () => {
  let connector: DuckDBConnector;
  let compiler: QueryCompiler;

  beforeAll(async () => {
    // Create in-memory DuckDB with test data
    connector = new DuckDBConnector({ path: ':memory:' });
    await connector.connect();

    // Create test table
    await connector.execute(`
      CREATE TABLE orders (
        id INTEGER,
        amount DECIMAL(10,2),
        order_date DATE
      )
    `);

    // Insert test data
    await connector.execute(`
      INSERT INTO orders VALUES
        (1, 100.00, '2025-01-15'),
        (2, 200.00, '2025-01-20'),
        (3, 150.00, '2025-02-10'),
        (4, 300.00, '2025-02-15'),
        (5, 250.00, '2025-03-01')
    `);
  });

  afterAll(async () => {
    await connector.disconnect();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-15T12:00:00Z'));

    // Parse model from SQL
    const modelSQL = `
-- @name: monthly_revenue
-- @description: Monthly revenue aggregation
-- @param start_date: date = '2025-01-01'
-- @param end_date: date = '2025-12-31'

SELECT
  date_trunc('month', order_date) AS period,
  SUM(amount) AS revenue,
  COUNT(*) AS order_count
FROM orders
WHERE order_date BETWEEN '{{ start_date }}' AND '{{ end_date }}'
GROUP BY 1
ORDER BY 1
`;

    const parsed = parseModelMetadata(modelSQL);

    compiler = new QueryCompiler({
      models: {
        monthly_revenue: {
          metadata: {
            name: parsed.name!,
            params: parsed.params,
          },
          sql: parsed.sql,
        },
      },
      refs: {
        orders: 'orders',
      },
    });
  });

  it('compiles and executes chart query', async () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    // Compile
    const compiled = compiler.compile(chart, {});

    // Execute
    const result = await connector.execute(compiled.sql);

    // Verify
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.columns.map(c => c.name)).toContain('period');
    expect(result.columns.map(c => c.name)).toContain('revenue');
  });

  it('applies date filter parameters', async () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    // Compile with specific date range
    const compiled = compiler.compile(chart, {
      start_date: '2025-01-01',
      end_date: '2025-01-31',
    });

    // Execute
    const result = await connector.execute(compiled.sql);

    // Should only have January data
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].revenue).toBeCloseTo(300.00);
    expect(result.rows[0].order_count).toBe(2);
  });

  it('handles date preset expansion', async () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      parameters: [
        { name: 'date_range', type: 'date_range', default: 'last_30_days' },
      ],
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    // Compile with preset (mocked date is 2025-03-15)
    const compiled = compiler.compile(chart, { date_range: 'last_30_days' });

    // Verify dates are expanded
    expect(compiled.params.start_date).toBe('2025-02-13');
    expect(compiled.params.end_date).toBe('2025-03-15');

    // Execute
    const result = await connector.execute(compiled.sql);

    // Should have February and March data
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('generates consistent cache keys', () => {
    const chart: Chart = {
      name: 'revenue-trend',
      title: 'Revenue Trend',
      source: { model: 'monthly_revenue' },
      chart: {
        type: 'line',
        x: { field: 'period', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    const params = { start_date: '2025-01-01', end_date: '2025-03-31' };

    const compiled1 = compiler.compile(chart, params);
    const compiled2 = compiler.compile(chart, params);
    const compiled3 = compiler.compile(chart, { ...params, end_date: '2025-06-30' });

    expect(compiled1.cacheKey).toBe(compiled2.cacheKey);
    expect(compiled1.cacheKey).not.toBe(compiled3.cacheKey);
  });
});
```

**Step 2: Run integration tests**

Run: `pnpm --filter @dashbook/query test`

Expected: All tests pass including integration tests.

**Step 3: Commit**

```bash
git add packages/query/src/__tests__/
git commit -m "test(query): add integration tests for full compilation pipeline"
```

---

## Task 9: Final Build and Push

**Step 1: Run full build**

Run: `pnpm build`

Expected: All packages build successfully.

**Step 2: Run all tests**

Run: `pnpm test`

Expected: All tests pass.

**Step 3: Push to remote**

```bash
git push origin main
```

---

## Summary

After completing these tasks, you will have:

1. **Query package** with full test coverage:
   - `parseModelMetadata()` - Extract metadata from SQL comments
   - `expandDatePreset()` - Convert presets like `last_30_days` to dates
   - `renderTemplate()` - Nunjucks templating with `ref()` support
   - `QueryCompiler` - Full compilation pipeline with caching
   - `DuckDBConnector` - Execute queries against DuckDB

2. **Sample data** - Seeding script for development/testing

3. **Integration tests** - Full pipeline from chart config to query results

Next phase will implement the API server in `apps/server`.
