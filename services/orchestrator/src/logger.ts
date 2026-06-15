type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(
  scope: string,
  level: LogLevel = readLogLevel(),
): Logger {
  function write(
    levelName: LogLevel,
    message: string,
    context: Record<string, unknown> = {},
  ): void {
    if (levelOrder[levelName] < levelOrder[level]) {
      return;
    }

    const entry = {
      level: levelName,
      scope,
      message,
      time: new Date().toISOString(),
      ...redactContext(context),
    };

    const output = JSON.stringify(entry);
    if (levelName === "error") {
      console.error(output);
      return;
    }
    if (levelName === "warn") {
      console.warn(output);
      return;
    }
    console.log(output);
  }

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
  };
}

function readLogLevel(): LogLevel {
  const value = process.env.LOG_LEVEL;
  if (
    process.env.NODE_ENV === "test" &&
    process.env.TEST_LOGS !== "1" &&
    !value
  ) {
    return "silent";
  }
  if (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error" ||
    value === "silent"
  ) {
    return value;
  }
  return "info";
}

function redactContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (/token|secret|password|key/i.test(key)) {
        return [key, "[redacted]"];
      }
      return [key, value];
    }),
  );
}
