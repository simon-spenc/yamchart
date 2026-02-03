import { defineConfig } from 'tsup';
import { cp } from 'fs/promises';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  onSuccess: async () => {
    // Copy templates to dist for init command
    await cp('src/templates', 'dist/templates', { recursive: true });
  },
});
