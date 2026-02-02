import { readFile, readdir, access } from 'fs/promises';
import { join, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import { watch, type FSWatcher } from 'chokidar';
import {
  ProjectSchema,
  ConnectionSchema,
  ChartSchema,
  DashboardSchema,
  type Project,
  type Connection,
  type Chart,
  type Dashboard,
  type ModelMetadata,
} from '@dashbook/schema';
import { parseModelMetadata } from '@dashbook/query';

export interface LoadedModel {
  metadata: ModelMetadata;
  sql: string;
  filePath: string;
}

export class ConfigLoader {
  private projectDir: string;
  private project: Project | null = null;
  private connections: Map<string, Connection> = new Map();
  private charts: Map<string, Chart> = new Map();
  private models: Map<string, LoadedModel> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private watcher: FSWatcher | null = null;
  private onChangeCallbacks: Array<() => void> = [];

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  async load(): Promise<void> {
    await this.loadProject();
    await this.loadConnections();
    await this.loadCharts();
    await this.loadModels();
    await this.loadDashboards();
  }

  private async loadProject(): Promise<void> {
    const projectPath = join(this.projectDir, 'dashbook.yaml');

    try {
      await access(projectPath);
    } catch {
      throw new Error('dashbook.yaml not found');
    }

    const content = await readFile(projectPath, 'utf-8');
    const parsed = parseYaml(content);
    const result = ProjectSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Invalid dashbook.yaml: ${result.error.message}`);
    }

    this.project = result.data;
  }

  private async loadConnections(): Promise<void> {
    const connectionsDir = join(this.projectDir, 'connections');

    try {
      await access(connectionsDir);
    } catch {
      return; // No connections directory is ok
    }

    const files = await readdir(connectionsDir);

    for (const file of files) {
      if (extname(file) !== '.yaml' && extname(file) !== '.yml') continue;

      const filePath = join(connectionsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseYaml(content);
      const result = ConnectionSchema.safeParse(parsed);

      if (result.success) {
        this.connections.set(result.data.name, result.data);
      } else {
        console.warn(`Invalid connection file ${file}: ${result.error.message}`);
      }
    }
  }

  private async loadCharts(): Promise<void> {
    const chartsDir = join(this.projectDir, 'charts');

    try {
      await access(chartsDir);
    } catch {
      return; // No charts directory is ok
    }

    const files = await readdir(chartsDir);

    for (const file of files) {
      if (extname(file) !== '.yaml' && extname(file) !== '.yml') continue;

      const filePath = join(chartsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseYaml(content);
      const result = ChartSchema.safeParse(parsed);

      if (result.success) {
        this.charts.set(result.data.name, result.data);
      } else {
        console.warn(`Invalid chart file ${file}: ${result.error.message}`);
      }
    }
  }

  private async loadModels(): Promise<void> {
    const modelsDir = join(this.projectDir, 'models');

    try {
      await access(modelsDir);
    } catch {
      return; // No models directory is ok
    }

    await this.loadModelsFromDir(modelsDir);
  }

  private async loadModelsFromDir(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.loadModelsFromDir(fullPath);
      } else if (extname(entry.name) === '.sql') {
        const content = await readFile(fullPath, 'utf-8');

        try {
          const parsed = parseModelMetadata(content);
          this.models.set(parsed.name, {
            metadata: parsed,
            sql: parsed.sql,
            filePath: fullPath,
          });
        } catch (err) {
          console.warn(`Invalid model file ${entry.name}: ${err}`);
        }
      }
    }
  }

  private async loadDashboards(): Promise<void> {
    const dashboardsDir = join(this.projectDir, 'dashboards');

    try {
      await access(dashboardsDir);
    } catch {
      return; // No dashboards directory is ok
    }

    const files = await readdir(dashboardsDir);

    for (const file of files) {
      if (extname(file) !== '.yaml' && extname(file) !== '.yml') continue;

      const filePath = join(dashboardsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseYaml(content);
      const result = DashboardSchema.safeParse(parsed);

      if (result.success) {
        this.dashboards.set(result.data.name, result.data);
      } else {
        console.warn(`Invalid dashboard file ${file}: ${result.error.message}`);
      }
    }
  }

  startWatching(): void {
    if (this.watcher) return;

    this.watcher = watch(this.projectDir, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('change', async (path) => {
      console.log(`File changed: ${path}`);
      await this.reload();
    });

    this.watcher.on('add', async (path) => {
      console.log(`File added: ${path}`);
      await this.reload();
    });

    this.watcher.on('unlink', async (path) => {
      console.log(`File removed: ${path}`);
      await this.reload();
    });
  }

  private async reload(): Promise<void> {
    try {
      this.connections.clear();
      this.charts.clear();
      this.models.clear();
      this.dashboards.clear();
      await this.load();

      for (const callback of this.onChangeCallbacks) {
        callback();
      }
    } catch (err) {
      console.error('Error reloading config:', err);
    }
  }

  onChange(callback: () => void): void {
    this.onChangeCallbacks.push(callback);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  getProject(): Project {
    if (!this.project) {
      throw new Error('Config not loaded');
    }
    return this.project;
  }

  getConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  getConnectionByName(name: string): Connection | undefined {
    return this.connections.get(name);
  }

  getCharts(): Chart[] {
    return Array.from(this.charts.values());
  }

  getChartByName(name: string): Chart | undefined {
    return this.charts.get(name);
  }

  getModels(): LoadedModel[] {
    return Array.from(this.models.values());
  }

  getModelByName(name: string): LoadedModel | undefined {
    return this.models.get(name);
  }

  getDefaultConnection(): Connection | undefined {
    const defaultName = this.project?.defaults?.connection;
    if (defaultName) {
      return this.connections.get(defaultName);
    }
    // Return first connection if no default specified
    return this.connections.values().next().value;
  }

  getDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  getDashboardByName(name: string): Dashboard | undefined {
    return this.dashboards.get(name);
  }
}
