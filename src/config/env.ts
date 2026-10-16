export type PublicEnv = {
  supabaseUrl: string
  supabasePublishableKey: string
}

export function parsePublicEnv(input: Record<string, string | undefined>): PublicEnv {
  const supabaseUrl = input.VITE_SUPABASE_URL?.trim()
  const supabasePublishableKey = input.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is required')
  if (!supabasePublishableKey) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required')
  const url = new URL(supabaseUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Supabase URL must be an HTTPS origin')
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(supabasePublishableKey)) {
    throw new Error('Only a publishable Supabase key is allowed in the frontend')
  }

  return { supabaseUrl, supabasePublishableKey }
}

export function readPublicEnv(): PublicEnv {
  return parsePublicEnv(import.meta.env)
}
