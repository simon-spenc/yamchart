#!/usr/bin/env node
import { Command } from 'commander';
import { resolve, basename } from 'path';
import { validateProject } from './commands/validate.js';
import { findProjectRoot, loadEnvFile } from './utils/config.js';
import * as output from './utils/output.js';

const program = new Command();

program
  .name('yamchart')
  .description('Git-native business intelligence dashboards')
  .version('0.1.0');

program
  .command('validate')
  .description('Validate configuration files')
  .argument('[path]', 'Path to yamchart project', '.')
  .option('--dry-run', 'Connect to database and test queries with EXPLAIN')
  .option('-c, --connection <name>', 'Connection to use for dry-run')
  .option('--json', 'Output as JSON')
  .action(async (path: string, options: { dryRun?: boolean; connection?: string; json?: boolean }) => {
    const startPath = resolve(path);
    const projectDir = await findProjectRoot(startPath);

    if (!projectDir) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: 'yamchart.yaml not found' }));
      } else {
        output.error('yamchart.yaml not found');
        output.detail('Run this command from a yamchart project directory');
      }
      process.exit(2);
    }

    // Load .env file
    loadEnvFile(projectDir);

    if (!options.json) {
      output.header('Validating yamchart project...');
    }

    const result = await validateProject(projectDir, {
      dryRun: options.dryRun ?? false,
      connection: options.connection,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Print results
      for (const error of result.errors) {
        output.error(error.file);
        output.detail(error.message);
        if (error.suggestion) {
          output.detail(error.suggestion);
        }
      }

      for (const warning of result.warnings) {
        output.warning(warning.file);
        output.detail(warning.message);
      }

      output.newline();

      if (result.success) {
        output.success(`Schema: ${result.stats.passed} passed`);
      } else {
        output.error(`Schema: ${result.stats.passed} passed, ${result.stats.failed} failed`);
      }

      if (result.dryRunStats) {
        output.newline();
        if (result.dryRunStats.failed === 0) {
          output.success(`Queries: ${result.dryRunStats.passed} passed (EXPLAIN OK)`);
        } else {
          output.error(`Queries: ${result.dryRunStats.passed} passed, ${result.dryRunStats.failed} failed`);
        }
      }

      output.newline();

      if (result.success) {
        output.success('Validation passed');
      } else {
        output.error(`Validation failed with ${result.errors.length} error(s)`);
      }
    }

    process.exit(result.success ? 0 : 1);
  });

program
  .command('dev')
  .description('Start development server with hot reload')
  .argument('[path]', 'Path to yamchart project', '.')
  .option('-p, --port <number>', 'Port to listen on', '3001')
  .option('--api-only', 'Only serve API, no web UI')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (path: string, options: { port: string; apiOnly?: boolean; open: boolean }) => {
    const startPath = resolve(path);
    const projectDir = await findProjectRoot(startPath);

    if (!projectDir) {
      output.error('yamchart.yaml not found');
      output.detail('Run this command from a yamchart project directory');
      process.exit(2);
    }

    const { runDevServer } = await import('./commands/dev.js');

    await runDevServer(projectDir, {
      port: parseInt(options.port, 10),
      apiOnly: options.apiOnly ?? false,
      open: options.open,
    });
  });

program
  .command('init')
  .description('Create a new yamchart project')
  .argument('[directory]', 'Target directory', '.')
  .option('--example', 'Create full example project with sample database')
  .option('--empty', 'Create only yamchart.yaml (no connections, models, or charts)')
  .option('--force', 'Overwrite existing files')
  .action(async (directory: string, options: { example?: boolean; empty?: boolean; force?: boolean }) => {
    const { initProject } = await import('./commands/init.js');
    const targetDir = resolve(directory);

    const result = await initProject(targetDir, options);

    if (!result.success) {
      output.error(result.error || 'Failed to create project');
      process.exit(1);
    }

    output.newline();
    output.success(`Created ${directory === '.' ? basename(targetDir) : directory}/`);
    for (const file of result.files.slice(0, 10)) {
      output.detail(file);
    }
    if (result.files.length > 10) {
      output.detail(`... and ${result.files.length - 10} more files`);
    }
    output.newline();
    output.info(`Run \`cd ${directory === '.' ? basename(targetDir) : directory} && yamchart dev\` to start.`);
  });

program
  .command('sync-dbt')
  .description('Sync dbt project metadata into AI-readable catalog')
  .option('-s, --source <type>', 'Source type: local, github, dbt-cloud', 'local')
  .option('-p, --path <dir>', 'Path to dbt project (for local source)')
  .option('--repo <repo>', 'GitHub repository (for github source)')
  .option('--branch <branch>', 'Git branch (for github source)', 'main')
  .option('-i, --include <patterns...>', 'Include glob patterns')
  .option('-e, --exclude <patterns...>', 'Exclude glob patterns')
  .option('-t, --tag <tags...>', 'Filter by dbt tags')
  .option('--refresh', 'Re-sync using saved configuration')
  .action(async (options: {
    source: 'local' | 'github' | 'dbt-cloud';
    path?: string;
    repo?: string;
    branch?: string;
    include?: string[];
    exclude?: string[];
    tag?: string[];
    refresh?: boolean;
  }) => {
    const { syncDbt, loadSyncConfig } = await import('./commands/sync-dbt.js');

    // Find project root
    const projectDir = await findProjectRoot(process.cwd());

    if (!projectDir) {
      output.error('yamchart.yaml not found');
      output.detail('Run this command from a yamchart project directory');
      process.exit(2);
    }

    // Handle refresh mode
    if (options.refresh) {
      const savedConfig = await loadSyncConfig(projectDir);
      if (!savedConfig) {
        output.error('No saved sync config found');
        output.detail('Run sync-dbt without --refresh first');
        process.exit(1);
      }
      output.info(`Re-syncing from ${savedConfig.source}:${savedConfig.path || savedConfig.repo}`);
    }

    const spin = output.spinner('Syncing dbt metadata...');

    const result = await syncDbt(projectDir, {
      source: options.source,
      path: options.path,
      repo: options.repo,
      branch: options.branch,
      include: options.include || [],
      exclude: options.exclude || [],
      tags: options.tag || [],
      refresh: options.refresh,
    });

    spin.stop();

    if (!result.success) {
      output.error(result.error || 'Sync failed');
      process.exit(1);
    }

    output.success(`Synced ${result.modelsIncluded} models to .yamchart/catalog.md`);
    if (result.modelsExcluded > 0) {
      output.detail(`${result.modelsExcluded} models filtered out`);
    }
  });

program.parse();
