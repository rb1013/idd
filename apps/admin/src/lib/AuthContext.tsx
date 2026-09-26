import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  session: Session | null;
  isAdmin: boolean;
  adminEmail: string | null;
  loading: boolean;
  needsPasswordReset: boolean;
  clearPasswordReset: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // If this is a password recovery redirect, wait for the PASSWORD_RECOVERY
      // event from onAuthStateChange instead of treating it as a normal login.
      if (window.location.hash.includes('type=recovery')) {
        setNeedsPasswordReset(true);
        setLoading(false);
      } else if (session) {
        checkAdmin(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordReset(true);
        setLoading(false);
      } else if (session) {
        setNeedsPasswordReset(false);
        checkAdmin(session.user.id);
      } else {
        setIsAdmin(false);
        setNeedsPasswordReset(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId: string) {
    const { data } = await supabase.from('admins').select('id, email').eq('id', userId).single();
    setIsAdmin(!!data);
    setAdminEmail(data?.email ?? null);
    setLoading(false);
  }

  function clearPasswordReset() { setNeedsPasswordReset(false); }

  return (
    <AuthContext.Provider value={{ session, isAdmin, adminEmail, loading, needsPasswordReset, clearPasswordReset, signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
