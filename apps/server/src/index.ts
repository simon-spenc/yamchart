import Fastify from 'fastify';

const server = Fastify({ logger: true });

server.get('/api/health', async () => {
  return { status: 'ok', version: '0.1.0' };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
