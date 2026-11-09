import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  getAccountDisplayName, getAccountDisplayNameError, normalizeDisplayName,
} from '../lib/accountProfile';
import { authCallbackUrl, type SocialProvider } from '../lib/authRedirect';

export type AuthUser = {
  id: string;
  email?: string;
  displayName: string;
  emailConfirmed: boolean;
  createdAt?: string;
};

type SessionUser = NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>;

function toAuthUser(user: SessionUser | null | undefined): AuthUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || undefined,
    displayName: getAccountDisplayName(user.user_metadata),
    emailConfirmed: Boolean(user.email_confirmed_at),
    createdAt: user.created_at,
  };
}

export function useSupabaseUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) throw error;
        setUser(toAuthUser(data.session?.user));
        setLoadError(false);
      } catch {
        if (!isMounted) return;
        setLoadError(true);
        setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(toAuthUser(session?.user));
      setLoading(false);
      setLoadError(false);
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const nickname = displayName === undefined ? undefined : normalizeDisplayName(displayName);
    if (nickname !== undefined) {
      const validationError = getAccountDisplayNameError(nickname);
      if (validationError) throw new Error(validationError);
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      ...(nickname !== undefined ? { options: { data: { display_name: nickname } } } : {}),
    });
    if (error) throw error;
    return data;
  }, []);

  const signInWithProvider = useCallback(async (provider: SocialProvider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authCallbackUrl(window.location.origin) },
    });
    if (error) throw error;
    return data;
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: authCallbackUrl(window.location.origin),
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  // Email OTP stays inside the same browser, avoiding cross-browser Magic Link
  // redirects (for example Outlook opening Edge instead of Safari).
  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    const cleanEmail = email.trim();
    const cleanToken = token.trim();
    if (!/^\d{6}$/.test(cleanToken)) {
      throw new Error('Bitte gib den sechsstelligen Code aus deiner E-Mail ein.');
    }
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    });
    if (error) throw error;
    return data;
  }, []);

  const changePassword = useCallback(async (password: string) => {
    if (password.length < 8) throw new Error('Das Passwort muss mindestens 8 Zeichen lang sein.');
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session.session) throw new Error('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const nickname = normalizeDisplayName(displayName);
    const validationError = getAccountDisplayNameError(nickname);
    if (validationError) throw new Error(validationError);
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: nickname } });
    if (error) throw error;
    // onAuthStateChange USER_UPDATED also updates all other mounted consumers.
    setUser(toAuthUser(data.user));
    return data;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  }, []);

  return { user, loading, loadError, signIn, signUp, signInWithProvider, sendMagicLink, verifyEmailOtp, changePassword, updateDisplayName, signOut } as const;
}

export type UseSupabaseUserReturn = ReturnType<typeof useSupabaseUser>;
