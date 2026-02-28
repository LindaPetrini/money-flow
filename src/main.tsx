import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { bootstrapStorage, type BootstrapResult } from '@/lib/storage/storage';
import { useAccountStore } from '@/stores/accountStore';
import { useAllocationStore } from '@/stores/allocationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { seedIfEmpty } from '@/lib/bootstrap';

async function init() {
  const bootstrapResult: BootstrapResult = await bootstrapStorage();

  // Load all stores from storage in parallel before rendering
  await Promise.all([
    useAccountStore.getState().loadAccounts(),
    useAllocationStore.getState().loadHistory(),
    useSettingsStore.getState().loadSettings(),
  ]);
  await seedIfEmpty();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App needsFsaPrompt={bootstrapResult.needsFsaPrompt} storageMode={bootstrapResult.mode} />
    </StrictMode>,
  );
}

init().catch(console.error);
