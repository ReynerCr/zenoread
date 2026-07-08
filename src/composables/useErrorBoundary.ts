import { onErrorCaptured, onBeforeUnmount } from "vue";
import { reportError } from "../utils/errors";

/**
 * Registers global error handlers: Vue's onErrorCaptured for render errors,
 * plus window-level listeners for unhandled promise rejections and global
 * errors. Must be called during a component's setup phase.
 */
export function useErrorBoundary(): void {
  onErrorCaptured((error) => {
    reportError(error, undefined, { context: "vue.errorCaptured" });
    return false;
  });

  function handleUnhandledRejection(event: PromiseRejectionEvent) {
    reportError(event.reason, undefined, { context: "window.unhandledrejection" });
  }
  function handleGlobalError(event: ErrorEvent) {
    reportError(event.error ?? event.message, undefined, { context: "window.onerror" });
  }

  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  window.addEventListener("error", handleGlobalError);

  onBeforeUnmount(() => {
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    window.removeEventListener("error", handleGlobalError);
  });
}
