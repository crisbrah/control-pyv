import { createClient } from '@supabase/supabase-js';
import { demoFetch } from '../demo/demoFetch';

export const DEMO = import.meta.env.VITE_DEMO === '1';
const url = DEMO ? 'https://demo.supabase.co' : (import.meta.env.VITE_SUPABASE_URL as string);
const key = DEMO ? 'demo' : (import.meta.env.VITE_SUPABASE_KEY as string);
if (!url || !key) console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY en .env');

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: !DEMO, detectSessionInUrl: false, storageKey: DEMO ? 'sb-demo' : undefined },
  global: DEMO ? { fetch: demoFetch } : undefined,
});
