type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, string | number | boolean | string[] | number[] | undefined>;

export function logInfo(message: string, fields: LogFields = {}): void {
  writeLog("info", message, fields);
}

export function logWarn(message: string, fields: LogFields = {}): void {
  writeLog("warn", message, fields);
}

export function logError(message: string, fields: LogFields = {}): void {
  writeLog("error", message, fields);
}

function writeLog(level: LogLevel, message: string, fields: LogFields): void {
  const payload = {
    level,
    message,
    service: "api",
    timestamp: new Date().toISOString(),
    ...fields
  };

  const output = JSON.stringify(payload);

  if (level === "error") {
    console.error(output);
    return;
  }

  if (level === "warn") {
    console.warn(output);
    return;
  }

  console.log(output);
}

