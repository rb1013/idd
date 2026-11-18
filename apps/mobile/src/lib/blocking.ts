import { Alert } from 'react-native';
import { supabase } from './supabase';

// Guardian ↔ guardian blocking (design: docs/guardian-block.md, server: migration 088).
//
// The database does all the hiding/stopping (both ways). The app only creates / removes rows in
// guardian_blocks, after a confirmation. On block, the database also removes the pair's
// connection and RSVPs to each other's events. Guardians can only see blocks THEY made.

async function currentGuardianId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function confirm(title: string, message: string | undefined, action: string): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: action, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Asks for confirmation, then blocks the guardian. Resolves true if they're now blocked
 * (including "already blocked"), so the caller can close sheets / refresh lists.
 */
export async function blockGuardian(guardianId: string, guardianName: string): Promise<boolean> {
  const ok = await confirm(
    `Block ${guardianName}?`,
    "You won't see their posts, replies or events, and you won't be able to message each other. " +
      'You can unblock them later in Connections → Blocked.',
    'Block',
  );
  if (!ok) return false;

  const me = await currentGuardianId();
  if (!me || me === guardianId) return false;

  // No .select(): just insert the block (the database trigger cleans up connection + RSVPs)
  const { error } = await supabase
    .from('guardian_blocks')
    .insert({ blocker_guardian_id: me, blocked_guardian_id: guardianId });

  if (error && error.code !== '23505') {   // 23505 = already blocked → treat as done
    Alert.alert("Couldn't block", 'Please try again.');
    return false;
  }
  return true;
}

/** Asks for confirmation, then removes this guardian's block. Resolves true if unblocked. */
export async function unblockGuardian(guardianId: string, guardianName: string): Promise<boolean> {
  const ok = await confirm(`Unblock ${guardianName}?`, undefined, 'Unblock');
  if (!ok) return false;

  const me = await currentGuardianId();
  if (!me) return false;

  const { error } = await supabase
    .from('guardian_blocks')
    .delete()
    .eq('blocker_guardian_id', me)
    .eq('blocked_guardian_id', guardianId);

  if (error) {
    Alert.alert("Couldn't unblock", 'Please try again.');
    return false;
  }
  return true;
}
