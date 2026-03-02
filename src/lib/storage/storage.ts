import { FsaDriver } from './fsaDriver';
import { IdbDriver } from './idbDriver';

export interface StorageDriver {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, data: T): Promise<void>;
  isAvailable(): Promise<boolean>;
}

// Exported singleton — set by bootstrapStorage(), used by all stores
export let storage: StorageDriver;

// Exposed so UI can call requestPermission() on user gesture
export let fsaDriver: FsaDriver | null = null;

export interface BootstrapResult {
  needsFsaPrompt: boolean;  // true = FSA available but needs user gesture before use
  mode: 'fsa' | 'idb';
}

export async function bootstrapStorage(): Promise<BootstrapResult> {
  const fsa = new FsaDriver();
  fsaDriver = fsa;

  if (await fsa.isAvailable()) {
    const ready = await fsa.init();
    if (ready) {
      storage = fsa;
      return { needsFsaPrompt: false, mode: 'fsa' };
    }
    // FSA available but permission not granted — fall through to IDB,
    // surface "Grant access" button via needsFsaPrompt
    const idb = new IdbDriver();
    await idb.init();
    storage = idb;
    return { needsFsaPrompt: true, mode: 'idb' };
  }

  // FSA not available (Firefox/Safari)
  fsaDriver = null;
  const idb = new IdbDriver();
  await idb.init();
  storage = idb;
  return { needsFsaPrompt: false, mode: 'idb' };
}
