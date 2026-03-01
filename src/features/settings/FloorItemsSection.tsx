import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAccountStore } from '@/stores/accountStore';
import { parseCents, formatCents } from '@/lib/cents';
import type { FloorItem } from '@/types/domain';
import type { Cents } from '@/lib/cents';

type FloorItemDraft = {
  name: string;
  amountStr: string;      // e.g. '1200.00' — converted to cents on save
  priorityStr: string;    // e.g. '1' — converted to number on save
  destinationAccountId: string;
  expiryDate: string;     // '' = no expiry
};

type PendingFloorItem = {
  name: string;
  amountStr: string;
  destinationAccountId: string;
};

interface FloorItemsSectionProps {
  pendingFloorItem?: PendingFloorItem | null;
  onPendingConsumed?: () => void;
}

const EMPTY_DRAFT: FloorItemDraft = {
  name: '',
  amountStr: '',
  priorityStr: '1',
  destinationAccountId: '',
  expiryDate: '',
};

export function FloorItemsSection({
  pendingFloorItem,
  onPendingConsumed,
}: FloorItemsSectionProps = {}) {
  const floorItems = useSettingsStore(s => s.settings.floorItems);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const accounts = useAccountStore(s => s.accounts);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<FloorItemDraft>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<FloorItemDraft>({
    ...EMPTY_DRAFT,
    destinationAccountId: accounts[0]?.id ?? '',
  });
  const [pendingHighlight, setPendingHighlight] = useState(false);

  // Expiry auto-deactivation: run on every render cycle
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const hasExpired = floorItems.some(
      item => item.active && item.expiryDate && item.expiryDate < today
    );
    if (hasExpired) {
      const updated = floorItems.map(item =>
        item.active && item.expiryDate && item.expiryDate < today
          ? { ...item, active: false }
          : item
      );
      updateSettings({ floorItems: updated });
    }
  }, [floorItems, updateSettings]);

  // Pre-fill Add form when a floor suggestion is accepted from CsvAiSection (AIAN-06)
  useEffect(() => {
    if (!pendingFloorItem) return;

    // Pre-fill the Add form with AI-suggested values
    setNewItem({
      name: pendingFloorItem.name,
      amountStr: pendingFloorItem.amountStr,
      priorityStr: String(floorItems.length + 1),  // next priority after existing
      destinationAccountId:
        pendingFloorItem.destinationAccountId ||
        accounts[0]?.id ||
        '',
      expiryDate: '',
    });
    setShowAddForm(true);

    // Clear the pending item in parent BEFORE any further state update
    // This prevents the effect from re-firing (pendingFloorItem will be null next render)
    onPendingConsumed?.();

    // Brief ring highlight to draw attention to the pre-filled form
    setPendingHighlight(true);
    setTimeout(() => setPendingHighlight(false), 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFloorItem]);  // intentionally omit onPendingConsumed from deps (stable callback)

  const sorted = [...floorItems].sort((a, b) => a.priority - b.priority);
  const today = new Date().toISOString().slice(0, 10);

  // ---- Edit handlers ----

  const handleStartEdit = (item: FloorItem) => {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      amountStr: (item.amountCents / 100).toFixed(2),
      priorityStr: String(item.priority),
      destinationAccountId: item.destinationAccountId,
      expiryDate: item.expiryDate ?? '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const handleSaveEdit = async () => {
    const updated = floorItems.map(item =>
      item.id === editingId
        ? {
            ...item,
            name: draft.name ?? item.name,
            amountCents: draft.amountStr !== undefined
              ? (parseCents(draft.amountStr) as number)
              : item.amountCents,
            priority: draft.priorityStr !== undefined
              ? Math.max(1, parseInt(draft.priorityStr, 10) || 1)
              : item.priority,
            destinationAccountId: draft.destinationAccountId ?? item.destinationAccountId,
            expiryDate: draft.expiryDate !== undefined
              ? (draft.expiryDate === '' ? undefined : draft.expiryDate)
              : item.expiryDate,
          }
        : item
    );
    await updateSettings({ floorItems: updated });
    setEditingId(null);
    setDraft({});
  };

  // ---- Delete handler ----

  const handleDelete = async (item: FloorItem) => {
    if (!window.confirm(`Delete floor item "${item.name}"?`)) return;
    const filtered = floorItems.filter(fi => fi.id !== item.id);
    await updateSettings({ floorItems: filtered });
  };

  // ---- Add handler ----

  const handleAdd = async () => {
    const item: FloorItem = {
      id: crypto.randomUUID(),
      name: newItem.name.trim(),
      amountCents: parseCents(newItem.amountStr) as number,
      priority: Math.max(1, parseInt(newItem.priorityStr, 10) || 1),
      destinationAccountId: newItem.destinationAccountId || accounts[0]?.id || '',
      coveredThisMonth: false,
      expiryDate: newItem.expiryDate === '' ? undefined : newItem.expiryDate,
      active: true,
    };
    await updateSettings({ floorItems: [...floorItems, item] });
    setShowAddForm(false);
    setNewItem({
      ...EMPTY_DRAFT,
      destinationAccountId: accounts[0]?.id ?? '',
    });
  };

  // ---- Render helpers ----

  const getAccountName = (id: string) =>
    accounts.find(a => a.id === id)?.name ?? id;

  const isExpired = (item: FloorItem) =>
    !!item.expiryDate && item.expiryDate < today;

  // Edge case: no accounts configured
  if (accounts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 border border-border rounded">
        No accounts configured — add accounts first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map(item => {
        if (editingId === item.id) {
          // ---- Edit row ----
          return (
            <div
              key={item.id}
              className="flex flex-col gap-2 p-3 rounded border border-border"
            >
              <div className="flex items-center gap-2 flex-wrap">
                {/* Priority */}
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground">#</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.priorityStr ?? ''}
                    onChange={e => setDraft(d => ({ ...d, priorityStr: e.target.value }))}
                    className="w-16 text-sm border border-border rounded px-2 py-1 bg-background"
                  />
                </div>
                {/* Name */}
                <input
                  type="text"
                  value={draft.name ?? ''}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="Name"
                  className="flex-1 min-w-[120px] text-sm border border-border rounded px-2 py-1 bg-background"
                />
                {/* Amount */}
                <input
                  type="text"
                  value={draft.amountStr ?? ''}
                  onChange={e => setDraft(d => ({ ...d, amountStr: e.target.value }))}
                  placeholder="0.00"
                  className="w-24 text-sm border border-border rounded px-2 py-1 bg-background"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Destination account */}
                <select
                  value={draft.destinationAccountId ?? ''}
                  onChange={e => setDraft(d => ({ ...d, destinationAccountId: e.target.value }))}
                  className="flex-1 min-w-[140px] text-sm border border-border rounded px-2 py-1 bg-background"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {/* Expiry date */}
                <input
                  type="date"
                  value={draft.expiryDate ?? ''}
                  onChange={e => setDraft(d => ({ ...d, expiryDate: e.target.value }))}
                  className="text-sm border border-border rounded px-2 py-1 bg-background"
                />
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleSaveEdit}
                  className="text-xs px-3 py-1 rounded bg-foreground text-background font-medium hover:opacity-80 transition-opacity"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="text-xs px-3 py-1 rounded border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        }

        // ---- View row ----
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 rounded border border-border"
          >
            {/* Priority badge */}
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
              #{item.priority}
            </span>

            {/* Name */}
            <span className="flex-1 text-sm font-medium truncate">{item.name}</span>

            {/* Amount + destination + expiry info */}
            <span className="text-xs text-muted-foreground shrink-0">
              {formatCents(item.amountCents as Cents)} &middot; {getAccountName(item.destinationAccountId)}
              {item.expiryDate && (
                <> &middot; {isExpired(item) ? '' : `Expires ${item.expiryDate}`}</>
              )}
            </span>

            {/* Expired badge */}
            {isExpired(item) && (
              <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive shrink-0">
                Expired
              </span>
            )}

            {/* Inactive badge (not expired, but manually deactivated or just deactivated) */}
            {!item.active && !isExpired(item) && (
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                Inactive
              </span>
            )}

            {/* Actions */}
            <button
              onClick={() => handleStartEdit(item)}
              className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors shrink-0"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(item)}
              className="text-xs px-2 py-0.5 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            >
              Delete
            </button>
          </div>
        );
      })}

      {/* Add form */}
      {showAddForm && (
        <div className={[
          'flex flex-col gap-2 p-3 rounded border border-dashed',
          pendingHighlight ? 'border-primary ring-2 ring-primary/30' : 'border-border',
        ].join(' ')}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground">#</label>
              <input
                type="number"
                min={1}
                value={newItem.priorityStr}
                onChange={e => setNewItem(n => ({ ...n, priorityStr: e.target.value }))}
                className="w-16 text-sm border border-border rounded px-2 py-1 bg-background"
              />
            </div>
            <input
              type="text"
              value={newItem.name}
              onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
              placeholder="Name"
              className="flex-1 min-w-[120px] text-sm border border-border rounded px-2 py-1 bg-background"
            />
            <input
              type="text"
              value={newItem.amountStr}
              onChange={e => setNewItem(n => ({ ...n, amountStr: e.target.value }))}
              placeholder="0.00"
              className="w-24 text-sm border border-border rounded px-2 py-1 bg-background"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={newItem.destinationAccountId}
              onChange={e => setNewItem(n => ({ ...n, destinationAccountId: e.target.value }))}
              className="flex-1 min-w-[140px] text-sm border border-border rounded px-2 py-1 bg-background"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={newItem.expiryDate}
              onChange={e => setNewItem(n => ({ ...n, expiryDate: e.target.value }))}
              className="text-sm border border-border rounded px-2 py-1 bg-background"
            />
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleAdd}
              disabled={!newItem.name.trim() || !newItem.amountStr}
              className="text-xs px-3 py-1 rounded bg-foreground text-background font-medium hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewItem({ ...EMPTY_DRAFT, destinationAccountId: accounts[0]?.id ?? '' });
              }}
              className="text-xs px-3 py-1 rounded border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add floor item button */}
      {!showAddForm && (
        <button
          onClick={() => {
            setNewItem({ ...EMPTY_DRAFT, destinationAccountId: accounts[0]?.id ?? '' });
            setShowAddForm(true);
          }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-1"
        >
          + Add floor item
        </button>
      )}
    </div>
  );
}
