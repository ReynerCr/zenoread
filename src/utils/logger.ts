import { isTauri } from "./platform";

export type ErrorSeverity = "error" | "warning";

let attachConsoleFn: (() => void) | null = null;

/**
 * Attaches the log plugin's console forwarding so plugin log calls also
 * appear in the webview DevTools console. On web, this is a no-op —
 * console.error/warn are used directly.
 */
export async function initLogger(): Promise<void> {
  if (!isTauri()) return;

  try {
    const { attachConsole } = await import("@tauri-apps/plugin-log");
    const unlisten = await attachConsole();
    attachConsoleFn = unlisten;
  } catch {
    // Plugin not available — console fallback handles output.
  }
}

/**
 * Logs an error/warning through the tauri-plugin-log pipeline (file,
 * terminal, webview console). Falls back to console on web.
 */
export async function logError(
  severity: ErrorSeverity,
  userMessage: string,
  technicalMessage: string,
  context: string,
): Promise<void> {
  const line = `[${context}] ${userMessage} — ${technicalMessage}`;

  if (!isTauri()) {
    console.error(`[ZenoRead:${context}]`, userMessage, technicalMessage);
    return;
  }

  try {
    const { error, warn } = await import("@tauri-apps/plugin-log");
    if (severity === "error") {
      await error(line);
    } else {
      await warn(line);
    }
  } catch {
    console.error(`[ZenoRead:${context}]`, userMessage, technicalMessage);
  }
}

/**
 * Detaches the console listener. Should be called on app exit.
 */
export async function closeLogger(): Promise<void> {
  if (attachConsoleFn) {
    attachConsoleFn();
    attachConsoleFn = null;
  }
}
