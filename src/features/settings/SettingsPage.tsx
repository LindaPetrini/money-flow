import { useState } from 'react';
import { AccountsSection } from './AccountsSection';
import { OverflowRatiosSection } from './OverflowRatiosSection';
import { RecurringSection } from './RecurringSection';
import { TaxSection } from './TaxSection';
import { CsvAiSection } from './CsvAiSection';
import { StorageSection } from './StorageSection';

type SettingsTab = 'csv-ai' | 'accounts' | 'budget-splits' | 'recurring' | 'tax' | 'storage';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'csv-ai',        label: 'Analyze CSV' },
  { id: 'accounts',      label: 'Accounts' },
  { id: 'budget-splits', label: 'Budget Splits' },
  { id: 'recurring',     label: 'Commitments' },
  { id: 'tax',           label: 'Tax' },
  { id: 'storage',       label: 'Storage' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('csv-ai');

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      <nav className="flex gap-4 border-b border-border mb-6 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={[
              'pb-2 text-sm transition-colors',
              activeTab === t.id
                ? 'font-semibold border-b-2 border-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'csv-ai' && <CsvAiSection />}
      {activeTab === 'accounts' && <AccountsSection />}
      {activeTab === 'budget-splits' && <OverflowRatiosSection />}
      {activeTab === 'recurring' && <RecurringSection />}
      {activeTab === 'tax' && <TaxSection />}
      {activeTab === 'storage' && <StorageSection />}
    </div>
  );
}
