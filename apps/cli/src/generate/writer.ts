// apps/cli/src/generate/writer.ts
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function writeStub(projectDir: string, filename: string, content: string): Promise<void> {
  const modelsDir = join(projectDir, 'models');
  await mkdir(modelsDir, { recursive: true });
  await writeFile(join(modelsDir, filename), content, 'utf-8');
}

export async function stubExists(projectDir: string, filename: string): Promise<boolean> {
  return existsSync(join(projectDir, 'models', filename));
}
