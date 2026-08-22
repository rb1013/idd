import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { saveGuardianProfile } from './biometricStore';
import { Guardian, UserProfile } from '../types';

interface AuthContextType {
  session: Session | null;
  guardian: Guardian | null;
  activeUser: UserProfile | null;
  loading: boolean;
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
  const activeUserRef = useRef<UserProfile | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  activeUserRef.current = activeUser;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        currentUserIdRef.current = session.user.id;
        fetchRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
    <AuthContext.Provider value={{ session, guardian, activeUser, loading, setActiveUser, refreshGuardian, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
