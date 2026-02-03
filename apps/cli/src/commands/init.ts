import { mkdir, readFile, writeFile, access, readdir, copyFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface InitOptions {
  empty?: boolean;
  example?: boolean;
  force?: boolean;
}

export interface InitResult {
  success: boolean;
  files: string[];
  error?: string;
}

/**
 * Check if a directory exists and is accessible.
 */
async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the templates directory path.
 * Handles both development (src/commands) and production (dist/) contexts.
 */
async function getTemplatesDir(): Promise<string> {
  // In production (dist/), templates are at dist/templates
  const distTemplates = join(__dirname, 'templates');
  if (await directoryExists(distTemplates)) {
    return distTemplates;
  }

  // In development (src/commands), templates are at src/templates
  const srcTemplates = join(__dirname, '../templates');
  if (await directoryExists(srcTemplates)) {
    return srcTemplates;
  }

  throw new Error('Templates not found. Reinstall dashbook or check installation.');
}

/**
 * Get the examples directory path.
 * Handles both development and production contexts.
 */
async function getExamplesDir(): Promise<string> {
  // In production (dist/): dist -> cli -> apps -> dashbook -> examples
  const distExamples = join(__dirname, '../../../examples');
  if (await directoryExists(distExamples)) {
    return distExamples;
  }

  // In development (src/commands): src/commands -> src -> cli -> apps -> dashbook -> examples
  const srcExamples = join(__dirname, '../../../../examples');
  if (await directoryExists(srcExamples)) {
    return srcExamples;
  }

  throw new Error('Example assets not found. Reinstall dashbook or use default mode.');
}

export async function initProject(projectDir: string, options: InitOptions): Promise<InitResult> {
  const projectName = basename(projectDir);
  const files: string[] = [];

  // Check if dashbook.yaml already exists
  const dashbookYamlPath = join(projectDir, 'dashbook.yaml');
  try {
    await access(dashbookYamlPath);
    if (!options.force) {
      return {
        success: false,
        files: [],
        error: `${dashbookYamlPath} already exists. Use --force to overwrite.`,
      };
    }
  } catch {
    // File doesn't exist, continue
  }

  // Create project directory
  await mkdir(projectDir, { recursive: true });

  try {
    if (options.example) {
      // Copy example project
      const examplesDir = await getExamplesDir();
      await copyDirectory(examplesDir, projectDir, files, projectName);
    } else if (options.empty) {
      // Empty mode - only dashbook.yaml
      const templateDir = join(await getTemplatesDir(), 'empty');
      await copyTemplate(templateDir, projectDir, files, projectName);
    } else {
      // Default mode - minimal working project
      const templateDir = join(await getTemplatesDir(), 'default');
      await copyTemplate(templateDir, projectDir, files, projectName);
    }
  } catch (err) {
    return {
      success: false,
      files: [],
      error: err instanceof Error ? err.message : 'Failed to create project',
    };
  }

  return { success: true, files };
}

async function copyTemplate(
  templateDir: string,
  targetDir: string,
  files: string[],
  projectName: string,
  basePath: string = ''
): Promise<void> {
  const entries = await readdir(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(templateDir, entry.name);
    const destPath = join(targetDir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyTemplate(srcPath, destPath, files, projectName, relativePath);
    } else {
      let content = await readFile(srcPath, 'utf-8');
      content = content.replace(/\{\{name\}\}/g, projectName);
      await writeFile(destPath, content, 'utf-8');
      files.push(relativePath);
    }
  }
}

async function copyDirectory(
  srcDir: string,
  destDir: string,
  files: string[],
  projectName: string,
  basePath: string = ''
): Promise<void> {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip node_modules, lock files, and hidden files
    if (
      entry.name === 'node_modules' ||
      entry.name === 'pnpm-lock.yaml' ||
      entry.name === 'package-lock.json' ||
      entry.name === 'yarn.lock' ||
      entry.name === 'package.json' ||
      entry.name.startsWith('.')
    ) {
      continue;
    }

    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath, files, projectName, relativePath);
    } else {
      // For binary files (like .duckdb), copy directly
      if (entry.name.endsWith('.duckdb')) {
        await copyFile(srcPath, destPath);
      } else {
        // For text files, replace project name in dashbook.yaml
        let content = await readFile(srcPath, 'utf-8');
        if (entry.name === 'dashbook.yaml') {
          content = content.replace(/^name:\s*\S+/m, `name: ${projectName}`);
        }
        await writeFile(destPath, content, 'utf-8');
      }
      files.push(relativePath);
    }
  }
}
