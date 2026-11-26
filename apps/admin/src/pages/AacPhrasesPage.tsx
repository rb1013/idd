import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Learner chat board — "Say hello" phrases (table aac_phrases, migration 094).
// Each phrase: an emoji + a short label shown on the board (and read aloud), and the text sent as
// the chat message. Board order = sort_order. Hidden phrases leave the board; old messages are plain
// text, so editing or deleting a phrase never changes messages already sent.
// The app refreshes its cached board when a learner opens it (updated_at changes on every edit).

interface Phrase {
  id: string;
  emoji: string;
  label: string;
  phrase: string;
  sort_order: number;
  is_active: boolean;
}

const LABEL_MAX  = 20;   // short — shown under the emoji on a small tile
const PHRASE_MAX = 60;   // the message that's sent
const EMOJI_MAX  = 8;    // one emoji (some are several characters)

const EMPTY = { emoji: '', label: '', phrase: '' };

export default function AacPhrasesPage() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error: err } = await supabase
      .from('aac_phrases')
      .select('id, emoji, label, phrase, sort_order, is_active')
      .order('sort_order');
    if (err) setError(err.message);
    setPhrases((data ?? []) as Phrase[]);
    setLoading(false);
  }

  function startEdit(p: Phrase) {
    setEditingId(p.id);
    setForm({ emoji: p.emoji, label: p.label, phrase: p.phrase });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const emoji = form.emoji.trim(), label = form.label.trim(), phrase = form.phrase.trim();
    if (!emoji || !label || !phrase) { setError('Emoji, label and message are all required.'); return; }
    setSaving(true);
    setError(null);
    const { error: err } = editingId
      ? await supabase.from('aac_phrases').update({ emoji, label, phrase }).eq('id', editingId)
      : await supabase.from('aac_phrases').insert({
          emoji, label, phrase,
          sort_order: (phrases.reduce((m, p) => Math.max(m, p.sort_order), 0)) + 1,   // add at the end
        });
    setSaving(false);
    if (err) { setError(err.message); return; }
    cancelEdit();
    load();
  }

  async function toggleActive(p: Phrase) {
    const { error: err } = await supabase.from('aac_phrases').update({ is_active: !p.is_active }).eq('id', p.id);
    if (err) { setError(err.message); return; }
    setPhrases(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
  }

  // Swap board position with the neighbour above (-1) or below (+1)
  async function move(index: number, dir: -1 | 1) {
    const a = phrases[index], b = phrases[index + dir];
    if (!a || !b) return;
    const [r1, r2] = await Promise.all([
      supabase.from('aac_phrases').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('aac_phrases').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    if (r1.error || r2.error) { setError((r1.error ?? r2.error)!.message); return; }
    load();
  }

  async function remove(p: Phrase) {
    if (!window.confirm(`Delete "${p.label}"? It disappears from the board. Messages already sent aren't affected.`)) return;
    const { error: err } = await supabase.from('aac_phrases').delete().eq('id', p.id);
    if (err) { setError(err.message); return; }
    if (editingId === p.id) cancelEdit();
    setPhrases(prev => prev.filter(x => x.id !== p.id));
  }

  const activeCount = phrases.filter(p => p.is_active).length;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>💬 Chat Phrases</h1>
          <p style={s.subtitle}>
            "Say hello" phrases on the learner chat board. The label is shown under the emoji and read aloud;
            the message is what gets sent. Hidden phrases leave the board. Changes reach learners the next time
            they open the board.
          </p>
        </div>
        <span style={s.badge}>{activeCount} on board · {phrases.length} total</span>
      </div>

      {/* Add / edit form */}
      <form onSubmit={save} style={s.formCard}>
        <div style={s.formTitle}>{editingId ? 'Edit phrase' : 'Add a phrase'}</div>
        <div style={s.formRow}>
          <label style={{ ...s.field, flex: '0 0 90px' }}>
            <span style={s.fieldLabel}>Emoji</span>
            <input style={{ ...s.input, textAlign: 'center', fontSize: 20 }} value={form.emoji} maxLength={EMOJI_MAX}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="👋" disabled={saving} />
            {/* How to type an emoji (Mac emoji picker; Windows: Win + .) */}
            <span style={s.hint}>Control + Command + Space</span>
          </label>
          <label style={{ ...s.field, flex: 1 }}>
            <span style={s.fieldLabel}>Label <span style={s.count}>{form.label.length}/{LABEL_MAX}</span></span>
            <input style={s.input} value={form.label} maxLength={LABEL_MAX}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Hello!" disabled={saving} />
          </label>
          <label style={{ ...s.field, flex: 2 }}>
            <span style={s.fieldLabel}>Message sent <span style={s.count}>{form.phrase.length}/{PHRASE_MAX}</span></span>
            <input style={s.input} value={form.phrase} maxLength={PHRASE_MAX}
              onChange={e => setForm(f => ({ ...f, phrase: e.target.value }))} placeholder="Hello! 👋" disabled={saving} />
          </label>
        </div>
        <div style={s.formActions}>
          {editingId && <button type="button" style={s.secondaryBtn} onClick={cancelEdit} disabled={saving}>Cancel</button>}
          <button type="submit" style={s.primaryBtn} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : '+ Add phrase'}
          </button>
        </div>
      </form>
      {error && <p style={s.error}>{error}</p>}

      {/* List */}
      {loading ? (
        <p style={s.empty}>Loading…</p>
      ) : phrases.length === 0 ? (
        <div style={s.emptyBox}>
          <p style={s.emptyTitle}>No phrases yet</p>
          <p style={s.emptyHint}>Add a phrase above to show it on the learner chat board.</p>
        </div>
      ) : (
        <div style={s.table}>
          <div style={s.tableHead}>
            <span style={{ ...s.col, flex: '0 0 70px' }}>Order</span>
            <span style={{ ...s.col, flex: '0 0 50px' }} />
            <span style={{ ...s.col, flex: 1 }}>Label</span>
            <span style={{ ...s.col, flex: 2 }}>Message sent</span>
            <span style={{ ...s.col, flex: '0 0 230px' }} />
          </div>
          {phrases.map((p, i) => (
            <div key={p.id} style={{ ...s.row, ...(p.is_active ? {} : s.rowHidden), ...(editingId === p.id ? s.rowEditing : {}) }}>
              <span style={{ ...s.col, flex: '0 0 70px', display: 'flex', gap: 4 }}>
                <button style={s.iconBtn} onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</button>
                <button style={s.iconBtn} onClick={() => move(i, 1)} disabled={i === phrases.length - 1} title="Move down">↓</button>
              </span>
              <span style={{ ...s.col, flex: '0 0 50px', fontSize: 24 }}>{p.emoji}</span>
              <span style={{ ...s.col, flex: 1, fontWeight: 600 }}>{p.label}</span>
              <span style={{ ...s.col, flex: 2, color: '#374151' }}>{p.phrase}</span>
              <span style={{ ...s.col, flex: '0 0 230px', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button style={p.is_active ? s.hideBtn : s.showBtn} onClick={() => toggleActive(p)}>
                  {p.is_active ? 'Hide' : 'Show'}
                </button>
                <button style={s.editBtn} onClick={() => startEdit(p)}>Edit</button>
                <button style={s.deleteBtn} onClick={() => remove(p)}>Delete</button>
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
  badge:     { background: '#E0E7FF', color: '#4338CA', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', marginTop: 4 },

  formCard:   { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 8 },
  formTitle:  { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10 },
  formRow:    { display: 'flex', gap: 10, flexWrap: 'wrap' },
  field:      { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: '#374151', display: 'flex', justifyContent: 'space-between' },
  count:      { fontWeight: 500, color: '#9CA3AF' },
  hint:       { fontSize: 11, color: '#9CA3AF', lineHeight: 1.3 },
  input:      { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D1D5DB', fontSize: 14, outline: 'none', background: '#fff' },
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

  iconBtn:   { width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontWeight: 700 },
  editBtn:   { padding: '5px 12px', borderRadius: 6, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#4338CA', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  hideBtn:   { padding: '5px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  showBtn:   { padding: '5px 12px', borderRadius: 6, border: '1px solid #86EFAC', background: '#F0FDF4', color: '#15803D', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  deleteBtn: { padding: '5px 12px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
};
