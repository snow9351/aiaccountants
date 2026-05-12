import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

export type SignUpMetadata = {
  /** default: business owner workspace */
  onboarding?: 'business' | 'accountant';
  firmName?: string;
  firmEin?: string;
  /** When true, signup trigger skips creating a default company (use with invite acceptance) */
  skipDefaultWorkspace?: boolean;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, meta?: SignUpMetadata) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** SessionStorage key for invite acceptance after login (see AcceptInvite page). */
export const PENDING_INVITE_SESSION_KEY = 'pending_invite_token';

export function setPendingInviteToken(token: string | null) {
  if (!token) sessionStorage.removeItem(PENDING_INVITE_SESSION_KEY);
  else sessionStorage.setItem(PENDING_INVITE_SESSION_KEY, token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Don't auto-login in demo mode — let the user see the Login page
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      // Auth service unreachable — treat as unauthenticated
      setUser(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, name: string, meta?: SignUpMetadata) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    const userMetadata: Record<string, string> = {
      full_name: name,
      onboarding: meta?.onboarding ?? 'business',
    };
    if (meta?.firmName) userMetadata.firm_name = meta.firmName;
    if (meta?.firmEin) userMetadata.firm_ein = meta.firmEin;
    if (meta?.skipDefaultWorkspace) userMetadata.skip_default_workspace = 'true';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: userMetadata },
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    setPendingInviteToken(null);
    if (!isSupabaseConfigured) {
      setUser(null);
      setSession(null);
      return;
    }
    // Revoke refresh token on the server and clear persisted session (localStorage).
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      // Still clear this browser's session if the network revoke fails (offline / blocked).
      await supabase.auth.signOut({ scope: 'local' });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        resetPassword,
        signOut,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
