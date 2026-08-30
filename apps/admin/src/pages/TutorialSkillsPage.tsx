import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface TutorialSkill { id: string; label: string; created_at: string; }

export default function TutorialSkillsPage() {
  const [skills,  setSkills]  = useState<TutorialSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [label,   setLabel]   = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { fetchSkills(); }, []);

  async function fetchSkills() {
    const { data } = await supabase.from('tutorial_skills').select('*').order('label');
    setSkills(data || []);
    setLoading(false);
  }

  async function addSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('tutorial_skills').insert({ label: label.trim() });
    setSaving(false);
    if (error) alert(error.message);
    else { setLabel(''); fetchSkills(); }
  }

  async function deleteSkill(id: string, skillLabel: string) {
    if (!confirm(`Delete "${skillLabel}"? Tutorials that used this skill will keep the value but it will no longer appear as an option.`)) return;
    await supabase.from('tutorial_skills').delete().eq('id', id);
    setSkills(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div>
      <h1 style={styles.heading}>Tutorial Skills</h1>
      <p style={styles.sub}>These skills appear as selectable target skills when a guardian creates a tutorial.</p>

      <form onSubmit={addSkill} style={styles.form}>
        <h3 style={styles.formTitle}>Add Skill</h3>
        <div style={styles.row}>
          <input
            style={{ ...styles.input, flex: 1 }}
            placeholder="e.g. Speech & Communication, Motor Skills"
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
          {skills.map(s => (
            <div key={s.id} style={styles.chip}>
              <span style={styles.chipLabel}>{s.label}</span>
              <button style={styles.deleteChip} onClick={() => deleteSkill(s.id, s.label)} title="Delete">✕</button>
            </div>
          ))}
          {skills.length === 0 && <p style={styles.empty}>No skills yet. Add one above.</p>}
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
