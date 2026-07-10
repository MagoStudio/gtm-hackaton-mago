import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

// Only @mago.studio accounts may use the app.
export const ALLOWED_EMAIL_DOMAIN = 'mago.studio';
export const isAllowedEmail = (email?: string | null) =>
  !!email && email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reject any session whose email isn't @mago.studio (covers pre-existing
    // accounts and is a second line of defense behind the DB signup trigger).
    const apply = async (session: Session | null) => {
      if (session?.user && !isAllowedEmail(session.user.email)) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setLoading(false);
        toast.error('Access is restricted to mago.studio accounts.');
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => apply(session));

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
