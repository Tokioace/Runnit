import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createAuthSnapshotGuard } from '../lib/authSnapshotGuard';
import { createAccountMutationGuard, confirmMutationIdentity } from '../lib/accountMutationGuard';
import {
  getAccountDisplayName, getAccountDisplayNameError, normalizeDisplayName,
} from '../lib/accountProfile';
import { authCallbackUrl, emailLoginOptions, isNativeAuthRuntime, type SocialProvider } from '../lib/authRedirect';
import { getWalkingCalibration, type WalkingCalibration } from '../lib/strideCalibration';

export type AuthUser = {
  id: string;
  email?: string;
  displayName: string;
  emailConfirmed: boolean;
  walkingCalibration: WalkingCalibration | null;
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
    walkingCalibration: getWalkingCalibration(user.user_metadata),
    createdAt: user.created_at,
  };
}

export function useSupabaseUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const mutationGuard = useRef(createAccountMutationGuard());

  useEffect(() => {
    const guard = createAuthSnapshotGuard();
    const initialRevision = guard.capture();
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!guard.isCurrent(initialRevision)) return;
        if (error) throw error;
        mutationGuard.current.setAccount(data.session?.user.id ?? null);
        setUser(toAuthUser(data.session?.user));
        setLoadError(false);
      } catch {
        if (!guard.isCurrent(initialRevision)) return;
        mutationGuard.current.setAccount(null);
        setLoadError(true);
        setUser(null);
      } finally {
        if (guard.isCurrent(initialRevision)) setLoading(false);
      }
    };
    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!guard.acceptEvent()) return;
      mutationGuard.current.setAccount(session?.user.id ?? null);
      setUser(toAuthUser(session?.user));
      setLoading(false);
      setLoadError(false);
    });

    return () => {
      guard.close();
      mutationGuard.current.setAccount(null);
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
    if (isNativeAuthRuntime()) throw new Error('Native provider login disabled until secure callback support is available.');
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
      options: emailLoginOptions(window.location.href, window.location.origin),
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

  const beginAccountMutation = useCallback(() => mutationGuard.current.begin(user?.id ?? null), [user?.id]);

  const changePassword = useCallback(async (password: string) => {
    if (password.length < 8) throw new Error('Das Passwort muss mindestens 8 Zeichen lang sein.');
    const assertCurrent = beginAccountMutation();
    await confirmMutationIdentity(user?.id ?? null, assertCurrent, async () => {
      const { data, error } = await supabase.auth.getUser();
      return error ? null : data.user?.id ?? null;
    });
    assertCurrent();
    const { data, error } = await supabase.auth.updateUser({ password });
    assertCurrent();
    if (error) throw error;
    if (data.user?.id !== user?.id) throw new Error('Passwortänderung nicht für dieses Konto bestätigt.');
  }, [user?.id, beginAccountMutation]);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const nickname = normalizeDisplayName(displayName);
    const validationError = getAccountDisplayNameError(nickname);
    if (validationError) throw new Error(validationError);
    const assertCurrent = beginAccountMutation();
    await confirmMutationIdentity(user?.id ?? null, assertCurrent, async () => {
      const { data, error } = await supabase.auth.getUser();
      return error ? null : data.user?.id ?? null;
    });
    assertCurrent();
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: nickname } });
    assertCurrent();
    if (error) throw error;
    if (!data.user || data.user.id !== user?.id) throw new Error('Profiländerung nicht für dieses Konto bestätigt.');
    // Keep the public leaderboard and private profile using the same nickname.
    // RLS restricts the write to the authenticated user's own row.
    const synced = await supabase.from('users')
      .update({ username: nickname }).eq('id', data.user.id)
      .select('username').single();
    assertCurrent();
    // USER_UPDATED already updates every mounted consumer. Do not restore
    // the older identity here after the asynchronous profile row sync.
    if (synced.error || synced.data?.username !== nickname) {
      throw new Error('Profilname geändert, aber die Rangliste konnte nicht synchronisiert werden. Bitte erneut speichern.');
    }
    return data;
  }, [user?.id, beginAccountMutation]);

  const signOut = useCallback(async () => {
    beginAccountMutation();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // SIGNED_OUT is the authoritative update; a late operation completion
    // must not clear a newer sign-in.
  }, [beginAccountMutation]);

  return { user, loading, loadError, signIn, signUp, signInWithProvider, sendMagicLink, verifyEmailOtp, changePassword, updateDisplayName, signOut, beginAccountMutation } as const;
}

export type UseSupabaseUserReturn = ReturnType<typeof useSupabaseUser>;
