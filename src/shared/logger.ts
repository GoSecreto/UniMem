import fs from 'fs';
import { LOG_PATH, ensureUnimemHome } from './paths.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel = 'info';
  private logToFile: boolean = true;

  private levels: Record<LogLevel, number> = {
    debug: 0, info: 1, warn: 2, error: 3
  };

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private format(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.format(level, message, data);

    // Always write to stderr (safe for MCP stdio transport)
    console.error(formatted);

    // Optionally append to log file
    if (this.logToFile) {
      try {
        ensureUnimemHome();
        fs.appendFileSync(LOG_PATH, formatted + '\n');
      } catch {
        // Silently fail file logging
      }
    }
  }

  debug(message: string, data?: unknown): void { this.write('debug', message, data); }
  info(message: string, data?: unknown): void { this.write('info', message, data); }
  warn(message: string, data?: unknown): void { this.write('warn', message, data); }
  error(message: string, data?: unknown): void { this.write('error', message, data); }
}

export const logger = new Logger();
