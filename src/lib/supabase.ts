import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_KEY as string;
if (!url || !key) console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY en .env');

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
