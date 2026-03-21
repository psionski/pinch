import pino from "pino";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

function resolveLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && LOG_LEVELS.includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const logLevel = resolveLogLevel();
const logDir = process.env.LOG_DIR ?? "./logs";
const isDev = process.env.NODE_ENV !== "production";
const isTest = !!process.env.VITEST;

// In tests, skip transports (no worker threads, no file I/O) — logs go to
// stdout synchronously at whatever LOG_LEVEL is set (default: warn in tests
// to keep output clean; set LOG_LEVEL=debug to see logs when debugging).
// In dev/prod, use multi-transport: pretty console (dev) or JSON stdout (prod) + rotated file.
const testLevel = logLevel === "debug" && !process.env.LOG_LEVEL ? "warn" : logLevel;

const logger = isTest
  ? pino({ level: testLevel })
  : pino(
      { level: logLevel },
      pino.transport({
        targets: [
          isDev
            ? {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  translateTime: "SYS:HH:MM:ss",
                  ignore: "pid,hostname",
                },
                level: logLevel,
              }
            : {
                target: "pino/file",
                options: { destination: 1 },
                level: logLevel,
              },
          {
            target: "pino-roll",
            options: {
              file: `${logDir}/pinch`,
              frequency: "daily",
              size: "10m",
              mkdir: true,
              dateFormat: "yyyy-MM-dd",
              limit: { count: 14 },
            },
            level: logLevel,
          },
        ],
      })
    );

export { logger };
export const cronLogger = logger.child({ module: "cron" });
export const apiLogger = logger.child({ module: "api" });
export const mcpLogger = logger.child({ module: "mcp" });
export const financialLogger = logger.child({ module: "financial" });
export const dbLogger = logger.child({ module: "db" });
export const seedLogger = logger.child({ module: "seed" });
