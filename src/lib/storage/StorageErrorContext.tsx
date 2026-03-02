import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface StorageErrorContextValue {
  permissionLost: boolean;
}

const StorageErrorContext = createContext<StorageErrorContextValue>({
  permissionLost: false,
});

// Module-level setter — stores call this (no React hook needed in store code)
let _reportPermissionLost: (() => void) | null = null;

export function reportPermissionLost() {
  _reportPermissionLost?.();
}

export function StorageErrorProvider({ children }: { children: ReactNode }) {
  const [permissionLost, setPermissionLost] = useState(false);

  useEffect(() => {
    _reportPermissionLost = () => setPermissionLost(true);
    return () => {
      _reportPermissionLost = null;
    };
  }, []);

  return (
    <StorageErrorContext.Provider value={{ permissionLost }}>
      {children}
    </StorageErrorContext.Provider>
  );
}

export function useStorageError() {
  return useContext(StorageErrorContext);
}
