import { useState } from 'react';
import { useAccountStore } from '@/stores/accountStore';
import { parseCents, formatCents } from '@/lib/cents';
import type { Account, AccountRole } from '@/types/domain';
import type { Cents } from '@/lib/cents';

const ROLES: AccountRole[] = ['income-hub', 'spending', 'savings', 'tax', 'investing'];

type DraftState = {
  name?: string;
  role?: AccountRole;
  targetStr?: string;
};

type NewAccState = {
  name: string;
  role: AccountRole;
  target: string;
};

export function AccountsSection() {
  const accounts = useAccountStore(s => s.accounts);
  const setAccounts = useAccountStore(s => s.setAccounts);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAcc, setNewAcc] = useState<NewAccState>({
    name: '',
    role: 'spending',
    target: '',
  });

  const handleEdit = (account: Account) => {
    setEditingId(account.id);
    setDraft({
      name: account.name,
      role: account.role,
      targetStr: account.targetCents === 0 ? '' : (account.targetCents / 100).toFixed(2),
    });
  };

  const handleSaveEdit = async () => {
    const updated = accounts.map(a =>
      a.id === editingId
        ? {
            ...a,
            name: draft.name ?? a.name,
            role: draft.role ?? a.role,
            targetCents: draft.targetStr !== undefined
              ? (parseCents(draft.targetStr) as number)
              : a.targetCents,
          }
        : a
    );
    await setAccounts(updated);
    setEditingId(null);
    setDraft({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const handleDelete = async (account: Account) => {
    if (!window.confirm(`Delete account "${account.name}"? This cannot be undone.`)) return;
    const filtered = accounts.filter(a => a.id !== account.id);
    await setAccounts(filtered);
  };

  const handleAdd = async () => {
    if (!newAcc.name.trim()) return;
    const newAccount: Account = {
      id: crypto.randomUUID(),
      name: newAcc.name.trim(),
      role: newAcc.role,
      balanceCents: 0,
      targetCents: newAcc.target ? (parseCents(newAcc.target) as number) : 0,
    };
    await setAccounts([...accounts, newAccount]);
    setShowAddForm(false);
    setNewAcc({ name: '', role: 'spending', target: '' });
  };

  return (
    <div className="space-y-2">
      {accounts.map(account =>
        editingId === account.id ? (
          /* Edit row */
          <div
            key={account.id}
            className="flex flex-wrap items-center gap-2 p-3 rounded border border-border bg-muted/30"
          >
            <input
              type="text"
              value={draft.name ?? ''}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              placeholder="Account name"
              className="text-sm border border-border rounded px-2 py-1 bg-background flex-1 min-w-[120px]"
            />
            <select
              value={draft.role ?? 'spending'}
              onChange={e => setDraft(d => ({ ...d, role: e.target.value as AccountRole }))}
              className="text-sm border border-border rounded px-2 py-1 bg-background"
            >
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Target (€)</label>
              <input
                type="text"
                value={draft.targetStr ?? ''}
                onChange={e => setDraft(d => ({ ...d, targetStr: e.target.value }))}
                placeholder="0.00"
                className="text-sm border border-border rounded px-2 py-1 bg-background w-24"
              />
            </div>
            <button
              onClick={handleSaveEdit}
              className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          /* View row */
          <div
            key={account.id}
            className="flex items-center gap-3 p-3 rounded border border-border"
          >
            <span className="flex-1 text-sm font-medium">{account.name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {account.role}
            </span>
            <span className="text-xs text-muted-foreground">
              {account.targetCents === 0
                ? 'No target'
                : formatCents(account.targetCents as Cents)}
            </span>
            <button
              onClick={() => handleEdit(account)}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(account)}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
            >
              Delete
            </button>
          </div>
        )
      )}

      {showAddForm && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded border border-border border-dashed bg-muted/20 mt-2">
          <input
            type="text"
            value={newAcc.name}
            onChange={e => setNewAcc(n => ({ ...n, name: e.target.value }))}
            placeholder="Account name"
            className="text-sm border border-border rounded px-2 py-1 bg-background flex-1 min-w-[120px]"
          />
          <select
            value={newAcc.role}
            onChange={e => setNewAcc(n => ({ ...n, role: e.target.value as AccountRole }))}
            className="text-sm border border-border rounded px-2 py-1 bg-background"
          >
            {ROLES.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Target (€)</label>
            <input
              type="text"
              value={newAcc.target}
              onChange={e => setNewAcc(n => ({ ...n, target: e.target.value }))}
              placeholder="0.00"
              className="text-sm border border-border rounded px-2 py-1 bg-background w-24"
            />
          </div>
          <button
            onClick={handleAdd}
            className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground"
          >
            Add
          </button>
          <button
            onClick={() => {
              setShowAddForm(false);
              setNewAcc({ name: '', role: 'spending', target: '' });
            }}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}

      <button
        onClick={() => setShowAddForm(true)}
        disabled={showAddForm}
        className="mt-4 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        + Add account
      </button>
    </div>
  );
}
