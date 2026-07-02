import { useNotificationsStore } from "../stores/notifications";

/**
 * Application-level error carrying a message that is safe to show to the user.
 */
export class AppError extends Error {
  /** Message intended for display in the UI. */
  readonly userMessage: string;

  constructor(userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options as ErrorOptions);
    this.name = "AppError";
    this.userMessage = userMessage;
  }
}

/** Best-effort extraction of a readable message from an unknown thrown value. */
export function toMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred.";
}

/**
 * Logs an error for debugging and surfaces a user-friendly message through the
 * notifications store. This is the single entry point for MVP error handling.
 */
export function reportError(error: unknown, userMessage?: string): void {
  // eslint-disable-next-line no-console
  console.error("[ZenoRead]", error);
  const message = userMessage ?? toMessage(error);
  useNotificationsStore().push(message, "error");
}
