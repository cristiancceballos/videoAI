/**
 * Debug configuration for the VideoAI app
 * Controls logging throughout the application
 */

// Check if debug mode is enabled via environment variable
const isDebugMode = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true';

/**
 * Debug logger that only logs when debug mode is enabled
 */
export const debug = {
  log: (...args: any[]) => {
    if (isDebugMode) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors, even in production
    console.error(...args);
  },
  warn: (...args: any[]) => {
    if (isDebugMode) {
      console.warn(...args);
    }
  },
  info: (...args: any[]) => {
    if (isDebugMode) {
      console.info(...args);
    }
  }
};

/**
 * No-op functions for production
 */
export const noop = {
  log: () => {},
  error: () => {},
  warn: () => {},
  info: () => {}
};