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
        1: (doc) => doc, // v0→v1: widened max_words_screen maximum, no data transform needed.
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
      },
    },
    reading_progress: { schema: readingProgressSchema },
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
  await db.user_settings.insert({ ...DEFAULT_USER_SETTINGS });
}
