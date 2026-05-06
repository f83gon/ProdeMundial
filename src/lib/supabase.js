import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.warn('[Supabase] Falta configurar VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env')
}

export const supabase = createClient(url || 'http://localhost', anon || 'anon', {
  auth: { persistSession: true, autoRefreshToken: true }
})
