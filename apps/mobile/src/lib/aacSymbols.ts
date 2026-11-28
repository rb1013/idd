import { File, Directory, Paths } from 'expo-file-system';
import { supabase } from './supabase';

// Learner chat board content, managed by admins in the database (migrations 094 / 095):
//   aac_phrases  — "Say hello" phrases (emoji + label, sent as text)
//   aac_symbols  — picture symbols (images in the public 'aac-symbols' Storage bucket, sent as image URL)
//
// Caching: the board and its images are kept on the phone (aac_board/).
//   - First open: load both lists, download every symbol image, save the cache.
//   - Later opens: show the cache instantly, then refreshBoard() re-reads both lists once (silently)
//     and compares each row's updated_at with the cached copy; only changed / new images are
//     downloaded again, removed ones are deleted. No timer — one check per board open.

const SYMBOL_BUCKET = 'aac-symbols';
const boardDir  = new Directory(Paths.document, 'aac_board');
const boardFile = new File(boardDir, 'board.json');
// Old cache from the OpenSymbols version (searched images); removed on the first refresh
const legacyDir = new Directory(Paths.document, 'aac_symbols');

export interface AACPhrase {
  id: string;
  emoji: string;
  label: string;   // shown under the emoji, and read aloud
  phrase: string;  // text sent as the message
  updated_at: string;
}

export interface AACSymbol {
  key: string;
  label: string;       // shown under the picture, and read aloud
  image_path: string;  // file name in the 'aac-symbols' bucket
  updated_at: string;
  imageUrl: string;    // public URL — sent as the message so the recipient can render it
  localUri: string;    // cached file on this phone (or the remote URL if the download failed)
}

export interface AACBoard {
  phrases: AACPhrase[];
  symbols: AACSymbol[];
}

/** The board saved on this phone by the last successful refresh, or null on first use. */
export async function readCachedBoard(): Promise<AACBoard | null> {
  try {
    if (!boardFile.exists) return null;
    const board = JSON.parse(await boardFile.text()) as AACBoard;
    return Array.isArray(board?.phrases) && Array.isArray(board?.symbols) ? board : null;
  } catch {
    return null;
  }
}

/**
 * Re-reads both lists from the database and brings the cache up to date (see top of file).
 * Throws if the lists can't be loaded (e.g. offline) — callers keep showing the cached board.
 */
export async function refreshBoard(cached: AACBoard | null): Promise<AACBoard> {
  const [phrasesRes, symbolsRes] = await Promise.all([
    supabase.from('aac_phrases').select('id, emoji, label, phrase, updated_at')
      .eq('is_active', true).order('sort_order'),
    supabase.from('aac_symbols').select('key, label, image_path, updated_at')
      .eq('is_active', true).order('sort_order'),
  ]);
  if (phrasesRes.error) throw phrasesRes.error;
  if (symbolsRes.error) throw symbolsRes.error;

  if (!boardDir.exists) boardDir.create();
  if (legacyDir.exists) { try { legacyDir.delete(); } catch {} }

  const cachedByKey = new Map((cached?.symbols ?? []).map(s => [s.key, s]));

  const symbols: AACSymbol[] = await Promise.all((symbolsRes.data ?? []).map(async row => {
    const imageUrl = supabase.storage.from(SYMBOL_BUCKET).getPublicUrl(row.image_path).data.publicUrl;
    const prev = cachedByKey.get(row.key);
    const unchanged = prev
      && prev.updated_at === row.updated_at
      && prev.image_path === row.image_path
      && !prev.localUri.startsWith('http')          // last download had failed — try again
      && new File(prev.localUri).exists;
    if (unchanged) return { ...prev!, label: row.label };

    // New or changed: download to a file name that includes updated_at, so a replaced image never
    // reuses the old file name (the image component would otherwise keep showing the old picture).
    const ext = (row.image_path.split('.').pop() || 'png').toLowerCase();
    const stamp = Date.parse(row.updated_at) || Date.now();
    const target = new File(boardDir, `${row.key}_${stamp}.${ext}`);
    try {
      const file = await File.downloadFileAsync(imageUrl, target, { idempotent: true });
      return { key: row.key, label: row.label, image_path: row.image_path, updated_at: row.updated_at, imageUrl, localUri: file.uri };
    } catch {
      // Keep the remote URL so the board still works; the next refresh retries the download
      return { key: row.key, label: row.label, image_path: row.image_path, updated_at: row.updated_at, imageUrl, localUri: imageUrl };
    }
  }));

  const board: AACBoard = { phrases: (phrasesRes.data ?? []) as AACPhrase[], symbols };

  // Delete cached images that are no longer used (removed, hidden or replaced symbols)
  const keep = new Set(symbols.map(s => s.localUri));
  for (const entry of boardDir.list()) {
    if (entry instanceof File && entry.name !== boardFile.name && !keep.has(entry.uri)) {
      try { entry.delete(); } catch {}
    }
  }

  await boardFile.write(JSON.stringify(board));   // async since SDK 58 — wait so a failed save reaches the caller
  return board;
}

/** Symbol messages are stored as the image URL; everything else is plain text. */
export function isSymbolMessage(content: string): boolean {
  return content.startsWith('http://') || content.startsWith('https://');
}
