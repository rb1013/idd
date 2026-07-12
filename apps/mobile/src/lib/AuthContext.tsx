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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const activeUserRef = useRef<UserProfile | null>(null);
  activeUserRef.current = activeUser;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchRole(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setLoading(true);
        fetchRole(session.user.id);
      } else {
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
    // Check if this auth user is a guardian
    const { data: guardianData } = await supabase
      .from('guardians')
      .select('*')
      .eq('id', userId)
      .single();

    if (guardianData) {
      setGuardian(guardianData);
      setActiveUser(null);
      setLoading(false);
      // Persist guardian profile so the login tile can show their name/photo on next launch
      saveGuardianProfile({ name: guardianData.full_name, photo_url: guardianData.photo_url ?? null });
      return;
    }

    // Check if this auth user is a user profile
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', userId)
      .single();

    if (profileData) {
      setActiveUser(profileData);
      setGuardian(null);
      setLoading(false);
      supabase.from('user_profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', profileData.id);
      return;
    }

    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, guardian, activeUser, loading, setActiveUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
