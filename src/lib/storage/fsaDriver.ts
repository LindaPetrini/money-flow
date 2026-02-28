import { openDB } from 'idb';
import type { StorageDriver } from './storage';

const META_DB = 'money-flow-meta';
const META_DB_VERSION = 1;
const HANDLES_STORE = 'fsa-handles';
const DIR_KEY = 'workDir';

export class FsaDriver implements StorageDriver {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  // Stored when init() finds a handle but permission is 'prompt'
  // UI must call requestPermission() in a click handler to use it
  public pendingHandle: FileSystemDirectoryHandle | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  async init(): Promise<boolean> {
    const db = await openDB(META_DB, META_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(HANDLES_STORE)) {
          db.createObjectStore(HANDLES_STORE);
        }
      },
    });
    const stored = await db.get(HANDLES_STORE, DIR_KEY) as FileSystemDirectoryHandle | undefined;
    if (!stored) return false;

    const perm = await stored.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      this.dirHandle = stored;
      return true;
    }
    // perm === 'prompt' — cannot call requestPermission here (not a user gesture)
    this.pendingHandle = stored;
    return false;
  }

  // MUST be called only from a user gesture (button click handler)
  async requestPermission(): Promise<void> {
    if (this.pendingHandle) {
      await this.pendingHandle.requestPermission({ mode: 'readwrite' });
      this.dirHandle = this.pendingHandle;
      this.pendingHandle = null;
    } else {
      this.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    }
    const db = await openDB(META_DB, META_DB_VERSION);
    await db.put(HANDLES_STORE, this.dirHandle, DIR_KEY);
  }

  async read<T>(key: string): Promise<T | null> {
    if (!this.dirHandle) return null;
    try {
      const fileHandle = await this.dirHandle.getFileHandle(`${key}.json`);
      const file = await fileHandle.getFile();
      return JSON.parse(await file.text()) as T;
    } catch {
      return null;  // File not found on first run — normal
    }
  }

  async write<T>(key: string, data: T): Promise<void> {
    if (!this.dirHandle) throw new Error('FsaDriver: not initialized — no directory handle');
    try {
      const fileHandle = await this.dirHandle.getFileHandle(`${key}.json`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        // Background-tab permission revocation — re-throw so stores can surface re-prompt
        throw e;
      }
      throw e;
    }
  }
}
