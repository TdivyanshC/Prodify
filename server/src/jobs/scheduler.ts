import { env } from '../config/env';
import { logger } from '../lib/logger';

// Job runner (backend doc §10). The interface is BullMQ-shaped — named
// handlers, deterministic job ids for delayed jobs, repeatable jobs — so a
// Redis-backed driver can replace this in-process one without touching
// callers. In-process means delayed jobs live in memory: on boot,
// `rearmJobs()` (jobs/index.ts) rebuilds them from database state, so a
// restart never loses a reminder or an expiry.

type Handler = (data: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, Handler>();
const delayed = new Map<string, NodeJS.Timeout>();
const repeating: NodeJS.Timeout[] = [];
// setTimeout overflows past ~24.8 days; re-check far-future jobs daily.
const MAX_DELAY = 24 * 60 * 60 * 1000;

export function registerJob(name: string, handler: Handler) {
  handlers.set(name, handler);
}

async function run(name: string, data: Record<string, unknown>) {
  const handler = handlers.get(name);
  if (!handler) return logger.error({ job: name }, 'no handler registered');
  try {
    await handler(data);
  } catch (err) {
    logger.error({ err, job: name, data }, 'job failed');
  }
}

// Schedules (or reschedules — same id replaces) a one-off job.
export function scheduleJob(jobId: string, runAt: Date, name: string, data: Record<string, unknown> = {}) {
  cancelJob(jobId);
  if (!env.JOBS_ENABLED) return;
  const delay = Math.max(0, runAt.getTime() - Date.now());
  const timer = setTimeout(
    () => {
      delayed.delete(jobId);
      if (delay > MAX_DELAY) scheduleJob(jobId, runAt, name, data);
      else void run(name, data);
    },
    Math.min(delay, MAX_DELAY)
  );
  timer.unref();
  delayed.set(jobId, timer);
}

export function cancelJob(jobId: string) {
  const timer = delayed.get(jobId);
  if (timer) clearTimeout(timer);
  delayed.delete(jobId);
}

export function repeatJob(name: string, everyMs: number, opts: { runNow?: boolean } = {}) {
  if (!env.JOBS_ENABLED) return;
  const timer = setInterval(() => void run(name, {}), everyMs);
  timer.unref();
  repeating.push(timer);
  if (opts.runNow) void run(name, {});
}

export function runJobNow(name: string, data: Record<string, unknown> = {}) {
  return run(name, data);
}

export function stopJobs() {
  for (const t of delayed.values()) clearTimeout(t);
  delayed.clear();
  for (const t of repeating) clearInterval(t);
  repeating.length = 0;
}

export const pendingJobIds = () => [...delayed.keys()];
