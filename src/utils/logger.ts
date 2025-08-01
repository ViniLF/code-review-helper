// src/utils/logger.ts
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  error?: Error;
  metadata?: Record<string, unknown>;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private context: string = 'RevisorCodigo';

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setContext(context: string): void {
    this.context = context;
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, error, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, undefined, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, undefined, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, undefined, metadata);
  }

  private log(level: LogLevel, message: string, error?: Error, metadata?: Record<string, unknown>): void {
    if (level > this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: this.context,
      error,
      metadata
    };

    this.output(entry);
  }

  private output(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const prefix = `[${timestamp}] ${levelName} [${entry.context}]`;
    
    const color = this.getLevelColor(entry.level);
    const reset = '\x1b[0m';

    let output = `${color}${prefix}${reset} ${entry.message}`;
    
    if (entry.metadata) {
      output += `\n  📊 Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    if (entry.error) {
      output += `\n  ❌ Error: ${entry.error.message}`;
      if (entry.error.stack && entry.level === LogLevel.DEBUG) {
        output += `\n  📍 Stack: ${entry.error.stack}`;
      }
    }

    console.log(output);
  }

  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return '\x1b[31m'; // Vermelho
      case LogLevel.WARN: return '\x1b[33m';  // Amarelo
      case LogLevel.INFO: return '\x1b[36m';  // Ciano
      case LogLevel.DEBUG: return '\x1b[37m'; // Branco
      default: return '\x1b[0m';
    }
  }

  // Método para criar um logger com contexto específico
  createChild(context: string): Logger {
    const child = new Logger();
    child.logLevel = this.logLevel;
    child.context = `${this.context}:${context}`;
    return child;
  }
}

// Factory functions para facilitar uso
export const logger = Logger.getInstance();

export function createLogger(context: string): Logger {
  return logger.createChild(context);
}