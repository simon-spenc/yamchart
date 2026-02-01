import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createAuthClient, type AuthClient, type Session } from '@dashbook/auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  client: AuthClient;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createAuthClient(supabaseUrl, supabaseAnonKey));
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const session = await client.getSession();
    setSession(session);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));

    const { data: { subscription } } = client.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.unsubscribe();
  }, [client]);

  return (
    <AuthContext.Provider value={{ session, loading, client, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
