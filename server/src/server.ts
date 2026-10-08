import { createServer } from 'node:http';
import { createApp } from './app';
import { env, isDev } from './config/env';
import { closeDb, connectDb } from './db/mongo';
import { registerEventHandlers } from './events/handlers';
import { startJobs } from './jobs/index';
import { stopJobs } from './jobs/scheduler';
import { logger } from './lib/logger';
import { startSimulator, stopSimulator } from './modules/dev/simulator';
import { closeRealtime, initRealtime } from './realtime/io';

async function main() {
  await connectDb();
  registerEventHandlers();
  await startJobs();

  const server = createServer(createApp());
  initRealtime(server);
  if (isDev && process.env.DEV_SIMULATOR !== 'false') startSimulator();

  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Prodify API on http://localhost:${env.PORT}/v1  (auth: ${env.AUTH_MODE}, env: ${env.NODE_ENV})`);
    if (env.AUTH_MODE === 'dev') logger.info('Sign in with  Authorization: Bearer dev:seed-simran');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    stopSimulator();
    stopJobs();
    await closeRealtime();
    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
