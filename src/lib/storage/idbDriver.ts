import { openDB, type IDBPDatabase } from 'idb';
import type { StorageDriver } from './storage';

const DATA_DB = 'money-flow-data';
const DATA_DB_VERSION = 1;
const DATA_STORE = 'app-data';

export class IdbDriver implements StorageDriver {
  private db!: IDBPDatabase;

  async isAvailable(): Promise<boolean> {
    return true;  // IndexedDB is available in all target browsers
  }

  async init(): Promise<void> {
    this.db = await openDB(DATA_DB, DATA_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DATA_STORE)) {
          db.createObjectStore(DATA_STORE);
        }
      },
    });
  }

  async read<T>(key: string): Promise<T | null> {
    const result = await this.db.get(DATA_STORE, key);
    return result !== undefined ? result as T : null;
  }

  async write<T>(key: string, data: T): Promise<void> {
    await this.db.put(DATA_STORE, data, key);
  }
}
