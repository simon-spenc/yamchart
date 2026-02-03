import type { FastifyInstance } from 'fastify';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { stringify as stringifyYaml } from 'yaml';
import type { ConfigLoader } from '../services/config-loader.js';
import type { GitService } from '../services/git-service.js';
import type { DashboardLayout } from '@yamchart/schema';

export interface DashboardRoutesOptions {
  configLoader: ConfigLoader;
  gitService: GitService;
  projectDir: string;
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
