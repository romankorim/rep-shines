import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

function setAuthCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (token) {
    document.cookie = `sb-token=${token}; path=/; max-age=3600; SameSite=Lax`;
  } else {
    document.cookie = "sb-token=; path=/; max-age=0; SameSite=Lax";
  }
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthCookie(session?.access_token ?? null);
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthCookie(session?.access_token ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    setAuthCookie(null);
    await supabase.auth.signOut();
  }, []);

  return {
    isAuthenticated: !!session,
    isLoading,
    session,
    user: session?.user ?? null,
    signIn,
    signUp,
    signOut,
  };
}
