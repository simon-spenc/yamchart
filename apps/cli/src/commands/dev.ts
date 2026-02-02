import { createServer, type DashbookServer } from '@dashbook/server';
import * as output from '../utils/output.js';
import { validateProject } from './validate.js';
import { loadEnvFile } from '../utils/config.js';

export interface DevOptions {
  port: number;
  apiOnly: boolean;
  open: boolean;
}

export async function runDevServer(
  projectDir: string,
  options: DevOptions
): Promise<void> {
  // Load .env file
  loadEnvFile(projectDir);

  // Validate first
  output.header('Validating configuration...');

  const validation = await validateProject(projectDir, { dryRun: false });

  if (!validation.success) {
    for (const error of validation.errors) {
      output.error(error.file);
      output.detail(error.message);
      if (error.suggestion) {
        output.detail(error.suggestion);
      }
    }
    output.newline();
    output.error(`Validation failed with ${validation.errors.length} error(s)`);
    process.exit(1);
  }

  output.success(`Validation passed (${validation.stats.passed} files)`);
  output.newline();

  // Start server
  const spinner = output.spinner('Starting server...');

  let server: DashbookServer;

  try {
    server = await createServer({
      projectDir,
      port: options.port,
      watch: true,
      serveStatic: !options.apiOnly,
    });

    await server.start();
    spinner.stop();
  } catch (err) {
    spinner.fail('Failed to start server');
    output.error(err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
  }

  // Print status
  const project = server.configLoader.getProject();
  const charts = server.configLoader.getCharts();
  const models = server.configLoader.getModels();

  output.newline();
  output.box([
    `Dashbook v0.1.0`,
    ``,
    `Dashboard:  http://localhost:${options.port}`,
    `API:        http://localhost:${options.port}/api`,
    ``,
    `Project:    ${project.name}`,
    `Charts:     ${charts.length} loaded`,
    `Models:     ${models.length} loaded`,
    ``,
    `Watching for changes...`,
  ]);
  output.newline();

  // Open browser
  if (options.open && !options.apiOnly) {
    const url = `http://localhost:${options.port}`;
    const { exec } = await import('child_process');
    const command = process.platform === 'darwin' ? 'open' :
                    process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${command} ${url}`);
  }

  // Handle shutdown
  const shutdown = async () => {
    output.newline();
    output.info('Shutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
