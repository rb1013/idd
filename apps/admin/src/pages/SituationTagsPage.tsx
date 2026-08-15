import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SituationTag { id: string; label: string; created_at: string; }

export default function SituationTagsPage() {
  const [tags, setTags] = useState<SituationTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTags(); }, []);

  async function fetchTags() {
    const { data } = await supabase.from('situation_tag_options').select('*').order('label');
    setTags(data || []);
    setLoading(false);
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('situation_tag_options').insert({ label: label.trim() });
    setSaving(false);
    if (error) alert(error.message);
    else { setLabel(''); fetchTags(); }
  }

  async function deleteTag(id: string, tagLabel: string) {
    if (!confirm(`Delete "${tagLabel}"? Guardians who selected it will keep the tag text but it will no longer appear as an option.`)) return;
    await supabase.from('situation_tag_options').delete().eq('id', id);
    setTags(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div>
      <h1 style={styles.heading}>Situation Tags</h1>
      <p style={styles.sub}>These tags appear as selectable options when a guardian creates or edits their account.</p>

      <form onSubmit={addTag} style={styles.form}>
        <h3 style={styles.formTitle}>Add Tag</h3>
        <div style={styles.row}>
          <input
            style={{ ...styles.input, flex: 1 }}
            placeholder="e.g. Autism Spectrum Disorder"
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
          {tags.map(t => (
            <div key={t.id} style={styles.chip}>
              <span style={styles.chipLabel}>{t.label}</span>
              <button style={styles.deleteChip} onClick={() => deleteTag(t.id, t.label)} title="Delete">✕</button>
            </div>
          ))}
          {tags.length === 0 && <p style={styles.empty}>No tags yet. Add one above.</p>}
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
