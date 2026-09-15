import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface DiscussionCategory { id: string; label: string; created_at: string; }

export default function DiscussionCategoriesPage() {
  const [categories, setCategories] = useState<DiscussionCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [label, setLabel]           = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  async function fetchCategories() {
    const { data } = await supabase.from('discussion_category_options').select('*').order('label');
    setCategories(data || []);
    setLoading(false);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('discussion_category_options').insert({ label: label.trim() });
    setSaving(false);
    if (error) alert(error.message);
    else { setLabel(''); fetchCategories(); }
  }

  async function deleteCategory(id: string, catLabel: string) {
    if (!confirm(`Delete "${catLabel}"? Existing discussions using this category will have their category cleared.`)) return;
    await supabase.from('discussion_category_options').delete().eq('id', id);
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div>
      <h1 style={styles.heading}>Discussion Categories</h1>
      <p style={styles.sub}>These categories appear as selectable options when a guardian starts a new discussion.</p>

      <form onSubmit={addCategory} style={styles.form}>
        <h3 style={styles.formTitle}>Add Category</h3>
        <div style={styles.row}>
          <input
            style={{ ...styles.input, flex: 1 }}
            placeholder="e.g. Behaviour, School, Therapy"
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
              <button style={styles.deleteBtn} onClick={() => deleteCategory(c.id, c.label)} title="Delete">✕</button>
            </div>
          ))}
          {categories.length === 0 && <p style={styles.empty}>No categories yet. Add one above.</p>}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 24, fontWeight: 700, color: '#2D3748', marginBottom: 8 },
  sub:     { fontSize: 14, color: '#718096', marginBottom: 28 },
  form:    { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 32, border: '1px solid #E2E8F0' },
  formTitle: { fontSize: 16, fontWeight: 600, color: '#2D3748', marginBottom: 14, marginTop: 0 },
  row:     { display: 'flex', gap: 10, alignItems: 'center' },
  input:   {
    padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E0',
    fontSize: 14, color: '#2D3748', outline: 'none',
  },
  addBtn: {
    padding: '10px 22px', background: '#5B8DB8', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  grid:   { display: 'flex', flexWrap: 'wrap', gap: 10 },
  chip:   {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#EBF4FF', border: '1px solid #BEE3F8',
    borderRadius: 20, padding: '7px 14px',
  },
  chipLabel:  { fontSize: 14, fontWeight: 500, color: '#2C5282' },
  deleteBtn:  {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#718096', fontSize: 13, padding: 0, lineHeight: 1,
  },
  empty: { color: '#718096', fontSize: 14 },
};
