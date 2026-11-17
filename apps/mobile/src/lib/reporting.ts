import { Alert } from 'react-native';
import { supabase } from './supabase';

// Guardian reports for guardian chat, discussion posts/replies, events and guardian profiles.
// (Learner chat has its own report flow via the guardian-action edge function — not used here.)
//
// Server side: migration 087_guardian_reports.sql. The database fills in who is reported and the
// content snapshot, blocks self-reports, and allows one report per guardian per item.
// Guardians can only INSERT reports (they can't read them back), so inserts never use .select().

export type ReportTarget =
  | { area: 'guardian_chat';    conversationId: string }
  | { area: 'discussion_post';  postId: string }
  | { area: 'discussion_reply'; replyId: string }
  | { area: 'event';            eventId: string }
  | { area: 'guardian_profile'; guardianId: string };

export type ReportReason = 'offensive' | 'spam' | 'harassment' | 'sensitive';

export type ReportResult = 'reported' | 'already' | 'failed';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'offensive',  label: 'Offensive' },
  { key: 'spam',       label: 'Spam' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'sensitive',  label: 'Sensitive' },
];

export const REPORT_TITLES: Record<ReportTarget['area'], string> = {
  guardian_chat:    'Report this guardian?',
  discussion_post:  'Report this post?',
  discussion_reply: 'Report this reply?',
  event:            'Report this event?',
  guardian_profile: 'Report this guardian?',
};

export const REPORT_THANKS =
  'Thanks, our team will review this within 24 hours. For more details, contact coheartsupport@gmail.com.';

// ── Session memory ───────────────────────────────────────────────────────────
// Items reported during this app session (lost on restart). Used to dim 🚩 and to answer
// "Already Reported" instantly. Deliberately NOT loaded from the server on page load (latency);
// after a restart the database's duplicate rule still catches repeats.
const reportedThisSession = new Set<string>();

function targetKey(t: ReportTarget): string {
  switch (t.area) {
    case 'guardian_chat':    return `guardian_chat:${t.conversationId}`;
    case 'discussion_post':  return `discussion_post:${t.postId}`;
    case 'discussion_reply': return `discussion_reply:${t.replyId}`;
    case 'event':            return `event:${t.eventId}`;
    case 'guardian_profile': return `guardian_profile:${t.guardianId}`;
  }
}

export function isReportedThisSession(t: ReportTarget): boolean {
  return reportedThisSession.has(targetKey(t));
}

// ── Saving ───────────────────────────────────────────────────────────────────
async function insertReport(t: ReportTarget, reason: ReportReason) {
  switch (t.area) {
    case 'guardian_chat':
      return supabase.from('guardian_chat_reports').insert({ conversation_id: t.conversationId, reason });
    case 'discussion_post':
      return supabase.from('discussion_reports').insert({ target_type: 'post', post_id: t.postId, reason });
    case 'discussion_reply':
      return supabase.from('discussion_reports').insert({ target_type: 'reply', reply_id: t.replyId, reason });
    case 'event':
      return supabase.from('event_reports').insert({ event_id: t.eventId, reason });
    case 'guardian_profile':
      return supabase.from('guardian_profile_reports').insert({ reported_guardian_id: t.guardianId, reason });
  }
}

/** Shown when a dimmed 🚩 (reported earlier this session) is tapped — no server call. */
export function showAlreadyReported() {
  Alert.alert('Already Reported');
}

/**
 * Saves one report. The reason is chosen in the report sheet (components/ReportFlag.tsx),
 * which shows the outcome. Marks the item as reported for this session on success/duplicate.
 */
export async function submitReport(t: ReportTarget, reason: ReportReason): Promise<ReportResult> {
  try {
    const { error } = await insertReport(t, reason);
    if (!error) {
      reportedThisSession.add(targetKey(t));
      return 'reported';
    }
    if (error.code === '23505') {
      // Database duplicate rule: this guardian already reported it (e.g. in an earlier session)
      reportedThisSession.add(targetKey(t));
      return 'already';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
