import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

interface BlockedWord { id: string; word: string; created_at: string; }

export default function BlockedWordsPage() {
  const { session } = useAuth();
  const [words, setWords]     = useState<BlockedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => { fetchWords(); }, []);

  async function fetchWords() {
    const { data } = await supabase.from('blocked_words').select('id, word, created_at').order('word');
    setWords(data || []);
    setLoading(false);
  }

  async function addWord(e: React.FormEvent) {
    e.preventDefault();
    const word = input.trim().toLowerCase();
    if (!word) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('blocked_words').insert({ word, added_by: session?.user.id });
    if (err) {
      setError(err.message.includes('unique') ? `"${word}" is already in the list.` : err.message);
    } else {
      setInput('');
      await fetchWords();
    }
    setSaving(false);
  }

  async function deleteWord(id: string) {
    await supabase.from('blocked_words').delete().eq('id', id);
    setWords(prev => prev.filter(w => w.id !== id));
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>⛔ Blocked Words</h1>
          <p style={s.subtitle}>
            Messages containing any word in this list will be rejected before delivery.
            Words are matched case-insensitively.
          </p>
        </div>
        <span style={s.badge}>{words.length} word{words.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Add form */}
      <form onSubmit={addWord} style={s.form}>
        <input
          style={s.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a word to block…"
          disabled={saving}
        />
        <button type="submit" style={s.addBtn} disabled={saving || !input.trim()}>
          {saving ? 'Adding…' : '+ Add'}
        </button>
      </form>
      {error && <p style={s.error}>{error}</p>}

      {/* Word list */}
      {loading ? (
        <p style={s.empty}>Loading…</p>
      ) : words.length === 0 ? (
        <div style={s.emptyBox}>
          <p style={s.emptyTitle}>No blocked words yet</p>
          <p style={s.emptyHint}>Add words above to prevent them from appearing in learner chats.</p>
        </div>
      ) : (
        <div style={s.table}>
          <div style={s.tableHead}>
            <span style={{ ...s.col, flex: 2 }}>Word</span>
            <span style={{ ...s.col, flex: 2 }}>Added</span>
            <span style={{ ...s.col, flex: 0, width: 80 }} />
          </div>
          {words.map(w => (
            <div key={w.id} style={s.row}>
              <span style={{ ...s.col, flex: 2, fontFamily: 'monospace', fontWeight: 600 }}>{w.word}</span>
              <span style={{ ...s.col, flex: 2, color: '#6B7280' }}>
                {new Date(w.created_at).toLocaleDateString()}
              </span>
              <span style={{ ...s.col, flex: 0, width: 80 }}>
                <button onClick={() => deleteWord(w.id)} style={s.deleteBtn}>Remove</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:      { padding: '32px 40px', maxWidth: 760, margin: '0 auto' },
  header:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 },
  title:     { fontSize: 26, fontWeight: 800, margin: '0 0 6px', color: '#111827' },
  subtitle:  { fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 },
  badge:     { background: '#FEE2E2', color: '#DC2626', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', marginTop: 4 },

  form:      { display: 'flex', gap: 10, marginBottom: 8 },
  input:     { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid #D1D5DB', fontSize: 14, outline: 'none' },
  addBtn:    { padding: '10px 22px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  error:     { color: '#DC2626', fontSize: 13, margin: '0 0 12px' },

  emptyBox:  { textAlign: 'center', padding: '48px 32px', background: '#F9FAFB', borderRadius: 12, border: '1px dashed #D1D5DB' },
  emptyTitle:{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '0 0 6px' },
  emptyHint: { fontSize: 14, color: '#9CA3AF', margin: 0 },
  empty:     { color: '#9CA3AF', fontSize: 14 },

  table:     { border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' },
  tableHead: { display: 'flex', alignItems: 'center', background: '#F9FAFB', padding: '10px 16px', borderBottom: '1px solid #E5E7EB' },
  row:       { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F3F4F6', background: '#fff' },
  col:       { flex: 1, fontSize: 14, color: '#111827' },
  deleteBtn: { padding: '5px 12px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
};
