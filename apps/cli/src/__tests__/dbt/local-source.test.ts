import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { LocalDbtSource } from '../../dbt/local-source.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_PATH = join(__dirname, '../../__fixtures__/dbt-project');

describe('LocalDbtSource', () => {
  let source: LocalDbtSource;

  beforeAll(() => {
    source = new LocalDbtSource(FIXTURE_PATH);
  });

  describe('getProjectConfig', () => {
    it('reads dbt_project.yml', async () => {
      const config = await source.getProjectConfig();

      expect(config.name).toBe('test_project');
      expect(config.version).toBe('1.0.0');
      expect(config.profile).toBe('test');
      expect(config.model_paths).toEqual(['models']);
    });

    it('throws if dbt_project.yml not found', async () => {
      const badSource = new LocalDbtSource('/nonexistent/path');
      await expect(badSource.getProjectConfig()).rejects.toThrow();
    });
  });

  describe('listModels', () => {
    it('lists all models from schema files', async () => {
      const models = await source.listModels();

      expect(models.length).toBe(3);
      expect(models.map((m) => m.name).sort()).toEqual([
        'customers',
        'orders',
        'stg_orders',
      ]);
    });

    it('includes paths relative to project root', async () => {
      const models = await source.listModels();
      const orders = models.find((m) => m.name === 'orders');

      expect(orders?.path).toBe('models/marts/orders.sql');
    });

    it('includes descriptions and tags', async () => {
      const models = await source.listModels();
      const orders = models.find((m) => m.name === 'orders');

      expect(orders?.description).toBe('Daily order transactions');
      expect(orders?.tags).toEqual(['bi', 'finance']);
    });
  });

  describe('getModel', () => {
    it('returns full model details', async () => {
      const model = await source.getModel('orders');

      expect(model.name).toBe('orders');
      expect(model.description).toBe('Daily order transactions');
      expect(model.path).toBe('models/marts/orders.sql');
      expect(model.tags).toEqual(['bi', 'finance']);
      expect(model.meta).toEqual({ yamchart: true });
    });

    it('includes column hints from tests', async () => {
      const model = await source.getModel('orders');

      const orderIdCol = model.columns.find((c) => c.name === 'order_id');
      expect(orderIdCol?.hints).toContain('unique');
      expect(orderIdCol?.hints).toContain('required');

      const customerIdCol = model.columns.find((c) => c.name === 'customer_id');
      expect(customerIdCol?.hints).toContain('required');
      expect(customerIdCol?.hints).toContain('fk:customers');
    });

    it('throws for nonexistent model', async () => {
      await expect(source.getModel('nonexistent')).rejects.toThrow(
        'Model not found: nonexistent'
      );
    });
  });

  describe('getModels', () => {
    it('returns multiple models by name', async () => {
      const models = await source.getModels(['orders', 'customers']);

      expect(models.length).toBe(2);
      expect(models.map((m) => m.name).sort()).toEqual(['customers', 'orders']);
    });

    it('returns empty array for empty input', async () => {
      const models = await source.getModels([]);
      expect(models).toEqual([]);
    });

    it('throws if any model not found', async () => {
      await expect(
        source.getModels(['orders', 'nonexistent'])
      ).rejects.toThrow('Model not found: nonexistent');
    });
  });

  describe('filterModels', () => {
    it('filters by include pattern', async () => {
      const models = await source.listModels();
      const filtered = LocalDbtSource.filterModels(models, {
        include: ['**/marts/*'],
      });

      expect(filtered.map((m) => m.name).sort()).toEqual([
        'customers',
        'orders',
      ]);
    });

    it('filters by exclude pattern', async () => {
      const models = await source.listModels();
      const filtered = LocalDbtSource.filterModels(models, {
        exclude: ['**/staging/*'],
      });

      expect(filtered.map((m) => m.name).sort()).toEqual([
        'customers',
        'orders',
      ]);
    });

    it('filters by tag', async () => {
      const models = await source.listModels();
      const filtered = LocalDbtSource.filterModels(models, {
        tags: ['finance'],
      });

      expect(filtered.map((m) => m.name)).toEqual(['orders']);
    });

    it('combines include and exclude filters', async () => {
      const models = await source.listModels();
      const filtered = LocalDbtSource.filterModels(models, {
        include: ['**/*'],
        exclude: ['**/staging/*'],
      });

      expect(filtered.map((m) => m.name).sort()).toEqual([
        'customers',
        'orders',
      ]);
    });

    it('combines pattern and tag filters', async () => {
      const models = await source.listModels();
      const filtered = LocalDbtSource.filterModels(models, {
        include: ['**/marts/*'],
        tags: ['bi'],
      });

      // Both orders and customers have 'bi' tag
      expect(filtered.map((m) => m.name).sort()).toEqual([
        'customers',
        'orders',
      ]);
    });

    it('returns all models with no filters', async () => {
      const models = await source.listModels();
      const filtered = LocalDbtSource.filterModels(models, {});

      expect(filtered.length).toBe(3);
    });
  });

  describe('getDefaultFilters', () => {
    it('returns smart defaults for marts/reporting paths', () => {
      const defaults = LocalDbtSource.getDefaultFilters();

      expect(defaults.include).toContain('**/marts/**');
      expect(defaults.include).toContain('**/reporting/**');
      expect(defaults.exclude).toContain('**/staging/**');
      expect(defaults.exclude).toContain('**/intermediate/**');
    });
  });
});
