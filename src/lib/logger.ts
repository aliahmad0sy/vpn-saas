import pino from 'pino';
import { env } from './env';

// We intentionally don't use pino's worker transport (pino-pretty) here:
// Next.js's dev HMR repeatedly tears down the module, which crashes the
// transport's worker thread and surfaces as an uncaughtException that takes
// the whole dev server down. JSON-line logs are fine for both dev and prod;
// pipe through `pino-pretty` on stdout if pretty output is needed:
//   `npm run dev | pino-pretty`
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'vpn-saas' },
});
