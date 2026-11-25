/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { isNativeAuthRuntime } from './authRedirect';
import { nativeAuthStorageForWindow } from './nativeAuthStorage';

// Vite only rewrites statically referenced import.meta.env.VITE_* variables.
// Dynamic/optional access (import.meta?.env?.[name]) leaves the local dev
// server with an empty URL even when the public VITE_ variables are set.
const vitePublicEnv: Record<string, string | undefined> = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

function getEnv(nameVariants: string[]): string | undefined {
  for (const name of nameVariants) {
    // Process env fallback is used for non-Vite tools; browser values are
    // compile-time Vite env constants, not dynamic client-side secrets.
    // @ts-ignore process.env is optional in browser bundlers.
    const val = vitePublicEnv[name] ?? (typeof process !== 'undefined' ? process.env?.[name] : undefined);
    if (val) return val;
  }
  return undefined;
}

const SUPABASE_URL = getEnv(['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'REACT_APP_SUPABASE_URL']);
const SUPABASE_ANON_KEY = getEnv(['VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY']);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loudly during development so misconfiguration is obvious.
  console.warn('[Supabase] Missing public URL/anon key. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Persist the Supabase session in this browser across refreshes and restarts.
// Keep the SDK's default storage key so existing users remain signed in.
// Browser storage is isolated between Safari, in-app browsers and URL origins.
export const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
  auth: {
    persistSession: true,
    ...(isNativeAuthRuntime() ? { storage: nativeAuthStorageForWindow() } : {}),
    autoRefreshToken: true,
    // Native URL callbacks are not implemented; never import tokens from a WebView URL.
    detectSessionInUrl: !isNativeAuthRuntime(),
    flowType: 'implicit',
  },
});

export type SupabaseClientType = typeof supabase;
