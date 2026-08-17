import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.',
  )
}

if (typeof window !== 'undefined'
    && window.location.protocol === 'https:'
    && url.startsWith('http://')) {
  throw new Error(
    `VITE_SUPABASE_URL is http:// but this page is https://. The browser blocks ` +
    `that as mixed content and every request fails with "Failed to fetch". ` +
    `Change it to https:// in Cloudflare and redeploy. Current value: ${url}`,
  )
}

/** Only ever the anon key here. RLS + the staff allowlist do the real work. */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
