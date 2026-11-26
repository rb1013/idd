import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// Learner chat board — picture symbols (table aac_symbols + public Storage bucket 'aac-symbols',
// migration 095). A symbol message is sent as the image's PUBLIC URL, so:
//   • Replacing an image uploads a NEW file (new name) and points the symbol at it — the old file is
//     kept, so messages already sent still show their picture.
//   • Symbols can be hidden, not deleted (deleting would leave old messages without a picture).
//   • The key is fixed once created (the app's image cache is keyed by it).
// The app refreshes its cached board when a learner opens it (updated_at changes on every edit).

const BUCKET    = 'aac-symbols';
const MAX_BYTES = 1024 * 1024;                                   // bucket limit (095): 1 MB
const TYPES     = ['image/png', 'image/jpeg', 'image/webp'];     // bucket's allowed types (095)
const LABEL_MAX = 20;

interface SymbolRow {
  id: string;
  key: string;
  label: string;
  image_path: string;
  source_library: string | null;
  license: string | null;
  author: string | null;
  sort_order: number;
  is_active: boolean;
  updated_at: string;
}

const DEFAULT_CREDITS = { source_library: 'ARASAAC', license: 'CC BY-NC-SA', author: 'Sergio Palao / Government of Aragón' };
const EMPTY_FORM = { key: '', label: '', ...DEFAULT_CREDITS };

