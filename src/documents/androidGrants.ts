import { invoke } from "@tauri-apps/api/core";
import { isAndroid } from "../utils/platform";

/**
 * Best-effort Android persisted-grant management. Android caps persisted URI
 * grants (128 pre-11, 512 from 11 on). Exceeding the cap makes persistence
 * fail, so stale grants must be released. All calls are no-ops off Android.
 */

/** Releases the persisted read grant for a single content URI. */
export async function releasePersistedGrant(uri: string): Promise<void> {
  if (!isAndroid()) return;
  await invoke("plugin:zenoread-android-fs|release", { uri }).catch(() => {});
}

/** Releases every persisted read grant the app holds (app data reset). */
export async function releaseAllPersistedGrants(): Promise<void> {
  if (!isAndroid()) return;
  await invoke("plugin:zenoread-android-fs|release_all").catch(() => {});
}

/** Persists the read grant for a content URI; returns whether it succeeded. */
export async function persistPersistedGrant(uri: string): Promise<boolean> {
  if (!isAndroid()) return true;
  try {
    await invoke("plugin:zenoread-android-fs|persist", { uri });
    return true;
  } catch {
    return false;
  }
}

/**
 * Releases the persisted grants of the `count` least-recently-opened library
 * documents (LRU by modified_date), to free room under the OS cap.
 */
export async function evictOldestGrants(
  docs: { file_path: string; modified_date: string }[],
  count: number,
): Promise<void> {
  if (!isAndroid() || count <= 0) return;
  const oldest = docs
    .filter((d) => d.file_path.startsWith("content://"))
    .sort((a, b) => a.modified_date.localeCompare(b.modified_date))
    .slice(0, count);
  await Promise.all(oldest.map((d) => releasePersistedGrant(d.file_path)));
}
