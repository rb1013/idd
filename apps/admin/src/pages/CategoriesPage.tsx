import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type CategoryType = 'like' | 'dislike' | 'ability';
interface Category { id: string; name: string; type: CategoryType; emoji: string; }

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [type, setType] = useState<CategoryType>('like');
  const [filter, setFilter] = useState<CategoryType | 'all'>('all');

  useEffect(() => { fetchCategories(); }, []);

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').order('type').order('name');
    setCategories(data || []);
    setLoading(false);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from('categories').insert({ name: name.trim(), type, emoji: emoji.trim() || null });
    if (error) alert(error.message);
    else { setName(''); setEmoji(''); fetchCategories(); }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? Existing user selections will be removed.')) return;
    await supabase.from('categories').delete().eq('id', id);
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  const filtered = filter === 'all' ? categories : categories.filter(c => c.type === filter);

  const typeColors: Record<CategoryType, string> = { like: '#7DBDA2', dislike: '#E53E3E', ability: '#5B8DB8' };

  return (
    <div>
      <h1 style={styles.heading}>Categories</h1>

      <form onSubmit={addCategory} style={styles.form}>
        <h3 style={styles.formTitle}>Add Category</h3>
        <div style={styles.row}>
          <input
            style={{ ...styles.input, width: 56, textAlign: 'center', fontSize: 20, flexShrink: 0 }}
            placeholder="😊"
            value={emoji}
            onChange={e => setEmoji(e.target.value)}
            maxLength={4}
          />
          <input
            style={{ ...styles.input, flex: 1 }}
            placeholder="Category name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <select style={styles.select} value={type} onChange={e => setType(e.target.value as CategoryType)}>
            <option value="like">Like</option>
            <option value="dislike">Dislike</option>
            <option value="ability">Ability</option>
          </select>
          <button style={styles.addBtn} type="submit">Add</button>
        </div>
      </form>

      <div style={styles.filterRow}>
        {(['all', 'like', 'dislike', 'ability'] as const).map(f => (
          <button
            key={f}
            style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <p>Loading...</p> : (
        <div style={styles.grid}>
          {filtered.map(c => (
            <div key={c.id} style={{ ...styles.chip, borderColor: typeColors[c.type] }}>
              {c.emoji && <span style={{ fontSize: 18 }}>{c.emoji}</span>}
              <span style={styles.chipName}>{c.name}</span>
              <span style={{ ...styles.chipType, color: typeColors[c.type] }}>{c.type}</span>
              <button style={styles.deleteChip} onClick={() => deleteCategory(c.id)}>✕</button>
            </div>
          ))}
          {filtered.length === 0 && <p style={styles.empty}>No categories found.</p>}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 26, fontWeight: 700, color: '#2D3748', marginBottom: 24 },
  form: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  formTitle: { margin: '0 0 16px', color: '#2D3748' },
  row: { display: 'flex', gap: 12, alignItems: 'center' },
  input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14 },
  select: { padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14 },
  addBtn: { background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
  filterRow: { display: 'flex', gap: 8, marginBottom: 20 },
  filterBtn: { padding: '8px 16px', borderRadius: 20, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#718096' },
  filterBtnActive: { background: '#5B8DB8', color: '#fff', borderColor: '#5B8DB8' },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  chip: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fff', border: '1.5px solid', borderRadius: 20,
    padding: '8px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  chipName: { fontSize: 14, color: '#2D3748', fontWeight: 500 },
  chipType: { fontSize: 11, fontWeight: 600, textTransform: 'capitalize' },
  deleteChip: { background: 'none', border: 'none', cursor: 'pointer', color: '#718096', fontSize: 14, lineHeight: 1 },
  empty: { color: '#718096' },
};
