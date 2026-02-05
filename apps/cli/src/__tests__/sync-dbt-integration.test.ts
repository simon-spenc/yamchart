import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { syncDbt, type SyncDbtOptions } from '../commands/sync-dbt.js';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Integration tests for sync-dbt command with realistic dbt project structure.
 *
 * These tests simulate a real-world setup where:
 * - A yamchart project has models that reference dbt tables
 * - A dbt project has staging, intermediate, and marts folders
 * - Models have tags, columns, and test definitions
 */
describe('sync-dbt integration', () => {
  let baseDir: string;
  let yamchartDir: string;
  let dbtDir: string;

  beforeEach(async () => {
    baseDir = join(tmpdir(), `yamchart-sync-integration-${Date.now()}`);
    yamchartDir = join(baseDir, 'yamchart-project');
    dbtDir = join(baseDir, 'dbt-project');

    // Create yamchart project structure
    await mkdir(join(yamchartDir, 'models'), { recursive: true });
    await mkdir(join(yamchartDir, 'charts'), { recursive: true });
    await writeFile(
      join(yamchartDir, 'yamchart.yaml'),
      `version: "1.0"
name: analytics-dashboard
description: Dashboard using dbt marts
`
    );

    // Create yamchart models that reference dbt tables
    await writeFile(
      join(yamchartDir, 'models', 'revenue_by_month.sql'),
      `-- @name: revenue_by_month
-- @description: Monthly revenue from orders mart
-- @source: orders

SELECT
  DATE_TRUNC('month', order_date) as month,
  SUM(total_amount) as revenue
FROM {{ ref('orders') }}
WHERE order_date >= '{{ start_date }}'
GROUP BY 1
ORDER BY 1
`
    );

    await writeFile(
      join(yamchartDir, 'models', 'customer_segments.sql'),
      `-- @name: customer_segments
-- @description: Customer segmentation analysis
-- @source: customers

SELECT
  segment,
  COUNT(*) as customer_count,
  AVG(lifetime_value) as avg_ltv
FROM {{ ref('customers') }}
GROUP BY 1
`
    );

    // Create realistic dbt project structure
    await mkdir(join(dbtDir, 'models', 'staging', 'stripe'), { recursive: true });
    await mkdir(join(dbtDir, 'models', 'staging', 'shopify'), { recursive: true });
    await mkdir(join(dbtDir, 'models', 'intermediate'), { recursive: true });
    await mkdir(join(dbtDir, 'models', 'marts', 'core'), { recursive: true });
    await mkdir(join(dbtDir, 'models', 'marts', 'finance'), { recursive: true });
    await mkdir(join(dbtDir, 'models', 'reporting'), { recursive: true });

    // dbt_project.yml
    await writeFile(
      join(dbtDir, 'dbt_project.yml'),
      `name: ecommerce_analytics
version: "1.0.0"
profile: ecommerce
model-paths: ["models"]
target-path: "target"
clean-targets:
  - "target"
  - "dbt_packages"
`
    );

    // Staging models - should be excluded by default
    await writeFile(
      join(dbtDir, 'models', 'staging', 'stripe', '_schema.yml'),
      `version: 2

models:
  - name: stg_stripe_payments
    description: Staged Stripe payment records
    tags:
      - staging
      - stripe
    columns:
      - name: payment_id
        description: Unique payment identifier
        tests:
          - unique
          - not_null
      - name: amount
        description: Payment amount in cents
`
    );

    await writeFile(
      join(dbtDir, 'models', 'staging', 'shopify', '_schema.yml'),
      `version: 2

models:
  - name: stg_shopify_orders
    description: Staged Shopify order records
    tags:
      - staging
      - shopify
    columns:
      - name: order_id
        description: Unique order identifier
        tests:
          - unique
          - not_null
`
    );

    // Intermediate models - should be excluded by default
    await writeFile(
      join(dbtDir, 'models', 'intermediate', '_schema.yml'),
      `version: 2

models:
  - name: int_orders_enriched
    description: Orders enriched with payment and customer data
    tags:
      - intermediate
    columns:
      - name: order_id
        tests:
          - unique
`
    );

    // Marts models - should be included by default
    await writeFile(
      join(dbtDir, 'models', 'marts', 'core', '_schema.yml'),
      `version: 2

models:
  - name: orders
    description: Core orders mart with all order details
    tags:
      - marts
      - core
      - bi-ready
    meta:
      owner: data-team
    columns:
      - name: order_id
        description: Primary key
        data_type: integer
        tests:
          - unique
          - not_null
      - name: customer_id
        description: Foreign key to customers
        data_type: integer
        tests:
          - not_null
          - relationships:
              to: ref('customers')
              field: customer_id
      - name: order_date
        description: Date the order was placed
        data_type: date
        tests:
          - not_null
      - name: total_amount
        description: Total order value
        data_type: decimal

  - name: customers
    description: Core customers mart with customer details
    tags:
      - marts
      - core
      - bi-ready
    columns:
      - name: customer_id
        description: Primary key
        data_type: integer
        tests:
          - unique
          - not_null
      - name: email
        description: Customer email address
        tests:
          - unique
      - name: segment
        description: Customer segment
      - name: lifetime_value
        description: Total customer spend
        data_type: decimal
`
    );

    await writeFile(
      join(dbtDir, 'models', 'marts', 'finance', '_schema.yml'),
      `version: 2

models:
  - name: monthly_revenue
    description: Monthly revenue aggregation
    tags:
      - marts
      - finance
      - bi-ready
    columns:
      - name: month
        description: Month of revenue
        data_type: date
        tests:
          - unique
          - not_null
      - name: revenue
        description: Total revenue for the month
        data_type: decimal
`
    );

    // Reporting models - should also be included by default
    await writeFile(
      join(dbtDir, 'models', 'reporting', '_schema.yml'),
      `version: 2

models:
  - name: executive_dashboard
    description: Executive-level KPIs
    tags:
      - reporting
      - executive
    columns:
      - name: metric_date
        data_type: date
      - name: total_orders
        data_type: integer
      - name: total_revenue
        data_type: decimal
`
    );
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('syncs with smart defaults filtering staging and intermediate models', async () => {
    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: [],
      exclude: [],
      tags: [],
    };

    const result = await syncDbt(yamchartDir, options);

    expect(result.success).toBe(true);

    // Read catalog to verify filtering
    const catalogJson = await readFile(
      join(yamchartDir, '.yamchart', 'catalog.json'),
      'utf-8'
    );
    const catalog = JSON.parse(catalogJson);

    // Should include marts and reporting models
    const modelNames = catalog.models.map((m: { name: string }) => m.name);
    expect(modelNames).toContain('orders');
    expect(modelNames).toContain('customers');
    expect(modelNames).toContain('monthly_revenue');
    expect(modelNames).toContain('executive_dashboard');

    // Should exclude staging and intermediate models
    expect(modelNames).not.toContain('stg_stripe_payments');
    expect(modelNames).not.toContain('stg_shopify_orders');
    expect(modelNames).not.toContain('int_orders_enriched');

    // Verify stats
    expect(result.modelsIncluded).toBe(4);
    expect(result.modelsExcluded).toBe(3);
  });

  it('cross-references yamchart models using dbt tables', async () => {
    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: [],
      exclude: [],
      tags: [],
    };

    await syncDbt(yamchartDir, options);

    // Read catalog and check cross-references
    const catalogJson = await readFile(
      join(yamchartDir, '.yamchart', 'catalog.json'),
      'utf-8'
    );
    const catalog = JSON.parse(catalogJson);

    // Find the orders model
    const ordersModel = catalog.models.find(
      (m: { name: string }) => m.name === 'orders'
    );
    expect(ordersModel).toBeDefined();

    // Should show yamchart models that reference it
    expect(ordersModel.yamchartModels).toHaveLength(1);
    expect(ordersModel.yamchartModels[0].name).toBe('revenue_by_month');
    expect(ordersModel.yamchartModels[0].source).toBe('orders');

    // Find the customers model
    const customersModel = catalog.models.find(
      (m: { name: string }) => m.name === 'customers'
    );
    expect(customersModel).toBeDefined();
    expect(customersModel.yamchartModels).toHaveLength(1);
    expect(customersModel.yamchartModels[0].name).toBe('customer_segments');

    // Check markdown also contains the reference
    const catalogMd = await readFile(
      join(yamchartDir, '.yamchart', 'catalog.md'),
      'utf-8'
    );
    expect(catalogMd).toContain('revenue_by_month');
    expect(catalogMd).toContain('customer_segments');
  });

  it('includes column hints from dbt tests', async () => {
    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: [],
      exclude: [],
      tags: [],
    };

    await syncDbt(yamchartDir, options);

    const catalogJson = await readFile(
      join(yamchartDir, '.yamchart', 'catalog.json'),
      'utf-8'
    );
    const catalog = JSON.parse(catalogJson);

    // Find the orders model
    const ordersModel = catalog.models.find(
      (m: { name: string }) => m.name === 'orders'
    );

    // Check column hints
    const orderIdCol = ordersModel.columns.find(
      (c: { name: string }) => c.name === 'order_id'
    );
    expect(orderIdCol.hints).toContain('unique');
    expect(orderIdCol.hints).toContain('required');

    const customerIdCol = ordersModel.columns.find(
      (c: { name: string }) => c.name === 'customer_id'
    );
    expect(customerIdCol.hints).toContain('required');
    expect(customerIdCol.hints).toContain('fk:customers');

    // Check customers model
    const customersModel = catalog.models.find(
      (m: { name: string }) => m.name === 'customers'
    );
    const emailCol = customersModel.columns.find(
      (c: { name: string }) => c.name === 'email'
    );
    expect(emailCol.hints).toContain('unique');

    // Verify hints are in markdown
    const catalogMd = await readFile(
      join(yamchartDir, '.yamchart', 'catalog.md'),
      'utf-8'
    );
    expect(catalogMd).toContain('unique');
    expect(catalogMd).toContain('required');
    expect(catalogMd).toContain('fk:customers');
  });

  it('supports --refresh to re-sync with saved config', async () => {
    // First sync with explicit filters
    const initialOptions: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: ['**/marts/core/**'],
      exclude: [],
      tags: [],
    };

    const firstResult = await syncDbt(yamchartDir, initialOptions);
    expect(firstResult.success).toBe(true);
    expect(firstResult.modelsIncluded).toBe(2); // orders and customers

    // Verify config was saved
    const savedConfig = await readFile(
      join(yamchartDir, '.yamchart', 'dbt-source.yaml'),
      'utf-8'
    );
    expect(savedConfig).toContain('source: local');
    expect(savedConfig).toContain('**/marts/core/**');

    // Now refresh without specifying options again
    const refreshOptions: SyncDbtOptions = {
      source: 'local',
      include: [],
      exclude: [],
      tags: [],
      refresh: true,
    };

    const refreshResult = await syncDbt(yamchartDir, refreshOptions);
    expect(refreshResult.success).toBe(true);
    expect(refreshResult.modelsIncluded).toBe(2); // Same filter applied

    // Verify catalog still has only core models
    const catalogJson = await readFile(
      join(yamchartDir, '.yamchart', 'catalog.json'),
      'utf-8'
    );
    const catalog = JSON.parse(catalogJson);
    const modelNames = catalog.models.map((m: { name: string }) => m.name);
    expect(modelNames).toContain('orders');
    expect(modelNames).toContain('customers');
    expect(modelNames).not.toContain('monthly_revenue');
    expect(modelNames).not.toContain('executive_dashboard');
  });

  it('returns error when refresh mode used without saved config', async () => {
    const refreshOptions: SyncDbtOptions = {
      source: 'local',
      include: [],
      exclude: [],
      tags: [],
      refresh: true,
    };

    const result = await syncDbt(yamchartDir, refreshOptions);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No saved sync config found');
  });

  it('filters by tag when specified', async () => {
    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: [], // No path filter
      exclude: [],
      tags: ['bi-ready'], // Only models tagged bi-ready
    };

    const result = await syncDbt(yamchartDir, options);
    expect(result.success).toBe(true);

    const catalogJson = await readFile(
      join(yamchartDir, '.yamchart', 'catalog.json'),
      'utf-8'
    );
    const catalog = JSON.parse(catalogJson);
    const modelNames = catalog.models.map((m: { name: string }) => m.name);

    // Only bi-ready tagged models
    expect(modelNames).toContain('orders');
    expect(modelNames).toContain('customers');
    expect(modelNames).toContain('monthly_revenue');
    expect(modelNames).toHaveLength(3);

    // Not executive_dashboard (no bi-ready tag)
    expect(modelNames).not.toContain('executive_dashboard');
  });

  it('filters by tag for staging models', async () => {
    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: [],
      exclude: [],
      tags: ['stripe'], // Only stripe-tagged models
    };

    const result = await syncDbt(yamchartDir, options);
    expect(result.success).toBe(true);

    const catalogJson = await readFile(
      join(yamchartDir, '.yamchart', 'catalog.json'),
      'utf-8'
    );
    const catalog = JSON.parse(catalogJson);
    const modelNames = catalog.models.map((m: { name: string }) => m.name);

    // Only stripe tagged model
    expect(modelNames).toContain('stg_stripe_payments');
    expect(modelNames).toHaveLength(1);
  });

  it('combines include patterns with exclude patterns', async () => {
    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: ['**/marts/**'], // All marts
      exclude: ['**/finance/**'], // But not finance
      tags: [],
    };

    const result = await syncDbt(yamchartDir, options);
    expect(result.success).toBe(true);

    const catalogJson = await readFile(
      join(yamchartDir, '.yamchart', 'catalog.json'),
      'utf-8'
    );
    const catalog = JSON.parse(catalogJson);
    const modelNames = catalog.models.map((m: { name: string }) => m.name);

    // Should include core marts
    expect(modelNames).toContain('orders');
    expect(modelNames).toContain('customers');

    // Should exclude finance marts
    expect(modelNames).not.toContain('monthly_revenue');
  });

  it('generates valid markdown with model details', async () => {
    const options: SyncDbtOptions = {
      source: 'local',
      path: dbtDir,
      include: ['**/marts/core/**'],
      exclude: [],
      tags: [],
    };

    await syncDbt(yamchartDir, options);

    const catalogMd = await readFile(
      join(yamchartDir, '.yamchart', 'catalog.md'),
      'utf-8'
    );

    // Check header
    expect(catalogMd).toContain('# Data Catalog');
    expect(catalogMd).toContain('Source: local:');
    expect(catalogMd).toContain('Last synced:');

    // Check model sections
    expect(catalogMd).toContain('### orders');
    expect(catalogMd).toContain('Core orders mart');
    expect(catalogMd).toContain('**Tags:** `marts`, `core`, `bi-ready`');

    // Check column table
    expect(catalogMd).toContain('| Column | Type | Description | Hints |');
    expect(catalogMd).toContain('| order_id | integer | Primary key | unique, required |');
    expect(catalogMd).toContain('| customer_id | integer | Foreign key to customers | required, fk:customers |');

    // Check yamchart references section
    expect(catalogMd).toContain('**Yamchart models:**');
    expect(catalogMd).toContain('[`revenue_by_month`]');
  });
});
