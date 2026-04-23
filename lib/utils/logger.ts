const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  api(service: string, key: string, durationMs: number, fromCache: boolean) {
    if (isDev) {
      console.log(`[${service}] key=${key} ${fromCache ? 'CACHE_HIT' : `LIVE ${durationMs}ms`}`);
    }
  },
  error(service: string, error: unknown) {
    console.error(`[${service}] ERROR:`, error instanceof Error ? error.message : error);
  },
  warn(service: string, message: string) {
    console.warn(`[${service}] WARN: ${message}`);
  },
};
