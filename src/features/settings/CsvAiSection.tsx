/**
 * CsvAiSection — CSV expense analysis + budget split assistant.
 *
 * Flow:
 *   1. Drop CSV files (N26, Revolut, Wise — auto-detected)
 *   2. Parse expenses, run recurring detection
 *   3. Optionally run AI analysis for category breakdown
 *   4. Show results, then offer two paths:
 *      a) "Apply as splits" — map categories to accounts, apply to overflowRatios
 *      b) "Discuss with AI" — conversational split advisor
 */
import { useState, useRef, useEffect } from 'react';
import { parseCSVFile } from '@/lib/csvParser';
import type { ParsedTransaction } from '@/lib/csvParser';
import { detectRecurring } from '@/lib/recurringDetector';
import type { RecurringExpense } from '@/lib/recurringDetector';
import { callCombinedAnalysis, callSplitChat, AnthropicAPIError } from '@/lib/anthropicClient';
import type { CombinedAnalysisResult, SplitChatMessage, UncertainTransaction } from '@/lib/anthropicClient';
import { useAccountStore } from '@/stores/accountStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ConfirmedRecurring } from '@/types/domain';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadedFile {
  name: string;
  count: number;
}

type Phase =
  | { step: 'idle' }
  | { step: 'loaded'; files: LoadedFile[]; transactions: ParsedTransaction[] }
  | { step: 'analyzing' }
  | { step: 'retrying-ai'; transactions: ParsedTransaction[]; recurring: RecurringExpense[]; dateRange: { from: string; to: string; months: number } }
  | {
      step: 'results';
      transactions: ParsedTransaction[];
      recurring: RecurringExpense[];
      aiResult: CombinedAnalysisResult | null;
      aiSkipped: boolean;   // true = no key when analysis ran
      aiError: string | null; // non-null = call was attempted but failed
      dateRange: { from: string; to: string; months: number };
    }
  | { step: 'error'; message: string };

const BUCKET_KEYS = ['everydayEssentials', 'funDiscretionary', 'oneOffTravel', 'recurringFixed'] as const;
type BucketKey = typeof BUCKET_KEYS[number];

