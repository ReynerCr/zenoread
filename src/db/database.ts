import {
  createRxDatabase,
  addRxPlugin,
  type RxDatabase,
  type RxCollection,
  type RxStorage,
} from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";

import {
  userSettingsSchema,
  DEFAULT_USER_SETTINGS,
  type UserSettingsDocType,
} from "./schemas/userSettings.schema";
import { detectLanguage } from "../i18n";
import { releaseAllPersistedGrants } from "../documents/androidGrants";
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

let dbPromise: Promise<ZenoDatabase> | null = null;

async function createDatabase(): Promise<ZenoDatabase> {
  // Dexie wraps the IndexedDB provided by the Tauri WebView.
  let storage: RxStorage<unknown, unknown> = getRxStorageDexie();

  // Dev-mode adds helpful error messages and requires a schema validator to be
  // wrapped around the storage. Both are excluded from production builds for
  // performance.
  if (import.meta.env.DEV) {
    const { RxDBDevModePlugin } = await import("rxdb/plugins/dev-mode");
    const { wrappedValidateAjvStorage } = await import(
      "rxdb/plugins/validate-ajv"
    );
    addRxPlugin(RxDBDevModePlugin);
    storage = wrappedValidateAjvStorage({ storage });
  }

  addRxPlugin(RxDBMigrationSchemaPlugin);

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
 * Removes all documents from every collection and re-seeds the default settings.
 * Used by the "Reset app data" button so users (and developers) can clear
 * stale data after schema changes without manually hunting for IndexedDB files.
 */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();

  for (const collection of [db.documents, db.reading_progress, db.user_settings]) {
    const docs = await collection.find().exec();
    await Promise.all(docs.map((d) => d.remove()));
  }

  // Re-seed default settings so the app remains usable immediately.
  await db.user_settings.insert({ ...DEFAULT_USER_SETTINGS, language: detectLanguage() });

  // The OS-side persisted URI grants survive the library wipe. Releasing them
  // makes a reset fully reset file access on Android.
  await releaseAllPersistedGrants();
}
