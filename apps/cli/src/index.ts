#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'path';
import { validateProject } from './commands/validate.js';
import { findProjectRoot, loadEnvFile } from './utils/config.js';
import * as output from './utils/output.js';

const program = new Command();

program
  .name('dashbook')
  .description('Git-native business intelligence dashboards')
  .version('0.1.0');

program
  .command('validate')
  .description('Validate configuration files')
  .argument('[path]', 'Path to dashbook project', '.')
  .option('--dry-run', 'Connect to database and test queries with EXPLAIN')
  .option('-c, --connection <name>', 'Connection to use for dry-run')
  .option('--json', 'Output as JSON')
  .action(async (path: string, options: { dryRun?: boolean; connection?: string; json?: boolean }) => {
    const startPath = resolve(path);
    const projectDir = await findProjectRoot(startPath);

    if (!projectDir) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: 'dashbook.yaml not found' }));
      } else {
        output.error('dashbook.yaml not found');
        output.detail('Run this command from a dashbook project directory');
      }
      process.exit(2);
    }

    // Load .env file
    loadEnvFile(projectDir);

    if (!options.json) {
      output.header('Validating dashbook project...');
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

      output.newline();

      if (result.success) {
        output.success('Validation passed');
      } else {
        output.error(`Validation failed with ${result.errors.length} error(s)`);
      }
    }

    process.exit(result.success ? 0 : 1);
  });

program.parse();
