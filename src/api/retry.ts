// Retry-with-backoff, kept free of React Native imports so it can be tested
// in plain Node. Runs `fn`; while it throws something `isTransient` accepts,
// waits the next delay and tries again, giving up after the delays run out.
export async function withRetry<T>(
  fn: () => Promise<T>,
  isTransient: (err: unknown) => boolean,
  delaysMs: readonly number[],
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= delaysMs.length || !isTransient(err)) throw err;
      await sleep(delaysMs[i]);
    }
  }
}
