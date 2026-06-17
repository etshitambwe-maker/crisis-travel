// logger.api() est désactivé par défaut en prod pour éviter le bruit.
// Activez-le avec ENABLE_API_LOGS=true dans les env vars Vercel si nécessaire.
const isProd = process.env.NODE_ENV === 'production';
const apiLogsEnabled = !isProd || process.env.ENABLE_API_LOGS === 'true';

export const logger = {
  api(service: string, key: string, durationMs: number, fromCache: boolean) {
    if (apiLogsEnabled) {
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
