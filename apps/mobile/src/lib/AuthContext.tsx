import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { saveGuardianProfile } from './biometricStore';
import { Guardian, UserProfile } from '../types';

interface AuthContextType {
  session: Session | null;
  guardian: Guardian | null;
  activeUser: UserProfile | null;
  loading: boolean;
  pendingPasswordReset: boolean;
  setActiveUser: (user: UserProfile | null) => void;
  refreshGuardian: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);
  const activeUserRef = useRef<UserProfile | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  activeUserRef.current = activeUser;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Stale token in SecureStore (e.g. after reinstall on iOS) — clear it so
        // auto-refresh stops throwing. scope:'local' avoids a network call.
        supabase.auth.signOut({ scope: 'local' });
        setLoading(false);
        return;
      }
      setSession(session);
      if (session) {
        currentUserIdRef.current = session.user.id;
        fetchRole(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSession(session);
        setPendingPasswordReset(true);
        setLoading(false);
        return;
      }
      setSession(session);
      setPendingPasswordReset(false);
      if (session) {
        if (session.user.id !== currentUserIdRef.current) setLoading(true);
        currentUserIdRef.current = session.user.id;
        fetchRole(session.user.id);
      } else {
        currentUserIdRef.current = null;
        setGuardian(null);
        setActiveUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && activeUserRef.current) {
        supabase.from('user_profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', activeUserRef.current.id);
      }
    });
    return () => sub.remove();
  }, []);

  async function fetchRole(userId: string) {
    // Safety net: never stay in loading state longer than 10 seconds
    const timeout = setTimeout(() => setLoading(false), 10000);
    try {
      const { data: guardianData } = await supabase
        .from('guardians')
        .select('*')
        .eq('id', userId)
        .single();

      if (guardianData) {
        setGuardian(guardianData);
        setActiveUser(null);
        saveGuardianProfile({ name: guardianData.full_name, photo_url: guardianData.photo_url ?? null });
        return;
      }

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      if (profileData) {
        setActiveUser(profileData);
        setGuardian(null);
        supabase.from('user_profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', profileData.id);
        return;
      }

      // First sign-in after email verification — complete pending registration
      const raw = await SecureStore.getItemAsync('pending_guardian_registration');
      if (raw) {
        const p = JSON.parse(raw);
        await supabase.from('guardians').insert({
          id: userId,
          email: p.email,
          full_name: p.fullName,
          phone: p.phone,
          county: p.county,
          state: p.state,
          country: 'USA',
          situation_tags: p.selectedTags,
          // Reaching this point requires having passed GuardianVerificationScreen's
          // 18+ age check and consent checkbox — DOB itself is never stored.
          is_verified_guardian: true,
        });
        await supabase.rpc('set_guardian_pin', { pin_input: p.pin });
        if (p.photoUri) {
          try {
            const ext = (p.photoUri.split('.').pop() || 'jpg').toLowerCase();
            const fileName = `guardian-${userId}-${Date.now()}.${ext}`;
            const base64 = await FileSystem.readAsStringAsync(p.photoUri, { encoding: FileSystem.EncodingType.Base64 });
            const { data: uploadData } = await supabase.storage
              .from('avatars')
              .upload(fileName, decode(base64), { contentType: `image/${ext}`, upsert: true });
            if (uploadData) {
              const publicUrl = supabase.storage.from('avatars').getPublicUrl(uploadData.path).data.publicUrl;
              await supabase.from('guardians').update({ photo_url: publicUrl }).eq('id', userId);
            }
          } catch {
            // Photo upload failed (e.g. temp file expired) — proceed without photo
          }
        }
        await SecureStore.deleteItemAsync('pending_guardian_registration');
        const { data: newGuardian } = await supabase.from('guardians').select('*').eq('id', userId).single();
        if (newGuardian) {
          setGuardian(newGuardian);
          setActiveUser(null);
          saveGuardianProfile({ name: newGuardian.full_name, photo_url: newGuardian.photo_url ?? null });
        }
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  async function refreshGuardian() {
    if (!guardian) return;
    const { data } = await supabase.from('guardians').select('*').eq('id', guardian.id).single();
    if (data) {
      setGuardian(data);
      saveGuardianProfile({ name: data.full_name, photo_url: data.photo_url ?? null });
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, guardian, activeUser, loading, pendingPasswordReset, setActiveUser, refreshGuardian, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
