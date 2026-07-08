import { useNotificationsStore } from "../stores/notifications";
import { logError, type ErrorSeverity } from "./logger";

export class AppError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options as ErrorOptions);
    this.name = "AppError";
    this.userMessage = userMessage;
  }
}

export function toMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred.";
}

function toTechnicalMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Logs an error to the console and optionally to a file (if --log flag is
 * active), and surfaces a user-friendly message through the notifications
 * store. This is the single entry point for error handling.
 */
export function reportError(
  error: unknown,
  userMessage?: string,
  options?: { severity?: ErrorSeverity; context?: string },
): void {
  const severity = options?.severity ?? "error";
  const context = options?.context ?? "unknown";
  const message = userMessage ?? toMessage(error);
  const technical = toTechnicalMessage(error);

  try {
    useNotificationsStore().push(message, severity === "warning" ? "info" : "error");
  } catch {
    // Pinia not yet initialized.
  }

  void logError(severity, message, technical, context);
}
