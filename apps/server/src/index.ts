import { createServer } from './server.js';
import { resolve } from 'path';

const projectDir = process.env.DASHBOOK_PROJECT_DIR || process.cwd();
const port = parseInt(process.env.PORT || '3001', 10);
const watch = process.env.NODE_ENV !== 'production';

async function main() {
  try {
    const server = await createServer({
      projectDir: resolve(projectDir),
      port,
      watch,
    });

    await server.start();

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