const BUCKET_LABELS: Record<BucketKey, string> = {
  everydayEssentials: 'Everyday Essentials',
  funDiscretionary: 'Fun & Discretionary',
  oneOffTravel: 'One-off & Travel',
  recurringFixed: 'Recurring Fixed',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateRange(transactions: ParsedTransaction[]): { from: string; to: string; months: number } {
  const dates = transactions.map(t => t.date).sort();
  if (dates.length === 0) return { from: '', to: '', months: 0 };
  const from = dates[0];
  const to = dates[dates.length - 1];
  const d1 = new Date(from);
  const d2 = new Date(to);
  const months = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  return { from, to, months };
}

function buildSplitSystemContext(
  aiResult: CombinedAnalysisResult,
  accountNames: string[],
  monthlyIncomeEur: number | null,
): string {
  const lines = BUCKET_KEYS.map(k => {
    const b = aiResult[k];
    return `- ${BUCKET_LABELS[k]}: €${b.suggestedMonthlyAmountEur}/mo avg (${b.reasoning})`;
  });
  const total = BUCKET_KEYS.reduce((s, k) => s + aiResult[k].suggestedMonthlyAmountEur, 0);
  const incomeNote = monthlyIncomeEur
    ? `Monthly post-tax income: €${monthlyIncomeEur}. Savings potential: €${(monthlyIncomeEur - total).toFixed(0)}/mo.`
    : `Total suggested spending: €${total.toFixed(0)}/mo. Monthly income unknown.`;

  return [
    "You are a friendly budget planning assistant. The user has analyzed their bank transactions and wants to decide how to split their post-tax freelance income across accounts.",
    "",
    "Spending breakdown from their data:",
    ...lines,
    "",
    incomeNote,
    "",
    `Their accounts: ${accountNames.join(', ')}.`,
    "",
    "Help them think through their budget split. Be concise and practical. When suggesting percentages, be specific. If they give you their income, calculate exact amounts. Don't be preachy.",
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Uncertain transactions panel (collapsible, informational only)
// ---------------------------------------------------------------------------

function UncertainTransactionsPanel({ transactions }: { transactions: UncertainTransaction[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-border">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
      >
        <span>{transactions.length} transaction{transactions.length === 1 ? '' : 's'} flagged as uncertain</span>
        <span className="text-muted-foreground text-xs">{open ? 'close ▲' : 'open ▼'}</span>
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {transactions.map((t, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.reason}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular-nums font-medium">€{Math.abs(t.amountEur).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{t.date}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CsvAiSection() {
  const accounts = useAccountStore(s => s.accounts);
  const updateSettings = useSettingsStore(s => s.updateSettings);

  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('anthropic_api_key') ?? '');
  const [showKey, setShowKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Split application state
  const [splitMapping, setSplitMapping] = useState<Partial<Record<BucketKey, string>>>({}); // bucketKey → accountId
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [splitApplied, setSplitApplied] = useState(false);

  // AI chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<SplitChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Recurring expenses editing state
  interface LocalRecurring {
    merchant: string;
    occurrences: number;
    confidence: 'high' | 'medium';
    amountStr: string;
    frequency: 'monthly' | 'yearly';
    included: boolean;
    source: 'ai' | 'algo';
  }
  const [localRecurring, setLocalRecurring] = useState<LocalRecurring[]>([]);
  const [commitmentsSaved, setCommitmentsSaved] = useState(false);

  useEffect(() => {
    if (phase.step !== 'results') return;

    // Prefer AI-extracted items from Recurring Fixed bucket (more complete than algorithmic detection)
    const aiItems = phase.aiResult?.recurringFixed.items ?? [];
    if (aiItems.length > 0) {
      setLocalRecurring(aiItems.map(item => ({
        merchant: item.merchant,
        occurrences: 0,         // N/A for AI-sourced items
        confidence: 'high' as const,
        amountStr: item.frequency === 'yearly'
          ? (item.monthlyAmountEur * 12).toFixed(2)  // store the full yearly charge
          : item.monthlyAmountEur.toFixed(2),
        frequency: item.frequency,
        included: true,
        source: 'ai' as const,
      })));
      setCommitmentsSaved(false);
      return;
    }

    // Fall back to algorithmic detection when no AI
    if (phase.recurring.length > 0) {
      setLocalRecurring(phase.recurring.map(r => ({
        merchant: r.merchant,
        occurrences: r.occurrences,
        confidence: r.confidence,
        amountStr: r.avgAmountEur.toFixed(2),
        frequency: 'monthly' as const,
        included: r.confidence === 'high',
        source: 'algo' as const,
      })));
      setCommitmentsSaved(false);
    }
  }, [phase.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLocalRecurring = (index: number, patch: Partial<LocalRecurring>) => {
    setLocalRecurring(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
    setCommitmentsSaved(false);
  };

  const handleSaveCommitments = async () => {
    const included = localRecurring.filter(r => r.included);
    if (included.length === 0) return;
    const confirmed: ConfirmedRecurring[] = included.map(r => {
      const chargeEur = parseFloat(r.amountStr) || 0;
      const chargeCents = Math.round(chargeEur * 100);
      const monthlyCents = r.frequency === 'yearly' ? Math.round(chargeCents / 12) : chargeCents;
      return {
        merchant: r.merchant,
        frequency: r.frequency,
        chargeAmountCents: chargeCents,
        monthlyAmountCents: monthlyCents,
      };
    });
    await updateSettings({ confirmedRecurring: confirmed });
    setCommitmentsSaved(true);
  };

  // ── File loading ──────────────────────────────────────────────────────────

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allTransactions: ParsedTransaction[] = [];
    const loadedFiles: LoadedFile[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const txs = await parseCSVFile(file);
        const expenses = txs.filter(t => t.amountEur < 0);
        if (expenses.length > 0) {
          loadedFiles.push({ name: file.name, count: expenses.length });
          allTransactions.push(...expenses);
        } else {
          errors.push(`${file.name}: no expenses found`);
        }
      } catch {
        errors.push(`${file.name}: failed to parse`);
      }
    }

    if (allTransactions.length === 0) {
      setPhase({
        step: 'error',
        message: errors.length > 0 ? errors.join('\n') : 'No expense transactions found.',
      });
      return;
    }

    setPhase({ step: 'loaded', files: loadedFiles, transactions: allTransactions });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    void processFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    void processFiles(e.target.files);
  };

  // ── Analysis ─────────────────────────────────────────────────────────────

  const runAiOnTransactions = async (
    transactions: ParsedTransaction[],
    recurring: RecurringExpense[],
    dateRange: { from: string; to: string; months: number },
  ) => {
    let aiResult: CombinedAnalysisResult | null = null;
    let aiError: string | null = null;
    const aiSkipped = !apiKey.trim();

    if (!aiSkipped) {
      try {
        aiResult = await callCombinedAnalysis(apiKey.trim(), transactions);
      } catch (err) {
        aiError = err instanceof AnthropicAPIError
          ? `API error ${err.status}: ${err.errorType}`
          : 'Network error — check your connection';
      }
    }

    setChatOpen(!!aiResult);
    setPhase({ step: 'results', transactions, recurring, aiResult, aiSkipped, aiError, dateRange });
  };

  const runAnalysis = async () => {
    if (phase.step !== 'loaded') return;
    const { transactions } = phase;

    setPhase({ step: 'analyzing' });

    const recurring = detectRecurring(transactions);
    const dateRange = getDateRange(transactions);

    setSplitMapping({});
    setSplitApplied(false);
    setChatMessages([]);
    await runAiOnTransactions(transactions, recurring, dateRange);
  };

  // Retry just the AI call without re-uploading
  const retryAiAnalysis = async () => {
    if (phase.step !== 'results' || !apiKey.trim()) return;
    const { transactions, recurring, dateRange } = phase;
    setPhase({ step: 'retrying-ai', transactions, recurring, dateRange });
    await runAiOnTransactions(transactions, recurring, dateRange);
  };

  // ── Save API key ──────────────────────────────────────────────────────────

  const saveApiKey = () => {
    const trimmed = apiKey.trim();
    if (trimmed) localStorage.setItem('anthropic_api_key', trimmed);
    else localStorage.removeItem('anthropic_api_key');
  };

  // ── Split application ─────────────────────────────────────────────────────

  const getIncomeEur = (): number | null => {
    const v = parseFloat(monthlyIncome.replace(',', '.'));
    return isNaN(v) || v <= 0 ? null : v;
  };

  const computeSplitRows = (aiResult: CombinedAnalysisResult) => {
    const income = getIncomeEur();
    const totalSuggested = BUCKET_KEYS.reduce((s, k) => s + aiResult[k].suggestedMonthlyAmountEur, 0);
    const base = income ?? totalSuggested;

    return BUCKET_KEYS.map(key => {
      const amount = aiResult[key].suggestedMonthlyAmountEur;
      const pct = base > 0 ? Math.round((amount / base) * 100 * 10) / 10 : 0;
      return { key, label: BUCKET_LABELS[key], amount, pct };
    });
  };

  const handleApplySplits = async (aiResult: CombinedAnalysisResult) => {
    // Consolidate by accountId, summing percentages
    const byAccount: Record<string, number> = {};
    const rows = computeSplitRows(aiResult);
    for (const row of rows) {
      const accountId = splitMapping[row.key];
      if (!accountId) continue;
      byAccount[accountId] = (byAccount[accountId] ?? 0) + row.pct;
    }

    const ratios = Object.entries(byAccount).map(([accountId, pct]) => ({
      accountId,
      pct: Math.round(pct * 10) / 10,
    }));

    if (ratios.length === 0) return;
    await updateSettings({ overflowRatios: ratios });
    setSplitApplied(true);
  };

  // ── AI chat ───────────────────────────────────────────────────────────────

  const handleChatSend = async (aiResult: CombinedAnalysisResult) => {
    const text = chatInput.trim();
    if (!text || !apiKey.trim()) return;

    const income = getIncomeEur();
    const systemContext = buildSplitSystemContext(
      aiResult,
      accounts.map(a => a.name),
      income,
    );

    const newHistory: SplitChatMessage[] = [
      ...chatMessages,
      { role: 'user', content: text },
    ];
    setChatMessages(newHistory);
    setChatInput('');
    setChatLoading(true);
    setChatError('');

    try {
      const reply = await callSplitChat(apiKey.trim(), systemContext, newHistory);
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setChatError('Failed to reach AI. Check your API key.');
    } finally {
      setChatLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* API key */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Anthropic API Key</label>
        <p className="text-xs text-muted-foreground">
          Required for AI category analysis and split discussion. Recurring detection works without it.
        </p>
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onBlur={saveApiKey}
            placeholder="sk-ant-..."
            className="flex-1 px-3 h-9 text-sm rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-ring font-mono"
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            className="px-3 h-9 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <hr className="border-border" />

      {/* Drop zone */}
      {(phase.step === 'idle' || phase.step === 'error') && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border px-6 py-12 cursor-pointer hover:bg-muted/30 transition-colors text-center"
          >
            <p className="text-sm font-medium">Drop CSV files here</p>
            <p className="text-xs text-muted-foreground">
              N26, Revolut, or Wise exports — multiple files at once OK
            </p>
            <button
              type="button"
              className="px-4 py-1.5 rounded-md border border-border text-sm hover:bg-muted"
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              Select files
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          {phase.step === 'error' && (
            <p className="text-sm text-destructive whitespace-pre-wrap">{phase.message}</p>
          )}
        </>
      )}

      {/* Files loaded */}
      {phase.step === 'loaded' && (
        <div className="space-y-4">
          <div className="rounded-md border border-border divide-y divide-border">
            {phase.files.map(f => (
              <div key={f.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium truncate">{f.name}</span>
                <span className="text-muted-foreground shrink-0 ml-4">{f.count} expenses</span>
              </div>
            ))}
            <div className="px-4 py-2.5 text-sm text-muted-foreground">
              {phase.transactions.length} transactions total
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void runAnalysis()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              {apiKey.trim() ? 'Analyze with AI' : 'Detect recurring expenses'}
            </button>
            <button
              onClick={() => setPhase({ step: 'idle' })}
              className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Analyzing / retrying */}
      {(phase.step === 'analyzing' || phase.step === 'retrying-ai') && (
        <div className="flex items-center gap-3 py-8 justify-center text-sm text-muted-foreground">
          <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full inline-block" />
          {phase.step === 'retrying-ai' ? 'Running AI analysis…' : 'Analyzing transactions…'}
        </div>
      )}

      {/* Results */}
      {phase.step === 'results' && (
        <div className="space-y-6">

          {/* ── What the AI found ── */}
          {phase.aiResult ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold">
                  Your spending breakdown
                  <span className="ml-2 font-normal text-muted-foreground text-xs">
                    {phase.transactions.length} expenses · {phase.dateRange.from} → {phase.dateRange.to}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use this to set your budget splits below — how much of each invoice goes where.
                </p>
              </div>
              <div className="rounded-md border border-border divide-y divide-border">
                {BUCKET_KEYS.map(key => {
                  const b = phase.aiResult![key];
                  return (
                    <div key={key} className="px-4 py-3 text-sm">
                      <div className="flex items-baseline justify-between gap-4 mb-0.5">
                        <span className="font-medium">{BUCKET_LABELS[key]}</span>
                        <span className="tabular-nums font-semibold shrink-0">
                          €{b.suggestedMonthlyAmountEur}/mo
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{b.reasoning}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3 space-y-3">
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {phase.aiError ? 'AI analysis failed' : 'AI analysis not run'}
                </p>
                <p className="text-amber-800 dark:text-amber-200 text-xs mt-0.5">
                  {phase.aiError
                    ? `${phase.aiError}. Check your API key and try again.`
                    : phase.aiSkipped
                      ? 'No API key was set — only recurring detection ran. Add your key below and run AI analysis to get a spending breakdown and budget split suggestions.'
                      : 'Something went wrong. Try again.'}
                </p>
              </div>
              {phase.aiSkipped ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex items-center rounded-md border border-amber-300 dark:border-amber-700 overflow-hidden flex-1 bg-white dark:bg-background">
                      <span className="px-2 text-xs text-muted-foreground bg-muted border-r border-amber-300 dark:border-amber-700 h-8 flex items-center select-none font-mono">sk-ant</span>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={e => {
                        const v = e.target.value;
                        setApiKey(v);
                        if (v.trim()) localStorage.setItem('anthropic_api_key', v.trim());
                        else localStorage.removeItem('anthropic_api_key');
                      }}
                        placeholder="paste your API key here"
                        className="flex-1 px-2 h-8 text-xs bg-transparent outline-none font-mono"
                      />
                    </div>
                    <button
                      onClick={() => void retryAiAnalysis()}
                      disabled={!apiKey.trim()}
                      className="px-4 h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      Run AI analysis
                    </button>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Get your key at console.anthropic.com — you pay per use, ~€0.01 per analysis.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => void retryAiAnalysis()}
                  disabled={!apiKey.trim()}
                  className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  Retry AI analysis
                </button>
              )}
            </div>
          )}

          {/* ── Uncertain transactions ── */}
          {(phase.aiResult?.uncertainTransactions?.length ?? 0) > 0 && (
            <UncertainTransactionsPanel transactions={phase.aiResult!.uncertainTransactions} />
          )}

          {/* ── Set budget splits ── */}
          {phase.aiResult && accounts.length > 0 && (
            <div className="rounded-md border border-border">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold">Set your budget splits</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  For each spending category, pick which account receives that allocation.
                  Enter your monthly post-tax income to calculate savings potential.
                </p>
              </div>

              <div className="px-4 py-3 space-y-4">
                {/* Income input */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground shrink-0 w-44">
                    Monthly post-tax income:
                  </label>
                  <div className="flex items-center rounded-md border border-border overflow-hidden w-32">
                    <span className="px-2 text-xs text-muted-foreground bg-muted border-r border-border h-8 flex items-center select-none">€</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 3000"
                      value={monthlyIncome}
                      onChange={e => setMonthlyIncome(e.target.value)}
                      className="flex-1 px-2 h-8 text-xs bg-background outline-none"
                    />
                  </div>
                  {monthlyIncome && !getIncomeEur() && (
                    <span className="text-xs text-destructive">Invalid</span>
                  )}
                </div>

                {/* Mapping rows */}
                <div className="rounded-md border border-border divide-y divide-border">
                  {computeSplitRows(phase.aiResult).map(row => (
                    <div key={row.key} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{row.label}</p>
                        <p className="text-xs text-muted-foreground">
                          €{row.amount}/mo → {row.pct}%{getIncomeEur() ? ' of income' : ' of spending'}
                        </p>
                      </div>
                      <select
                        value={splitMapping[row.key] ?? ''}
                        onChange={e => {
                          setSplitMapping(prev => ({ ...prev, [row.key]: e.target.value }));
                          setSplitApplied(false);
                        }}
                        className="text-sm border border-border rounded px-2 py-1 bg-background"
                      >
                        <option value="">Skip</option>
                        {accounts
                          .filter(a => a.role !== 'tax')
                          .map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                {(() => {
                  const income = getIncomeEur();
                  const rows = computeSplitRows(phase.aiResult!);
                  const mappedPct = Math.round(rows.filter(r => splitMapping[r.key]).reduce((s, r) => s + r.pct, 0) * 10) / 10;
                  const remaining = income ? Math.round((100 - mappedPct) * 10) / 10 : null;
                  return (
                    <div className="text-xs text-muted-foreground">
                      {remaining !== null
                        ? <span>Allocated: {mappedPct}% · <span className="text-green-600 font-medium">Savings/investing: {remaining}% (€{((income! * remaining) / 100).toFixed(0)}/mo)</span></span>
                        : <span>Allocated: {mappedPct}% of spending — enter income above to see savings room.</span>
                      }
                    </div>
                  );
                })()}

                <button
                  onClick={() => void handleApplySplits(phase.aiResult!)}
                  disabled={!Object.values(splitMapping).some(Boolean)}
                  className={[
                    'px-4 py-2 rounded-md text-sm font-medium',
                    Object.values(splitMapping).some(Boolean)
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed',
                  ].join(' ')}
                >
                  {splitApplied ? 'Saved!' : 'Apply these splits'}
                </button>
                {splitApplied && (
                  <p className="text-xs text-muted-foreground">
                    Splits saved. Check Budget Splits above — adjust to make them sum to 100% and add any savings/investing accounts.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Discuss with AI ── */}
          {phase.aiResult && apiKey.trim() && (
            <div className="rounded-md border border-border">
              <button
                onClick={() => setChatOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
              >
                <span>Discuss splits with AI</span>
                <span className="text-muted-foreground text-xs">{chatOpen ? 'close ▲' : 'open ▼'}</span>
              </button>

              {chatOpen && (
                <div className="border-t border-border px-4 py-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Ask about savings goals, how to split across accounts, or what percentages make sense for your income.
                    {monthlyIncome && getIncomeEur() ? ` Income: €${getIncomeEur()}/mo.` : ' Tip: enter your income above for better advice.'}
                  </p>

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {chatMessages.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-2">
                        Try: "I want to save 20% each month" · "Help me figure out how much to invest" · "What should I budget for fun?"
                      </p>
                    )}
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`text-sm rounded-md px-3 py-2 ${
                          msg.role === 'user'
                            ? 'bg-primary/10 ml-8'
                            : 'bg-muted mr-8'
                        }`}
                      >
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {msg.role === 'user' ? 'You' : 'AI'}
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                        <span className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full inline-block" />
                        Thinking…
                      </div>
                    )}
                    {chatError && <p className="text-xs text-destructive">{chatError}</p>}
                    <div ref={chatBottomRef} />
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleChatSend(phase.aiResult!);
                        }
                      }}
                      placeholder="Ask about your budget split…"
                      disabled={chatLoading}
                      className="flex-1 px-3 h-9 text-sm rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                      autoFocus
                    />
                    <button
                      onClick={() => void handleChatSend(phase.aiResult!)}
                      disabled={chatLoading || !chatInput.trim()}
                      className="px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Recurring expenses (editable) ── */}
          {localRecurring.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {phase.step === 'results' && (phase.aiResult?.recurringFixed.items?.length ?? 0) > 0
                    ? `Recurring Fixed — AI breakdown (${localRecurring.length} items)`
                    : `Recurring subscriptions detected (${localRecurring.length})`}
                </p>
                <button
                  onClick={() => void handleSaveCommitments()}
                  disabled={!localRecurring.some(r => r.included) || commitmentsSaved}
                  className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
                >
                  {commitmentsSaved ? 'Saved' : 'Save commitments'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Check items to save as monthly commitments. Toggle /mo vs /yr — yearly charges show their monthly equivalent.
              </p>
              <div className="rounded-md border border-border divide-y divide-border">
                {localRecurring.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={r.included}
                      onChange={e => updateLocalRecurring(i, { included: e.target.checked })}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{r.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.source === 'ai'
                          ? 'AI-detected'
                          : `${r.occurrences}× · ${r.confidence} confidence`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={r.amountStr}
                        onChange={e => updateLocalRecurring(i, { amountStr: e.target.value })}
                        className="w-20 text-sm border border-border rounded px-2 py-0.5 bg-background text-right tabular-nums"
                      />
                      <div className="flex rounded border border-border overflow-hidden text-xs">
                        <button
                          onClick={() => updateLocalRecurring(i, { frequency: 'monthly' })}
                          className={r.frequency === 'monthly'
                            ? 'px-2 py-0.5 bg-primary text-primary-foreground'
                            : 'px-2 py-0.5 hover:bg-muted'}
                        >/mo</button>
                        <button
                          onClick={() => updateLocalRecurring(i, { frequency: 'yearly' })}
                          className={r.frequency === 'yearly'
                            ? 'px-2 py-0.5 bg-primary text-primary-foreground'
                            : 'px-2 py-0.5 hover:bg-muted'}
                        >/yr</button>
                      </div>
                      {r.frequency === 'yearly' && (
                        <span className="text-xs text-muted-foreground w-20 text-right tabular-nums">
                          ≈€{(parseFloat(r.amountStr || '0') / 12).toFixed(2)}/mo
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {localRecurring.filter(r => r.included).length > 0 && (
                <p className="text-xs text-muted-foreground text-right tabular-nums">
                  Total monthly: €{localRecurring
                    .filter(r => r.included)
                    .reduce((sum, r) => {
                      const amt = parseFloat(r.amountStr) || 0;
                      return sum + (r.frequency === 'yearly' ? amt / 12 : amt);
                    }, 0)
                    .toFixed(2)}
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => setPhase({ step: 'idle' })}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Analyze different files
          </button>
        </div>
      )}
    </div>
  );
}
