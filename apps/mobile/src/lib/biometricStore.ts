import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from './supabase';

const GUARDIAN_KEY = 'guardian_profile';
const GUARDIAN_CREDS_KEY = 'guardian_credentials';
const USER_INDEX_KEY = 'biometric_user_ids';
const userKey = (id: string) => `biometric_user_${id}`;

export interface GuardianProfile {
  name: string;
  photo_url: string | null;
}

export interface BiometricUser {
  id: string;
  name: string;
  photo_url: string | null;
  email: string;
  password: string;
}

// ── Guardian profile ──────────────────────────────────────────────────────────

export async function saveGuardianProfile(profile: GuardianProfile) {
  await SecureStore.setItemAsync(GUARDIAN_KEY, JSON.stringify(profile));
}

export async function loadGuardianProfile(): Promise<GuardianProfile | null> {
  const raw = await SecureStore.getItemAsync(GUARDIAN_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ── Guardian credentials (for re-auth after learner session switch) ───────────

export interface GuardianCredentials {
  email: string;
  password: string;
}

export async function saveGuardianCredentials(creds: GuardianCredentials) {
  await SecureStore.setItemAsync(GUARDIAN_CREDS_KEY, JSON.stringify(creds));
}

export async function loadGuardianCredentials(): Promise<GuardianCredentials | null> {
  const raw = await SecureStore.getItemAsync(GUARDIAN_CREDS_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearGuardianCredentials() {
  await SecureStore.deleteItemAsync(GUARDIAN_CREDS_KEY);
}

// ── IDD user index ────────────────────────────────────────────────────────────

async function loadIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(USER_INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveIndex(ids: string[]) {
  await SecureStore.setItemAsync(USER_INDEX_KEY, JSON.stringify(ids));
}

// ── IDD user credentials ──────────────────────────────────────────────────────

export async function saveBiometricUser(user: BiometricUser) {
  await SecureStore.setItemAsync(userKey(user.id), JSON.stringify(user));
  const index = await loadIndex();
  if (!index.includes(user.id)) {
    await saveIndex([...index, user.id]);
  }
}

export async function removeBiometricUser(userId: string) {
  await SecureStore.deleteItemAsync(userKey(userId));
  const index = await loadIndex();
  await saveIndex(index.filter(id => id !== userId));
}

export async function loadBiometricUsers(): Promise<BiometricUser[]> {
  const index = await loadIndex();
  const users: BiometricUser[] = [];
  for (const id of index) {
    const raw = await SecureStore.getItemAsync(userKey(id));
    if (raw) users.push(JSON.parse(raw));
  }
  return users;
}

export async function isBiometricEnabledForUser(userId: string): Promise<boolean> {
  const index = await loadIndex();
  return index.includes(userId);
}

// ── Cross-device credential sync ─────────────────────────────────────────────

/** Encodes credentials for storage in Supabase (base64 JSON). */
function encodeSnapshot(email: string, password: string): string {
  return btoa(JSON.stringify({ email, password }));
}

/** Decodes a snapshot stored in Supabase back to credentials. */
function decodeSnapshot(snapshot: string): { email: string; password: string } {
  return JSON.parse(atob(snapshot));
}

/**
 * Saves the learner's credentials to Supabase so any device the guardian
 * logs into can fetch them. Called once at learner creation time.
 */
export async function saveCredentialSnapshot(userId: string, email: string, password: string): Promise<void> {
  const snapshot = encodeSnapshot(email, password);
  await supabase.from('user_profiles').update({ credential_snapshot: snapshot }).eq('id', userId);
}

/**
 * Fetches learner credentials from Supabase and saves them to local SecureStore.
 * Called when a learner tile is tapped on a device that has no local credentials.
 * Returns true if successful, false if no snapshot exists.
 */
export async function fetchAndCacheCredentials(userId: string, name: string, photo_url: string | null): Promise<boolean> {
  const { data } = await supabase
    .from('user_profiles')
    .select('credential_snapshot')
    .eq('id', userId)
    .single();

  if (!data?.credential_snapshot) return false;

  const { email, password } = decodeSnapshot(data.credential_snapshot);
  await saveBiometricUser({ id: userId, name, photo_url, email, password });
  return true;
}

// ── Device biometric capability ───────────────────────────────────────────────

/** True if the device has biometric hardware (Face ID / fingerprint chip). Use this to show the setup toggle. */
export async function isBiometricSupported(): Promise<boolean> {
  return LocalAuthentication.hasHardwareAsync();
}

/** True if biometrics are enrolled and ready to prompt. Use this before triggering the login prompt. */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function promptBiometric(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Use Passcode',
    disableDeviceFallback: false,
  });
  return result.success;
}
