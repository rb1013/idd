import { Alert } from 'react-native';
import { Filter } from 'bad-words';
import wordConfig from './badWordsList.json';

// Shared content filter for everything users write (chat, discussion posts, replies, events).
//
// Two layers:
//   1. In the app (this file): the bad-words library + badWordsList.json, checked before sending.
//   2. On the server: the admin-managed blocked_words list (whole-word match), enforced by the
//      chat edge functions (_shared/blockedWords.ts) and by database triggers for discussions
//      and events (migrations 085/086, contains_blocked_word). The app can't read that list, so it relies on
//      the server's rejection — see isBlockedWordsError().

const filter = (() => {
  const f = new Filter();
  if (wordConfig.add.length) f.addWords(...wordConfig.add);
  if (wordConfig.remove.length) f.removeWords(...wordConfig.remove);
  return f;
})();

/** Layer 1: true if any of the given texts contains profanity. Empty values are ignored. */
export function containsProfanity(...texts: (string | null | undefined)[]): boolean {
  return texts.some(t => !!t && t.trim().length > 0 && filter.isProfane(t));
}

/** Message raised by the database trigger when a discussion post/reply hits the blocked_words list. */
export const BLOCKED_WORDS_ERROR = 'BLOCKED_WORDS';

/** Layer 2: true if a Supabase error is the server's blocked-words rejection. */
export function isBlockedWordsError(error: { message?: string } | null | undefined): boolean {
  return !!error?.message && error.message.includes(BLOCKED_WORDS_ERROR);
}

/** Standard alert shown when either layer blocks content. */
export function showKindWordsAlert(what: 'message' | 'post' | 'reply' | 'event' = 'message') {
  Alert.alert("Let's use kind words", `That ${what} contains language we can't ${what === 'message' ? 'send' : 'post'}.`);
}