/** "Thank you!" → "thank_you" */
function slugify(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Checks the file against the bucket's limits; returns an error message or null */
function checkFile(file: File): string | null {
  if (!TYPES.includes(file.type)) return 'Image must be PNG, JPEG or WebP.';
  if (file.size > MAX_BYTES) return 'Image must be 1 MB or smaller.';
  return null;
}

/** Uploads to a new, unique file name — never overwrites (old messages keep their picture) */
async function uploadImage(key: string, file: File): Promise<string> {
  const ext  = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${key}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export default function AacSymbolsPage() {
  const [symbols, setSymbols] = useState<SymbolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [keyTouched, setKeyTouched] = useState(false);   // key follows the label until edited
  const [file, setFile]       = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function load() {
    const { data, error: err } = await supabase
      .from('aac_symbols')
      .select('id, key, label, image_path, source_library, license, author, sort_order, is_active, updated_at')
      .order('sort_order');
    if (err) setError(err.message);
    setSymbols((data ?? []) as SymbolRow[]);
    setLoading(false);
  }

  function pickFile(f: File | null) {
    setError(null);
    if (!f) { setFile(null); setPreview(null); return; }
    const problem = checkFile(f);
    if (problem) { setError(problem); setFile(null); setPreview(null); if (fileInput.current) fileInput.current.value = ''; return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setKeyTouched(false);
    setFile(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = '';
    setError(null);
  }

  function startEdit(sym: SymbolRow) {
    resetForm();
    setEditingId(sym.id);
    setForm({
      key: sym.key, label: sym.label,
      source_library: sym.source_library ?? '', license: sym.license ?? '', author: sym.author ?? '',
    });
    setKeyTouched(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const label = form.label.trim();
    const key   = (editingId ? form.key : slugify(form.key || label));
    if (!label) { setError('Label is required.'); return; }
    if (!editingId && !key) { setError('Key is required (letters, numbers and _).'); return; }
    if (!editingId && !file) { setError('Choose an image.'); return; }
    if (!editingId && symbols.some(s => s.key === key)) { setError(`Key "${key}" is already used.`); return; }

    setSaving(true);
    setError(null);
    try {
      const credits = {
        source_library: form.source_library.trim() || null,
        license:        form.license.trim() || null,
        author:         form.author.trim() || null,
      };
      if (editingId) {
        const update: Record<string, unknown> = { label, ...credits };
        if (file) update.image_path = await uploadImage(form.key, file);   // replace image → new file
        const { error: err } = await supabase.from('aac_symbols').update(update).eq('id', editingId);
        if (err) throw err;
      } else {
        const image_path = await uploadImage(key, file!);
        const { error: err } = await supabase.from('aac_symbols').insert({
          key, label, image_path, ...credits,
          sort_order: (symbols.reduce((m, s) => Math.max(m, s.sort_order), 0)) + 1,   // add at the end
        });
        if (err) throw err;
      }
      resetForm();
      load();
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(sym: SymbolRow) {
    const { error: err } = await supabase.from('aac_symbols').update({ is_active: !sym.is_active }).eq('id', sym.id);
    if (err) { setError(err.message); return; }
    setSymbols(prev => prev.map(x => x.id === sym.id ? { ...x, is_active: !x.is_active } : x));
  }

  // Swap board position with the neighbour above (-1) or below (+1)
  async function move(index: number, dir: -1 | 1) {
    const a = symbols[index], b = symbols[index + dir];
    if (!a || !b) return;
    const [r1, r2] = await Promise.all([
      supabase.from('aac_symbols').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('aac_symbols').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    if (r1.error || r2.error) { setError((r1.error ?? r2.error)!.message); return; }
    load();
  }

  const activeCount = symbols.filter(s => s.is_active).length;
  const editing = symbols.find(s => s.id === editingId) ?? null;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>🖼️ Chat Symbols</h1>
          <p style={s.subtitle}>
            Picture symbols on the learner chat board. The label is shown under the picture and read aloud.
            Symbols can be hidden, not deleted — messages already sent show the picture from its saved address,
            so replacing an image uploads a new file and keeps the old one. Changes reach learners the next time
            they open the board.
          </p>
        </div>
        <span style={s.badge}>{activeCount} on board · {symbols.length} total</span>
      </div>

      {/* Add / edit form */}
      <form onSubmit={save} style={s.formCard}>
        <div style={s.formTitle}>{editingId ? `Edit "${editing?.label}"` : 'Add a symbol'}</div>
        <div style={s.formRow}>
          {/* Image */}
          <div style={s.imageBox}>
            {preview || editing
              ? <img src={preview ?? publicUrl(editing!.image_path)} alt="" style={s.imagePreview} />
              : <span style={s.imagePlaceholder}>No image</span>}
            <label style={s.fileBtn}>
              {editingId ? 'Replace image' : 'Choose image'}
              <input ref={fileInput} type="file" accept={TYPES.join(',')} style={{ display: 'none' }}
                onChange={e => pickFile(e.target.files?.[0] ?? null)} disabled={saving} />
            </label>
            <span style={s.hint}>PNG / JPEG / WebP · max 1 MB</span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ ...s.field, flex: 1 }}>
                <span style={s.fieldLabel}>Label <span style={s.count}>{form.label.length}/{LABEL_MAX}</span></span>
                <input style={s.input} value={form.label} maxLength={LABEL_MAX} placeholder="Thank you"
                  onChange={e => {
                    const label = e.target.value;
                    setForm(f => ({ ...f, label, key: editingId || keyTouched ? f.key : slugify(label) }));
                  }} disabled={saving} />
              </label>
              <label style={{ ...s.field, flex: 1 }}>
                <span style={s.fieldLabel}>Key {editingId && <span style={s.count}>fixed</span>}</span>
                <input style={{ ...s.input, fontFamily: 'monospace', ...(editingId ? s.inputLocked : {}) }}
                  value={form.key} placeholder="thank_you" disabled={saving || !!editingId}
                  onChange={e => { setKeyTouched(true); setForm(f => ({ ...f, key: e.target.value })); }}
                  onBlur={() => setForm(f => ({ ...f, key: slugify(f.key) }))} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ ...s.field, flex: 1 }}>
                <span style={s.fieldLabel}>Source</span>
                <input style={s.input} value={form.source_library} placeholder="ARASAAC"
                  onChange={e => setForm(f => ({ ...f, source_library: e.target.value }))} disabled={saving} />
              </label>
              <label style={{ ...s.field, flex: 1 }}>
                <span style={s.fieldLabel}>License</span>
                <input style={s.input} value={form.license} placeholder="CC BY-NC-SA"
                  onChange={e => setForm(f => ({ ...f, license: e.target.value }))} disabled={saving} />
              </label>
              <label style={{ ...s.field, flex: 2 }}>
                <span style={s.fieldLabel}>Author</span>
                <input style={s.input} value={form.author} placeholder="Sergio Palao / Government of Aragón"
                  onChange={e => setForm(f => ({ ...f, author: e.target.value }))} disabled={saving} />
              </label>
            </div>
            <span style={s.hint}>Source / license / author are kept for the Credits &amp; Licenses page — update docs/credits.md if a new source is used.</span>
          </div>
        </div>
        <div style={s.formActions}>
          {editingId && <button type="button" style={s.secondaryBtn} onClick={resetForm} disabled={saving}>Cancel</button>}
          <button type="submit" style={s.primaryBtn} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : '+ Add symbol'}
          </button>
        </div>
      </form>
      {error && <p style={s.error}>{error}</p>}

      {/* List */}
      {loading ? (
        <p style={s.empty}>Loading…</p>
      ) : symbols.length === 0 ? (
        <div style={s.emptyBox}>
          <p style={s.emptyTitle}>No symbols yet</p>
          <p style={s.emptyHint}>Add a symbol above to show it on the learner chat board.</p>
        </div>
      ) : (
        <div style={s.table}>
          <div style={s.tableHead}>
            <span style={{ ...s.col, flex: '0 0 70px' }}>Order</span>
            <span style={{ ...s.col, flex: '0 0 64px' }}>Image</span>
            <span style={{ ...s.col, flex: 1 }}>Label</span>
            <span style={{ ...s.col, flex: 1 }}>Key</span>
            <span style={{ ...s.col, flex: 1 }}>Source</span>
            <span style={{ ...s.col, flex: '0 0 150px' }} />
          </div>
          {symbols.map((sym, i) => (
            <div key={sym.id} style={{ ...s.row, ...(sym.is_active ? {} : s.rowHidden), ...(editingId === sym.id ? s.rowEditing : {}) }}>
              <span style={{ ...s.col, flex: '0 0 70px', display: 'flex', gap: 4 }}>
                <button style={s.iconBtn} onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</button>
                <button style={s.iconBtn} onClick={() => move(i, 1)} disabled={i === symbols.length - 1} title="Move down">↓</button>
              </span>
              <span style={{ ...s.col, flex: '0 0 64px' }}>
                <img src={publicUrl(sym.image_path)} alt={sym.label} style={s.thumb} />
              </span>
              <span style={{ ...s.col, flex: 1, fontWeight: 600 }}>{sym.label}</span>
              <span style={{ ...s.col, flex: 1, fontFamily: 'monospace', color: '#6B7280' }}>{sym.key}</span>
              <span style={{ ...s.col, flex: 1, color: '#6B7280', fontSize: 13 }}>
                {[sym.source_library, sym.license].filter(Boolean).join(' · ') || '—'}
              </span>
              <span style={{ ...s.col, flex: '0 0 150px', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button style={sym.is_active ? s.hideBtn : s.showBtn} onClick={() => toggleActive(sym)}>
                  {sym.is_active ? 'Hide' : 'Show'}
                </button>
                <button style={s.editBtn} onClick={() => startEdit(sym)}>Edit</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:      { padding: '32px 40px', maxWidth: 1040, margin: '0 auto' },
  header:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  title:     { fontSize: 26, fontWeight: 800, margin: '0 0 6px', color: '#111827' },
  subtitle:  { fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5, maxWidth: 680 },
  badge:     { background: '#E0E7FF', color: '#4338CA', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', marginTop: 4 },

  formCard:   { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 8 },
  formTitle:  { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 10 },
  formRow:    { display: 'flex', gap: 16, flexWrap: 'wrap' },
  imageBox:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 140 },
  imagePreview:{ width: 96, height: 96, objectFit: 'contain', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10 },
  imagePlaceholder:{ width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px dashed #D1D5DB', borderRadius: 10, fontSize: 12, color: '#9CA3AF' },
  fileBtn:    { padding: '6px 12px', borderRadius: 6, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#4338CA', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  hint:       { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },
  field:      { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: '#374151', display: 'flex', justifyContent: 'space-between' },
  count:      { fontWeight: 500, color: '#9CA3AF' },
  input:      { padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D1D5DB', fontSize: 14, outline: 'none', background: '#fff' },
  inputLocked:{ background: '#F3F4F6', color: '#6B7280' },
  formActions:{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  primaryBtn: { padding: '9px 20px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  secondaryBtn:{ padding: '9px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  error:     { color: '#DC2626', fontSize: 13, margin: '0 0 12px' },

  emptyBox:  { textAlign: 'center', padding: '48px 32px', background: '#F9FAFB', borderRadius: 12, border: '1px dashed #D1D5DB', marginTop: 16 },
  emptyTitle:{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '0 0 6px' },
  emptyHint: { fontSize: 14, color: '#9CA3AF', margin: 0 },
  empty:     { color: '#9CA3AF', fontSize: 14 },

  table:     { border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginTop: 16 },
  tableHead: { display: 'flex', alignItems: 'center', background: '#F9FAFB', padding: '10px 16px', borderBottom: '1px solid #E5E7EB', fontSize: 12, fontWeight: 700, color: '#6B7280', gap: 8 },
  row:       { display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #F3F4F6', background: '#fff', gap: 8 },
  rowHidden: { opacity: 0.5 },
  rowEditing:{ background: '#EEF2FF' },
  col:       { fontSize: 14, color: '#111827', minWidth: 0 },
  thumb:     { width: 48, height: 48, objectFit: 'contain', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' },

  iconBtn:   { width: 28, height: 28, borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontWeight: 700 },
  editBtn:   { padding: '5px 12px', borderRadius: 6, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#4338CA', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  hideBtn:   { padding: '5px 12px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  showBtn:   { padding: '5px 12px', borderRadius: 6, border: '1px solid #86EFAC', background: '#F0FDF4', color: '#15803D', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
};
