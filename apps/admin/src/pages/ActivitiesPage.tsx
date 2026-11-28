import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Daily activities a guardian can pick for their learners (table activity_presets, migration 106).
// Each activity: an emoji + a name shown on the tile, and two colours (accent + tile background).
// Grid order = sort_order. Hidden activities leave the guardian's grid.
// `key` is what guardians' selections store (guardian_activities.preset_key), so it's set once from
// the name when an activity is added and never changes.
// ⚠️ The mobile app still uses its own built-in list until its code is switched to this table.

interface Activity {
  key: string;
  emoji: string;
  name: string;
  color: string;
  bg_color: string;
  sort_order: number;
  is_active: boolean;
}

const NAME_MAX  = 20;   // short — shown on a small tile
const EMOJI_MAX = 8;    // one emoji (some are several characters)

const EMPTY = { emoji: '', name: '', color: '#4A90E2', bg_color: '#EBF4FF' };

/** 'Read a Book' → 'read_a_book' (letters, digits, underscores — the DB requires this). */
function keyFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'activity';
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(EMPTY);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error: err } = await supabase
      .from('activity_presets')
      .select('key, emoji, name, color, bg_color, sort_order, is_active')
      .order('sort_order');
    if (err) setError(err.message);
    setActivities((data ?? []) as Activity[]);
    setLoading(false);
  }

  function startEdit(a: Activity) {
    setEditingKey(a.key);
    setForm({ emoji: a.emoji, name: a.name, color: a.color, bg_color: a.bg_color });
    setError(null);
  }

  function cancelEdit() {
    setEditingKey(null);
    setForm(EMPTY);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const emoji = form.emoji.trim(), name = form.name.trim();
    if (!emoji || !name) { setError('Emoji and name are both required.'); return; }
    setSaving(true);
    setError(null);
    let err;
    if (editingKey) {
      ({ error: err } = await supabase.from('activity_presets')
        .update({ emoji, name, color: form.color, bg_color: form.bg_color }).eq('key', editingKey));
    } else {
      // New key from the name; add _2, _3… if it's taken (keys are never reused or renamed)
      const base = keyFromName(name);
      let key = base;
      for (let n = 2; activities.some(a => a.key === key); n++) key = `${base}_${n}`;
      ({ error: err } = await supabase.from('activity_presets').insert({
        key, emoji, name, color: form.color, bg_color: form.bg_color,
        sort_order: (activities.reduce((m, a) => Math.max(m, a.sort_order), 0)) + 1,   // add at the end
      }));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    cancelEdit();
    load();
  }

  async function toggleActive(a: Activity) {
    const { error: err } = await supabase.from('activity_presets').update({ is_active: !a.is_active }).eq('key', a.key);
    if (err) { setError(err.message); return; }
    setActivities(prev => prev.map(x => x.key === a.key ? { ...x, is_active: !x.is_active } : x));
  }

  // Swap grid position with the neighbour above (-1) or below (+1)
  async function move(index: number, dir: -1 | 1) {
    const a = activities[index], b = activities[index + dir];
    if (!a || !b) return;
    const [r1, r2] = await Promise.all([
      supabase.from('activity_presets').update({ sort_order: b.sort_order }).eq('key', a.key),
      supabase.from('activity_presets').update({ sort_order: a.sort_order }).eq('key', b.key),
    ]);
    if (r1.error || r2.error) { setError((r1.error ?? r2.error)!.message); return; }
    load();
  }

  async function remove(a: Activity) {
    if (!window.confirm(`Delete "${a.name}"? To keep it for guardians who already picked it, use Hide instead.`)) return;
    const { error: err } = await supabase.from('activity_presets').delete().eq('key', a.key);
    if (err) { setError(err.message); return; }
    if (editingKey === a.key) cancelEdit();
    setActivities(prev => prev.filter(x => x.key !== a.key));
  }

  const activeCount = activities.filter(a => a.is_active).length;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>✅ Daily Activities</h1>
          <p style={s.subtitle}>
            Activities a guardian can pick for their learners' daily checklist. Hidden activities leave the
            guardian's list. The maximum a guardian can pick is set on the Settings page.
          </p>
          <p style={s.notice}>
            The mobile app doesn't read this list yet — it still uses its built-in activities until the app is
            updated.
          </p>
        </div>
        <span style={s.badge}>{activeCount} shown · {activities.length} total</span>
      </div>

      {/* Add / edit form */}
      <form onSubmit={save} style={s.formCard}>
        <div style={s.formTitle}>{editingKey ? 'Edit activity' : 'Add an activity'}</div>
        <div style={s.formRow}>
          <label style={{ ...s.field, flex: '0 0 90px' }}>
            <span style={s.fieldLabel}>Emoji</span>
            <input style={{ ...s.input, textAlign: 'center', fontSize: 20 }} value={form.emoji} maxLength={EMOJI_MAX}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🪥" disabled={saving} />
            {/* How to type an emoji (Mac emoji picker; Windows: Win + .) */}
            <span style={s.hint}>Control + Command + Space</span>
          </label>
          <label style={{ ...s.field, flex: 1 }}>
            <span style={s.fieldLabel}>Name <span style={s.count}>{form.name.length}/{NAME_MAX}</span></span>
            <input style={s.input} value={form.name} maxLength={NAME_MAX}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Brush Teeth" disabled={saving} />
          </label>
          <label style={{ ...s.field, flex: '0 0 110px' }}>
            <span style={s.fieldLabel}>Accent colour</span>
            <input type="color" style={s.colorInput} value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value.toUpperCase() }))} disabled={saving} />
          </label>
          <label style={{ ...s.field, flex: '0 0 110px' }}>
            <span style={s.fieldLabel}>Tile colour</span>
            <input type="color" style={s.colorInput} value={form.bg_color}
              onChange={e => setForm(f => ({ ...f, bg_color: e.target.value.toUpperCase() }))} disabled={saving} />
          </label>
          {/* Preview of the tile */}
          <div style={{ ...s.field, flex: '0 0 120px' }}>
            <span style={s.fieldLabel}>Preview</span>
            <div style={{ ...s.preview, background: form.bg_color, borderColor: form.color }}>
              <span style={{ fontSize: 22 }}>{form.emoji || '❔'}</span>
              <span style={{ ...s.previewName, color: form.color }}>{form.name || 'Name'}</span>
            </div>
          </div>
        </div>
        <div style={s.formActions}>
          {editingKey && <button type="button" style={s.secondaryBtn} onClick={cancelEdit} disabled={saving}>Cancel</button>}
          <button type="submit" style={s.primaryBtn} disabled={saving}>
            {saving ? 'Saving…' : editingKey ? 'Save changes' : '+ Add activity'}
          </button>
        </div>
      </form>
      {error && <p style={s.error}>{error}</p>}

      {/* List */}
      {loading ? (
        <p style={s.empty}>Loading…</p>
      ) : activities.length === 0 ? (
        <div style={s.emptyBox}>
          <p style={s.emptyTitle}>No activities yet</p>
          <p style={s.emptyHint}>Add an activity above.</p>
        </div>
      ) : (
        <div style={s.table}>
          <div style={s.tableHead}>
            <span style={{ ...s.col, flex: '0 0 70px' }}>Order</span>
            <span style={{ ...s.col, flex: '0 0 50px' }} />
            <span style={{ ...s.col, flex: 1 }}>Name</span>
            <span style={{ ...s.col, flex: 1 }}>Key</span>
            <span style={{ ...s.col, flex: '0 0 70px' }}>Colours</span>
            <span style={{ ...s.col, flex: '0 0 230px' }} />
          </div>
          {activities.map((a, i) => (
            <div key={a.key} style={{ ...s.row, ...(a.is_active ? {} : s.rowHidden), ...(editingKey === a.key ? s.rowEditing : {}) }}>
              <span style={{ ...s.col, flex: '0 0 70px', display: 'flex', gap: 4 }}>
                <button style={s.iconBtn} onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</button>
                <button style={s.iconBtn} onClick={() => move(i, 1)} disabled={i === activities.length - 1} title="Move down">↓</button>
              </span>
              <span style={{ ...s.col, flex: '0 0 50px', fontSize: 24 }}>{a.emoji}</span>
              <span style={{ ...s.col, flex: 1, fontWeight: 600 }}>{a.name}</span>
              <span style={{ ...s.col, flex: 1, color: '#6B7280', fontFamily: 'monospace', fontSize: 12 }}>{a.key}</span>
              <span style={{ ...s.col, flex: '0 0 70px', display: 'flex', gap: 4 }}>
                <span style={{ ...s.swatch, background: a.color }} title={a.color} />
                <span style={{ ...s.swatch, background: a.bg_color }} title={a.bg_color} />
              </span>
              <span style={{ ...s.col, flex: '0 0 230px', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button style={a.is_active ? s.hideBtn : s.showBtn} onClick={() => toggleActive(a)}>
                  {a.is_active ? 'Hide' : 'Show'}
                </button>
                <button style={s.editBtn} onClick={() => startEdit(a)}>Edit</button>
                <button style={s.deleteBtn} onClick={() => remove(a)}>Delete</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:      { padding: '32px 40px', maxWidth: 980, margin: '0 auto' },
  header:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  title:     { fontSize: 26, fontWeight: 800, margin: '0 0 6px', color: '#111827' },
  subtitle:  { fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5, maxWidth: 620 },
  notice:    { fontSize: 13, color: '#92400E', background: '#FEF3C7', borderRadius: 8, padding: '6px 10px', margin: '10px 0 0', maxWidth: 620 },
  badge:     { background: '#E0E7FF', color: '#4338CA', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', marginTop: 4 },

  formCard:   { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 8 },
  formTitle:  { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10 },
  formRow:    { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' },
  field:      { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: '#374151', display: 'flex', justifyContent: 'space-between' },
  count:      { fontWeight: 500, color: '#9CA3AF' },
  hint:       { fontSize: 11, color: '#9CA3AF', lineHeight: 1.3 },
  input:      { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D1D5DB', fontSize: 14, outline: 'none', background: '#fff' },
  colorInput: { width: '100%', height: 40, padding: 2, borderRadius: 8, border: '1.5px solid #D1D5DB', background: '#fff', cursor: 'pointer' },
  preview:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 8px', borderRadius: 10, border: '2px solid' },
  previewName:{ fontSize: 12, fontWeight: 700, textAlign: 'center' },
  formActions:{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  primaryBtn: { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  secondaryBtn:{ padding: '9px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  error:     { color: '#DC2626', fontSize: 13, margin: '0 0 12px' },

  emptyBox:  { textAlign: 'center', padding: '48px 32px', background: '#F9FAFB', borderRadius: 12, border: '1px dashed #D1D5DB', marginTop: 16 },
  emptyTitle:{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '0 0 6px' },
  emptyHint: { fontSize: 14, color: '#9CA3AF', margin: 0 },
  empty:     { color: '#9CA3AF', fontSize: 14 },

  table:     { border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginTop: 16 },
  tableHead: { display: 'flex', alignItems: 'center', background: '#F9FAFB', padding: '10px 16px', borderBottom: '1px solid #E5E7EB', fontSize: 12, fontWeight: 700, color: '#6B7280' },
  row:       { display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #F3F4F6', background: '#fff', gap: 8 },
  rowHidden: { opacity: 0.5 },
  rowEditing:{ background: '#EEF2FF' },
  col:       { fontSize: 14, color: '#111827', minWidth: 0 },
  swatch:    { width: 20, height: 20, borderRadius: 4, border: '1px solid #E5E7EB', display: 'inline-block' },

  iconBtn:   { width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontWeight: 700 },
  editBtn:   { padding: '5px 12px', borderRadius: 6, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#4338CA', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  hideBtn:   { padding: '5px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  showBtn:   { padding: '5px 12px', borderRadius: 6, border: '1px solid #86EFAC', background: '#F0FDF4', color: '#15803D', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  deleteBtn: { padding: '5px 12px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
};
