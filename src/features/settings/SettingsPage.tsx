import { useState } from 'react';
import { AccountsSection } from './AccountsSection';
import { FloorItemsSection } from './FloorItemsSection';
import { OverflowRatiosSection } from './OverflowRatiosSection';
import { TaxBufferSection } from './TaxBufferSection';
import { CsvAiSection } from './CsvAiSection';

type SettingsSection = 'accounts' | 'floor-items' | 'overflow-ratios' | 'tax-buffer' | 'csv-ai';

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'accounts',         label: 'Accounts' },
  { id: 'floor-items',      label: 'Floor Items' },
  { id: 'overflow-ratios',  label: 'Overflow Ratios' },
  { id: 'tax-buffer',       label: 'Tax & Buffer' },
  { id: 'csv-ai',           label: 'CSV & AI' },
];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('accounts');

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      {/* Sub-section tab bar */}
      <nav className="flex gap-4 border-b border-border mb-6">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={[
              'pb-2 text-sm transition-colors',
              activeSection === s.id
                ? 'font-semibold border-b-2 border-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* Section content — placeholders replaced in plans 02, 03, 04 */}
      {activeSection === 'accounts' && <AccountsSection />}
      {activeSection === 'floor-items' && <FloorItemsSection />}
      {activeSection === 'overflow-ratios' && <OverflowRatiosSection />}
      {activeSection === 'tax-buffer' && <TaxBufferSection />}
      {activeSection === 'csv-ai' && <CsvAiSection />}
    </div>
  );
}
