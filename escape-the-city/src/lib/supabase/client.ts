import { createClient } from '@supabase/supabase-js';

interface RuntimeConfig {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
}

const runtimeConfig = (window as Window & {
  VRIENDENWEEKEND_CONFIG?: RuntimeConfig;
}).VRIENDENWEEKEND_CONFIG;
const url = import.meta.env.VITE_SUPABASE_URL || runtimeConfig?.supabaseUrl;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || runtimeConfig?.supabasePublishableKey;

export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;

export async function ensureAnonymousSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const result = await supabase.auth.signInAnonymously();
  if (result.error) {
    if (result.error.message.toLowerCase().includes('anonymous sign-ins are disabled')) {
      return null;
    }
    throw new Error(`Anoniem aanmelden mislukt: ${result.error.message}`);
  }
  return result.data.session;
}

