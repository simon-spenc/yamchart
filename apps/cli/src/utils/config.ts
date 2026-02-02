import { access } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { config as loadDotenv } from 'dotenv';

/**
 * Find the project root by looking for dashbook.yaml.
 * Searches current directory and parent directories.
 */
export async function findProjectRoot(startDir: string): Promise<string | null> {
  let currentDir = resolve(startDir);
  const root = dirname(currentDir);

  while (currentDir !== root) {
    const configPath = join(currentDir, 'dashbook.yaml');
    try {
      await access(configPath);
      return currentDir;
    } catch {
      currentDir = dirname(currentDir);
    }
  }

  // Check root directory too
  try {
    await access(join(root, 'dashbook.yaml'));
    return root;
  } catch {
    return null;
  }
}

/**
 * Load .env file from project directory.
 */
export function loadEnvFile(projectDir: string): void {
  loadDotenv({ path: join(projectDir, '.env') });
}

/**
 * Resolve ${VAR} syntax in a string from environment variables.
 */
export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable not found: ${varName}`);
    }
    return envValue;
  });
}

/**
 * Recursively resolve env vars in an object.
 */
export function resolveEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveEnvVarsInObject) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVarsInObject(value);
    }
    return result as T;
  }
  return obj;
}
