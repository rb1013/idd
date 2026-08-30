import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface EventCategory { id: string; label: string; created_at: string; }

export default function EventCategoriesPage() {
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [label, setLabel]           = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  async function fetchCategories() {
    const { data } = await supabase.from('event_category_options').select('*').order('label');
    setCategories(data || []);
    setLoading(false);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('event_category_options').insert({ label: label.trim() });
    setSaving(false);
    if (error) alert(error.message);
    else { setLabel(''); fetchCategories(); }
  }

  async function deleteCategory(id: string, catLabel: string) {
    if (!confirm(`Delete "${catLabel}"? Events that used this category will keep the value but it will no longer appear as an option.`)) return;
    await supabase.from('event_category_options').delete().eq('id', id);
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div>
      <h1 style={styles.heading}>Event Categories</h1>
      <p style={styles.sub}>These categories appear as selectable options when a guardian creates or edits an event.</p>

      <form onSubmit={addCategory} style={styles.form}>
        <h3 style={styles.formTitle}>Add Category</h3>
        <div style={styles.row}>
          <input
            style={{ ...styles.input, flex: 1 }}
            placeholder="e.g. Playdate, Support Group, Workshop"
            value={label}
            onChange={e => setLabel(e.target.value)}
            required
          />
          <button style={styles.addBtn} type="submit" disabled={saving}>
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>

      {loading ? <p>Loading…</p> : (
        <div style={styles.grid}>
          {categories.map(c => (
            <div key={c.id} style={styles.chip}>
              <span style={styles.chipLabel}>{c.label}</span>
              <button style={styles.deleteChip} onClick={() => deleteCategory(c.id, c.label)} title="Delete">✕</button>
            </div>
          ))}
          {categories.length === 0 && <p style={styles.empty}>No categories yet. Add one above.</p>}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading:   { fontSize: 26, fontWeight: 700, color: '#2D3748', marginBottom: 8 },
  sub:       { fontSize: 14, color: '#718096', marginBottom: 28 },
  form:      { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  formTitle: { margin: '0 0 16px', color: '#2D3748', fontSize: 16, fontWeight: 600 },
  row:       { display: 'flex', gap: 12, alignItems: 'center' },
  input:     { padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14 },
  addBtn:    { background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
  grid:      { display: 'flex', flexWrap: 'wrap', gap: 10 },
  chip: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fff', border: '1.5px solid #5B8DB8', borderRadius: 20,
    padding: '8px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  chipLabel:  { fontSize: 14, color: '#2D3748', fontWeight: 500 },
  deleteChip: { background: 'none', border: 'none', cursor: 'pointer', color: '#718096', fontSize: 14, lineHeight: '1' },
  empty:      { color: '#718096' },
};
