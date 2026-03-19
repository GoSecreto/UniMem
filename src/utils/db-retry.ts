/**
 * SQLite retry wrapper for BUSY/LOCKED errors.
 * Uses exponential backoff with jitter.
 */
export async function withRetry<T>(
  fn: () => T,
  maxRetries: number = 3,
  baseDelayMs: number = 50
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return fn();
    } catch (err: any) {
      lastError = err;
      const code = err?.code || '';
      const message = String(err?.message || '');

      // Only retry on BUSY/LOCKED errors
      if (!code.includes('BUSY') && !code.includes('LOCKED') &&
          !message.includes('SQLITE_BUSY') && !message.includes('SQLITE_LOCKED') &&
          !message.includes('database is locked')) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * baseDelayMs;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
