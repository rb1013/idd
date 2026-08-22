import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

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
