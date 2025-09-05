import { createClient } from '@supabase/supabase-js';

function getEnv(nameVariants: string[]): string | undefined {
  for (const name of nameVariants) {
    // @ts-ignore - both process.env and import.meta.env may exist depending on bundler
    const val = (typeof process !== 'undefined' ? process.env?.[name] : undefined) ?? (typeof import.meta !== 'undefined' ? (import.meta as any)?.env?.[name] : undefined);
    if (val) return val as string;
  }
  return undefined;
}

const SUPABASE_URL = getEnv(['NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL']);
const SUPABASE_ANON_KEY = getEnv(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY']);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loudly during development so misconfiguration is obvious
  // eslint-disable-next-line no-console
  console.warn('[Supabase] Missing URL or anon key. Set env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

export type SupabaseClientType = typeof supabase;

