import pino from 'pino';
import { env, isDev } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isDev && env.NODE_ENV !== 'test'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
    : {}),
});
