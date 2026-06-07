/**
 * Lightweight async concurrency limiter for I/O-bound pipeline stages.
 * Keeps N tasks in flight without spawning worker processes.
 */

export function createConcurrencyPool(limit) {
  const max = Math.max(1, Math.floor(limit) || 1);
  let active = 0;
  /** @type {Array<() => void>} */
  const waiters = [];

  function release() {
    active -= 1;
    const next = waiters.shift();
    if (next) next();
  }

  function acquire() {
    if (active < max) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      waiters.push(() => {
        active += 1;
        resolve();
      });
    });
  }

  /** Run fn with pool slot; slot is released when fn settles. */
  async function run(fn) {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return { run, limit: max };
}

/** True when an OpenRouter/OpenAI error looks like rate limiting. */
export function isRateLimitError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 429) return true;
  const msg = String(err?.message ?? err ?? '');
  return /rate.?limit|too many requests|429/i.test(msg);
}
