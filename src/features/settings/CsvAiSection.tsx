import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { parseCSVFile, detectBankFormat } from '@/lib/csvParser';
import type { ParsedTransaction } from '@/lib/csvParser';
import { callAnthropicAPI, AnthropicAPIError } from '@/lib/anthropicClient';
import type { AIAnalysisResult } from '@/lib/anthropicClient';

interface FileStatus {
  name: string;
  count: number;
  format: string;
}

/**
 * CsvAiSection — CSV & AI settings sub-section.
 *
 * Scope (Plan 02): API key management, file upload, transaction preview,
 * "Analyse with AI" button. Suggestion card UI is wired in Plan 03.
 *
 * API key stored only in localStorage('anthropic_api_key') — never in React state
 * beyond the masked display string.
 */
export function CsvAiSection() {
  const [apiKeyInput, setApiKeyInput] = useState(() =>
    localStorage.getItem('anthropic_api_key') ? '••••••••' : '',
  );
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // API key handlers
  // ---------------------------------------------------------------------------

  const handleSaveKey = () => {
    if (apiKeyInput && apiKeyInput !== '••••••••') {
      localStorage.setItem('anthropic_api_key', apiKeyInput);
      setApiKeyInput('••••••••');
    }
  };

  const handleClearKey = () => {
    localStorage.removeItem('anthropic_api_key');
    setApiKeyInput('');
  };

  // ---------------------------------------------------------------------------
  // File change handler
  // ---------------------------------------------------------------------------

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newStatuses: FileStatus[] = [];
    const allNewTransactions: ParsedTransaction[] = [];

    await Promise.all(
      files.map(async (file) => {
        // Detect format by peeking at headers
        const format = await new Promise<string>((resolve) => {
          Papa.parse<Record<string, string>>(file, {
            header: true,
            preview: 1,
            skipEmptyLines: true,
            complete: (result) => {
              const headers = result.meta.fields ?? [];
              const detected = detectBankFormat(headers);
              const label =
                detected === 'wise' ? 'Wise' :
                detected === 'n26' ? 'N26' :
                detected === 'revolut' ? 'Revolut' :
                'Unknown';
              resolve(label);
            },
            error: () => resolve('Unknown'),
          });
        });

        const parsed = await parseCSVFile(file).catch(() => [] as ParsedTransaction[]);

        newStatuses.push({ name: file.name, count: parsed.length, format });
        allNewTransactions.push(...parsed);
      }),
    );

    // Deduplicate against existing transactions by (date + description + amountEur)
    setTransactions((prev) => {
      const existingKeys = new Set(
        prev.map((t) => `${t.date}|${t.description}|${t.amountEur}`),
      );
      const unique = allNewTransactions.filter(
        (t) => !existingKeys.has(`${t.date}|${t.description}|${t.amountEur}`),
      );
      const merged = [...prev, ...unique];
      // Sort newest-first (ISO dates sort lexicographically)
      merged.sort((a, b) => b.date.localeCompare(a.date));
      return merged;
    });

    setFileStatuses((prev) => {
      // Replace status for files with same name; add new ones
      const existingNames = new Set(newStatuses.map((s) => s.name));
      const kept = prev.filter((s) => !existingNames.has(s.name));
      return [...kept, ...newStatuses];
    });
  };

  // ---------------------------------------------------------------------------
  // Analyse handler
  // ---------------------------------------------------------------------------

  const handleAnalyse = async () => {
    const key = localStorage.getItem('anthropic_api_key');
    if (!key || transactions.length === 0) return;
    setIsAnalysing(true);
    setAnalysisError(null);
    try {
      const result = await callAnthropicAPI(key, transactions);
      setAnalysisResult(result);
    } catch (e) {
      if (e instanceof AnthropicAPIError) {
        setAnalysisError(`API error ${e.status}: ${e.errorType}`);
      } else {
        setAnalysisError('Network error — check your connection and retry');
      }
    } finally {
      setIsAnalysing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasApiKey = Boolean(localStorage.getItem('anthropic_api_key'));
  const dateRange =
    transactions.length > 0
      ? {
          earliest: transactions[transactions.length - 1].date,
          latest: transactions[0].date,
        }
      : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">

      {/* API Key section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Anthropic API Key</h2>
        <p className="text-xs text-muted-foreground">
          Your API key is stored locally in your browser and never sent to our servers.
          You pay Anthropic directly for analysis.
        </p>

        <div className="flex items-center gap-3">
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="sk-ant-…"
            className="text-sm border border-border rounded px-2 py-1 bg-background w-56 font-mono"
          />
          <button
            onClick={handleSaveKey}
            disabled={!apiKeyInput || apiKeyInput === '••••••••'}
            className={[
              'px-3 py-1 rounded text-sm font-medium',
              apiKeyInput && apiKeyInput !== '••••••••'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            ].join(' ')}
          >
            Save
          </button>
          <button
            onClick={handleClearKey}
            disabled={!hasApiKey && !apiKeyInput}
            className="px-3 py-1 rounded text-sm font-medium border border-border hover:bg-muted"
          >
            Clear
          </button>
        </div>
      </div>

      {/* File Upload section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Upload Bank CSV</h2>
        <p className="text-xs text-muted-foreground">
          Supports Wise, N26, and Revolut exports. Upload 6+ months for best results.
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1 rounded text-sm font-medium border border-border hover:bg-muted"
        >
          Choose files
        </button>

        {/* File status list */}
        {fileStatuses.length > 0 && (
          <ul className="space-y-1">
            {fileStatuses.map((s) => (
              <li key={s.name} className="text-sm">
                <span className="font-medium">{s.name}</span>
                {' — '}
                {s.count > 0 ? (
                  <span className="text-muted-foreground">
                    {s.count} transaction{s.count !== 1 ? 's' : ''} ({s.format})
                  </span>
                ) : (
                  <span className="text-destructive">Unrecognised format</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Transaction preview */}
      {transactions.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}{' '}
            {dateRange && (
              <>from {dateRange.earliest} to {dateRange.latest}</>
            )}{' '}
            across {fileStatuses.length} file{fileStatuses.length !== 1 ? 's' : ''}
          </div>

          {/* Scrollable table */}
          <div className="max-h-64 overflow-y-auto border border-border rounded">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="text-left text-muted-foreground text-xs pb-1 px-2 pt-2">Date</th>
                  <th className="text-left text-muted-foreground text-xs pb-1 px-2 pt-2">Description</th>
                  <th className="text-right text-muted-foreground text-xs pb-1 px-2 pt-2">Amount (EUR)</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-0.5 px-2 tabular-nums whitespace-nowrap">{t.date}</td>
                    <td className="py-0.5 px-2 max-w-xs truncate">{t.description}</td>
                    <td className="py-0.5 px-2 text-right tabular-nums">
                      €{Math.abs(t.amountEur).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Analyse button */}
          <button
            onClick={handleAnalyse}
            disabled={!hasApiKey || isAnalysing}
            title={!hasApiKey ? 'Enter an API key above first' : undefined}
            className={[
              'px-4 py-2 rounded text-sm font-medium',
              hasApiKey && !isAnalysing
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            ].join(' ')}
          >
            {isAnalysing ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Analysing…
              </span>
            ) : (
              'Analyse with AI'
            )}
          </button>

          {/* Error display */}
          {analysisError && (
            <p className="text-sm text-destructive">{analysisError}</p>
          )}
        </div>
      )}

      {/* Suggestion cards placeholder — Plan 03 replaces this with full suggestion UI */}
      {analysisResult && <div data-testid="analysis-result-placeholder" />}
    </div>
  );
}
