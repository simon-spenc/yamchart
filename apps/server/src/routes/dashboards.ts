import type { FastifyInstance } from 'fastify';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { stringify as stringifyYaml } from 'yaml';
import type { ConfigLoader } from '../services/config-loader.js';
import type { GitService } from '../services/git-service.js';
import type { QueryService } from '../services/query-service.js';
import type { DashboardLayout } from '@yamchart/schema';

export interface DashboardRoutesOptions {
  configLoader: ConfigLoader;
  gitService: GitService;
  projectDir: string;
  queryService?: QueryService;
}

export async function dashboardRoutes(
  fastify: FastifyInstance,
  options: DashboardRoutesOptions
) {
  const { configLoader, gitService, projectDir } = options;

  // List all dashboards
  fastify.get('/api/dashboards', async () => {
    const dashboards = configLoader.getDashboards();
    return dashboards.map((d) => ({
      name: d.name,
      title: d.title,
      description: d.description,
    }));
  });

  // Get dashboard by name
  fastify.get<{ Params: { id: string }; Querystring: { branch?: string } }>(
    '/api/dashboards/:id',
    async (request, reply) => {
      const { id } = request.params;
      const dashboard = configLoader.getDashboardByName(id);

      if (!dashboard) {
        return reply.status(404).send({ error: `Dashboard not found: ${id}` });
      }

      const currentBranch = await gitService.getCurrentBranch();

      return {
        ...dashboard,
        branch: currentBranch,
      };
    }
  );

  // Save dashboard layout
  fastify.post<{
    Params: { id: string };
    Body: { layout: DashboardLayout; message?: string };
  }>('/api/dashboards/:id', async (request, reply) => {
    const { id } = request.params;
    const { layout, message } = request.body;

    const dashboard = configLoader.getDashboardByName(id);
    if (!dashboard) {
      return reply.status(404).send({ error: `Dashboard not found: ${id}` });
    }

    // Update dashboard with new layout
    const updated = { ...dashboard, layout };

    // Write to file
    const filePath = join(projectDir, 'dashboards', `${id}.yaml`);
    await writeFile(filePath, stringifyYaml(updated));

    // Reload config
    await configLoader.load();

    // Commit and push
    const commitMessage = message || `Update ${dashboard.title} layout`;
    const result = await gitService.commitAndPush(commitMessage);

    return {
      success: true,
      commit: result.commit,
      branch: result.branch,
    };
  });

  // Warm up cache for all charts in a dashboard
  fastify.post<{
    Params: { id: string };
    Body: { params?: Record<string, unknown> };
  }>('/api/dashboards/:id/warm-cache', async (request, reply) => {
    const { id } = request.params;
    const { params = {} } = request.body;

    const dashboard = configLoader.getDashboardByName(id);
    if (!dashboard) {
      return reply.status(404).send({ error: `Dashboard not found: ${id}` });
    }

    if (!options.queryService) {
      return reply.status(500).send({ error: 'Query service not available' });
    }

    // Extract all chart refs from dashboard layout
    const chartRefs: string[] = [];
    for (const row of dashboard.layout.rows) {
      for (const widget of row.widgets) {
        if (widget.type === 'chart' && widget.ref) {
          chartRefs.push(widget.ref);
        }
      }
    }

    // Execute all charts in parallel to warm cache
    const results = await Promise.all(
      chartRefs.map(async (chartRef) => {
        const chart = configLoader.getChartByName(chartRef);
        if (!chart) {
          return { chart: chartRef, error: 'Chart not found' };
        }

        try {
          const result = await options.queryService!.executeChart(chart, params);
          return {
            chart: chartRef,
            cached: result.cached,
            durationMs: result.durationMs,
            rowCount: result.rowCount,
          };
        } catch (err) {
          return {
            chart: chartRef,
            error: err instanceof Error ? err.message : 'Query failed',
          };
        }
      })
    );

    const cached = results.filter((r) => 'cached' in r && r.cached).length;
    const fresh = results.filter((r) => 'cached' in r && !r.cached).length;
    const failed = results.filter((r) => 'error' in r).length;

    return {
      dashboard: id,
      charts: chartRefs.length,
      cached,
      fresh,
      failed,
      results,
    };
  });

  // Git routes
  fastify.get('/api/git/branches', async () => {
    return gitService.getBranchesWithCurrent();
  });

  fastify.post<{ Body: { name: string; from?: string } }>(
    '/api/git/branches',
    async (request) => {
      const { name, from } = request.body;
      await gitService.createBranch(name, from);
      return { success: true, branch: name };
    }
  );

  fastify.post<{ Body: { branch: string } }>(
    '/api/git/checkout',
    async (request) => {
      const { branch } = request.body;
      await gitService.checkout(branch);
      await configLoader.load(); // Reload after branch switch
      return { success: true, branch };
    }
  );
}
