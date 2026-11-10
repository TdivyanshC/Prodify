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
  logger.info(`Starting Prodify API (env: ${env.NODE_ENV}, auth: ${env.AUTH_MODE}); connecting to MongoDB…`);
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

// Startup failures go to stderr synchronously as well as the logger: the logger
// can lose its last line when the process exits straight after, which on a
// host leaves only "exited with status 1" and no reason.
main().catch((err: Error & { code?: number | string }) => {
  console.error(`Failed to start: ${err.name}: ${err.message}`);
  if (err.code === 'ENOTFOUND' || /querySrv|getaddrinfo/.test(err.message)) {
    console.error('The MongoDB hostname in MONGO_URI does not exist in DNS. Re-copy the connection string from Atlas (Connect > Drivers) - a mistyped or truncated cluster host (cluster0.xxxxx.mongodb.net) or a deleted/paused cluster causes this.');
  } else if (err.name === 'MongoServerSelectionError' || err.name === 'MongoParseError' || err.name === 'MongoAPIError') {
    console.error('Could not reach MongoDB. Check MONGO_URI (password filled in and URL-encoded, no <angle brackets>) and that Atlas Network Access allows this host (0.0.0.0/0).');
  } else if (err.code === 13 || err.code === 18 || err.name === 'MongoServerError') {
    console.error('MongoDB rejected the credentials or permissions. The database user needs readWrite on MONGO_DB (Atlas: "Read and write to any database").');
  }
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
