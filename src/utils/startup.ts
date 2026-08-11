import { getDatabase } from "../db/database";
import { reportError } from "../utils/errors";
import { initLogger, closeLogger } from "../utils/logger";
import { t } from "../i18n";

export interface StartupResult {
  dbOk: boolean;
}

/**
 * Runs the app startup sequence: initializes logging (attaches webview
 * console forwarding) and checks that the database can be opened. Returns
 * the result so the caller can decide whether to show the recovery dialog.
 */
export async function runStartup(): Promise<StartupResult> {
  await initLogger();

  try {
    await getDatabase();
    return { dbOk: true };
  } catch (error) {
    reportError(error, t("errors.database"), { context: "database.init" });
    return { dbOk: false };
  }
}

/**
 * Detaches the console listener. Should be called on app exit.
 */
export async function runShutdown(): Promise<void> {
  await closeLogger();
}
