import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Tutorial } from '../../../mobile/src/types';

export default function TutorialsPage() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTutorials();
    supabase.from('categories').select('id, name').eq('type', 'like').order('name')
      .then(({ data }) => setCategories(data || []));
  }, []);

  async function fetchTutorials() {
    const { data } = await supabase.from('tutorials').select('*').order('created_at', { ascending: false });
    setTutorials(data || []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const videoFile = videoRef.current?.files?.[0];
    const thumbFile = thumbRef.current?.files?.[0];
    if (!title || !category || !videoFile) { alert('Title, category and video are required'); return; }

    setUploading(true);

    const videoExt = videoFile.name.split('.').pop();
    const videoPath = `${Date.now()}.${videoExt}`;
    const { error: videoError } = await supabase.storage.from('tutorials').upload(videoPath, videoFile);
    if (videoError) { alert('Video upload failed: ' + videoError.message); setUploading(false); return; }

    const { data: { publicUrl: videoUrl } } = supabase.storage.from('tutorials').getPublicUrl(videoPath);

    let thumbnailUrl: string | null = null;
    if (thumbFile) {
      const thumbExt = thumbFile.name.split('.').pop();
      const thumbPath = `thumbs/${Date.now()}.${thumbExt}`;
      await supabase.storage.from('tutorials').upload(thumbPath, thumbFile);
      const { data: { publicUrl } } = supabase.storage.from('tutorials').getPublicUrl(thumbPath);
      thumbnailUrl = publicUrl;
    }

    const { error } = await supabase.from('tutorials').insert({
      title, description, category, video_url: videoUrl, thumbnail_url: thumbnailUrl,
    });

    if (error) alert('Error saving tutorial: ' + error.message);
    else {
      setTitle(''); setDescription(''); setCategory(''); setShowForm(false);
      fetchTutorials();
    }
    setUploading(false);
  }

  async function deleteTutorial(id: string) {
    if (!confirm('Delete this tutorial?')) return;
    await supabase.from('tutorials').delete().eq('id', id);
    setTutorials(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.heading}>Tutorials</h1>
        <button style={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Upload Tutorial'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <h3 style={styles.formTitle}>Upload New Tutorial</h3>
          <Field label="Title *" value={title} onChange={setTitle} />
          <div style={styles.field}>
            <label style={styles.label}>Category *</label>
            <select
              style={styles.input}
              value={category}
              onChange={e => setCategory(e.target.value)}
              required
            >
              <option value="">Select a category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Description</label>
            <textarea style={{ ...styles.input, height: 80, resize: 'vertical' } as React.CSSProperties}
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Video File *</label>
            <input ref={videoRef} type="file" accept="video/*" style={styles.fileInput} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Thumbnail (optional)</label>
            <input ref={thumbRef} type="file" accept="image/*" style={styles.fileInput} />
          </div>
          <button style={styles.submitBtn} type="submit" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload Tutorial'}
          </button>
        </form>
      )}

      {loading ? <p>Loading...</p> : (
        <table style={styles.table}>
          <thead>
            <tr>
              {['Title', 'Category', 'Date', 'Actions'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tutorials.map(t => (
              <tr key={t.id} style={styles.tr}>
                <td style={styles.td}>{t.title}</td>
                <td style={styles.td}><span style={styles.badge}>{t.category}</span></td>
                <td style={styles.td}>{new Date(t.created_at).toLocaleDateString()}</td>
                <td style={styles.td}>
                  <a href={t.video_url} target="_blank" style={styles.viewLink}>View</a>
                  <button style={styles.deleteBtn} onClick={() => deleteTutorial(t.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && tutorials.length === 0 && <p style={styles.empty}>No tutorials yet. Upload one above.</p>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input style={styles.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  heading: { fontSize: 26, fontWeight: 700, color: '#2D3748', margin: 0 },
  addBtn: { background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 },
  form: { background: '#fff', borderRadius: 12, padding: 24, marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  formTitle: { margin: '0 0 20px', color: '#2D3748' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 14, fontWeight: 600, color: '#2D3748', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 14, boxSizing: 'border-box' as const },
  fileInput: { fontSize: 14 },
  submitBtn: { background: '#5B8DB8', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', cursor: 'pointer', fontWeight: 600 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  th: { padding: '14px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#718096', background: '#F7FAFC', borderBottom: '1px solid #E2E8F0' },
  tr: { borderBottom: '1px solid #E2E8F0' },
  td: { padding: '14px 16px', fontSize: 14, color: '#2D3748' },
  badge: { background: '#EBF4FF', color: '#5B8DB8', borderRadius: 12, padding: '3px 10px', fontSize: 12, fontWeight: 600 },
  viewLink: { color: '#5B8DB8', marginRight: 12, textDecoration: 'none', fontWeight: 500 },
  deleteBtn: { background: 'none', border: '1px solid #E53E3E', color: '#E53E3E', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 },
  empty: { color: '#718096', textAlign: 'center', marginTop: 40 },
};
