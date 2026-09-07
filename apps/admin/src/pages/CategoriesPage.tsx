import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type CategoryType = 'like' | 'dislike' | 'ability';
interface Category { id: string; name: string; type: CategoryType; emoji: string; }

const SECTIONS: { type: CategoryType; label: string; emoji: string; color: string; bg: string }[] = [
  { type: 'like',    label: 'Likes',     emoji: '👍', color: '#2F855A', bg: '#F0FFF4' },
  { type: 'dislike', label: 'Dislikes',  emoji: '👎', color: '#C53030', bg: '#FFF5F5' },
  { type: 'ability', label: 'Abilities', emoji: '⚡', color: '#2B6CB0', bg: '#EBF8FF' },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [type, setType] = useState<CategoryType>('like');

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

  return (
    <div>
      <h1 style={styles.heading}>Learner Categories</h1>

      {/* Add form */}
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

      {/* Sections */}
      {loading ? <p>Loading…</p> : (
        <div style={styles.sections}>
          {SECTIONS.map(sec => {
            const items = categories.filter(c => c.type === sec.type);
            return (
              <div key={sec.type} style={{ ...styles.section, background: sec.bg, borderColor: sec.color + '33' }}>
                <div style={styles.sectionHeader}>
                  <span style={styles.sectionEmoji}>{sec.emoji}</span>
                  <h2 style={{ ...styles.sectionTitle, color: sec.color }}>{sec.label}</h2>
                  <span style={{ ...styles.sectionCount, background: sec.color + '18', color: sec.color }}>
                    {items.length}
                  </span>
                </div>
                <div style={styles.grid}>
                  {items.map(c => (
                    <div key={c.id} style={{ ...styles.chip, borderColor: sec.color + '55' }}>
                      {c.emoji && <span style={{ fontSize: 17 }}>{c.emoji}</span>}
                      <span style={styles.chipName}>{c.name}</span>
                      <button style={styles.deleteChip} onClick={() => deleteCategory(c.id)}>✕</button>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p style={styles.empty}>No {sec.label.toLowerCase()} yet.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading:     { fontSize: 26, fontWeight: 700, color: '#2D3748', marginBottom: 24 },
  form:        { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  formTitle:   { margin: '0 0 16px', color: '#2D3748' },
  row:         { display: 'flex', gap: 12, alignItems: 'center' },
  input:       { padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14 },
  select:      { padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14 },
  addBtn:      { background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },

  sections:    { display: 'flex', flexDirection: 'column', gap: 20 },
  section:     { borderRadius: 14, border: '1.5px solid', padding: 20 },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionEmoji:  { fontSize: 22 },
  sectionTitle:  { fontSize: 18, fontWeight: 700, margin: 0 },
  sectionCount:  { fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '3px 10px' },

  grid:        { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },
  chip: {
    display: 'flex', alignItems: 'center', gap: 7,
    background: '#fff', border: '1.5px solid', borderRadius: 20,
    padding: '7px 13px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  chipName:    { fontSize: 14, color: '#2D3748', fontWeight: 500 },
  deleteChip:  { background: 'none', border: 'none', cursor: 'pointer', color: '#A0AEC0', fontSize: 13, lineHeight: '1', padding: 0 },
  empty:       { color: '#A0AEC0', fontSize: 14, margin: 0 },
};
