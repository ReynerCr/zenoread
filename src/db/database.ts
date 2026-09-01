import {
  createRxDatabase,
  removeRxDatabase,
  addRxPlugin,
  type RxDatabase,
  type RxCollection,
  type RxStorage,
} from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { invoke } from "@tauri-apps/api/core";

import {
  userSettingsSchema,
  type UserSettingsDocType,
} from "./schemas/userSettings.schema";
import { releaseAllPersistedGrants } from "../documents/androidGrants";
import { isTauri } from "../utils/platform";
import {
  documentsSchema,
  type DocumentDocType,
} from "./schemas/documents.schema";
import {
  readingProgressSchema,
  type ReadingProgressDocType,
} from "./schemas/readingProgress.schema";

export type UserSettingsCollection = RxCollection<UserSettingsDocType>;
export type DocumentsCollection = RxCollection<DocumentDocType>;
export type ReadingProgressCollection = RxCollection<ReadingProgressDocType>;

export interface ZenoCollections {
  user_settings: UserSettingsCollection;
  documents: DocumentsCollection;
  reading_progress: ReadingProgressCollection;
}

export type ZenoDatabase = RxDatabase<ZenoCollections>;

const DB_NAME = "zenoread";

addRxPlugin(RxDBMigrationSchemaPlugin);
// Dev plugin useful for debugging, removed on release.
if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin);
}

// Storage instance. Dev-mode wrapping adds a schema validator and
// helpful errors
const storage: RxStorage<unknown, unknown> = import.meta.env.DEV
  ? wrappedValidateAjvStorage({ storage: getRxStorageDexie() })
  : getRxStorageDexie();

let dbPromise: Promise<ZenoDatabase> | null = null;

async function createDatabase(): Promise<ZenoDatabase> {
  const db = await createRxDatabase<ZenoCollections>({
    name: DB_NAME,
    storage,
    multiInstance: false,
    eventReduce: true,
  });

  await db.addCollections({
    user_settings: {
      schema: userSettingsSchema,
      migrationStrategies: {
        1: (doc) => doc,
        2: (doc) => ({ ...doc, show_block_counter: false }),
        3: (doc) => ({ ...doc, language: "en" }),
      },
    },
    documents: {
      schema: documentsSchema,
      migrationStrategies: {
        1: (doc) => {
          // v0→v1: removed content_raw field (content is now read from disk).
          const { content_raw, ...rest } = doc as Record<string, unknown>;
          void content_raw;
          return rest;
        },
        2: (doc) => {
          // v1→v2: replaced total_words with section_count.
          const { total_words, ...rest } = doc as Record<string, unknown>;
          void total_words;
          return { ...rest, section_count: 1 };
        },
        3: (doc) => {
          // v2→v3: removed "md" from file_type enum. No md parser was ever
          // built, so no document should have this value. Passthrough.
          return doc;
        },
      },
    },
    reading_progress: {
      schema: readingProgressSchema,
      migrationStrategies: {
        1: (doc) => {
          // v0→v1: replaced last_word_index with section_index + block_index_in_section.
          const oldDoc = doc as Record<string, unknown>;
          const lastWordIndex = oldDoc.last_word_index ?? 0;
          const { last_word_index, ...rest } = oldDoc;
          void last_word_index;
          return { ...rest, section_index: 0, block_index_in_section: lastWordIndex };
        },
        2: (doc) => {
          // v1→v2: removed reading_time_total (never used, always 0). Passthrough.
          const { reading_time_total, ...rest } = doc as Record<string, unknown>;
          void reading_time_total;
          return rest;
        },
      },
    },
  });

  return db;
}

/**
 * Returns the singleton RxDB instance, creating it on first call. All consumers
 * (stores, services) should go through this so there is only ever one database.
 */
export function getDatabase(): Promise<ZenoDatabase> {
  if (!dbPromise) {
    dbPromise = createDatabase();
  }
  return dbPromise;
}

/**
 * Empties the document library and reading progress, releases Android
 * persisted URI grants, and leaves user settings untouched. Used by the
 * Settings "Clear history" button so users can wipe the recent documents
 * list without losing their reading preferences.
 */
export async function clearHistory(): Promise<void> {
  const db = await getDatabase();

  for (const collection of [db.documents, db.reading_progress]) {
    const docs = await collection.find().exec();
    await Promise.all(docs.map((d) => d.remove()));
  }

  await releaseAllPersistedGrants();
}

/**
 * Clears app user data and brings the app back to a clean state. Best effort:
 * tries RxDB removal first, falls back to a Tauri file-level wipe. Throws when
 * no fix is possible (e.g. corrupt IndexedDB on web).
 */
export async function resetAllAppData(): Promise<void> {
  // JS-level wipe: handles partial corruption (DB opens but operations fail).
  try {
    await removeRxDatabase(DB_NAME, storage, false);
    dbPromise = null;
    setTimeout(() => window.location.reload(), 500);
    return;
  } catch {
    // File-level corruption: removeRxDatabase can't open the broken file.
  }

  if (!isTauri()) {
    throw new Error("Database could not be wiped on web");
  }

  await invoke("wipe_app_data");
  await invoke("exit_app");
}