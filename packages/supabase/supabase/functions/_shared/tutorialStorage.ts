import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Tutorial slide files are stored under <tutorialId>/ in these public buckets.
export const IMAGE_BUCKET = 'tutorial-images';
export const AUDIO_BUCKET = 'tutorial-audio';

// Every generated file gets a unique name (frame-<n>-<jobId|timestamp>) and is never overwritten
// with different content, so it can be cached for a long time without anyone seeing a stale copy.
export const IMMUTABLE_CACHE_SECONDS = '31536000'; // 1 year

export type StoredFile = { bucket: string; path: string };

/** Storage path inside `bucket` for one of our public URLs, or null if the URL isn't from that bucket. */
export function storagePathFromUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]) || null;
}

/** Best-effort delete; a failed cleanup must never fail the request itself. */
export async function removeFiles(
  supabase: SupabaseClient,
  files: StoredFile[],
  logTag: string,
) {
  for (const bucket of new Set(files.map(f => f.bucket))) {
    const paths = files.filter(f => f.bucket === bucket).map(f => f.path);
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) console.error(`[${logTag}] could not remove ${paths.join(', ')} from ${bucket}:`, error.message);
  }
}
