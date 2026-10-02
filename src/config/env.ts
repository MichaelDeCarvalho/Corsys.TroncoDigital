export type PublicEnv = {
  supabaseUrl: string
  supabasePublishableKey: string
}

export function parsePublicEnv(input: Record<string, string | undefined>): PublicEnv {
  const supabaseUrl = input.VITE_SUPABASE_URL?.trim()
  const supabasePublishableKey = input.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is required')
  if (!supabasePublishableKey) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required')

  return { supabaseUrl, supabasePublishableKey }
}

export function readPublicEnv(): PublicEnv {
  return parsePublicEnv(import.meta.env)
}
