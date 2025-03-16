// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3
}

// Current log level - can be changed at runtime
let currentLogLevel = LogLevel.INFO;

// Maximum number of logs to keep in memory
const MAX_LOGS = 1000;

// Log storage
interface LogEntry {
  timestamp: number;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
}

const logs: LogEntry[] = [];

// Set the current log level
export const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
  info('LogService', `Log level set to ${LogLevel[level]}`);
};

// Get the current log level
export const getLogLevel = (): LogLevel => currentLogLevel;

// Get the current log level as a string
export const getLogLevelString = (): string => LogLevel[currentLogLevel];

// Log a debug message
export const debug = (component: string, message: string, data?: any): void => {
  if (currentLogLevel <= LogLevel.DEBUG) {
    addLog(LogLevel.DEBUG, component, message, data);
    console.debug(`[${component}] ${message}`, data || '');
  }
};

// Log an info message
export const info = (component: string, message: string, data?: any): void => {
  if (currentLogLevel <= LogLevel.INFO) {
    addLog(LogLevel.INFO, component, message, data);
    console.info(`[${component}] ${message}`, data || '');
  }
};

// Log a warning message
export const warning = (component: string, message: string, data?: any): void => {
  if (currentLogLevel <= LogLevel.WARNING) {
    addLog(LogLevel.WARNING, component, message, data);
    console.warn(`[${component}] ${message}`, data || '');
  }
};

// Log an error message
export const error = (component: string, message: string, data?: any): void => {
  if (currentLogLevel <= LogLevel.ERROR) {
    addLog(LogLevel.ERROR, component, message, data);
    console.error(`[${component}] ${message}`, data || '');
  }
};

// Add a log entry to the logs array
const addLog = (level: LogLevel, component: string, message: string, data?: any): void => {
  logs.unshift({
    timestamp: Date.now(),
    level,
    component,
    message,
    data
  });
  
  // Trim logs if they exceed the maximum
  if (logs.length > MAX_LOGS) {
    logs.pop();
  }
};

// Get all logs
export const getLogs = (): LogEntry[] => [...logs];

// Clear all logs
export const clearLogs = (): void => {
  logs.length = 0;
  info('LogService', 'Logs cleared');
};

// Get logs filtered by level
export const getLogsByLevel = (level: LogLevel): LogEntry[] => {
  return logs.filter(log => log.level === level);
};

// Get logs filtered by component
export const getLogsByComponent = (component: string): LogEntry[] => {
  return logs.filter(log => log.component === component);
}; 