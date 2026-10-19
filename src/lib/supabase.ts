import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readPublicEnv } from '../config/env'

let client: SupabaseClient | undefined

export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const env = readPublicEnv()
  client = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    // Financial mutations already handle uncertain outcomes with explicit idempotency keys.
    // Avoid automatic retries of definitive PT409 business conflicts.
    db: { retry: false },
    global: {
      fetch: (url, options) => fetch(url, {
        ...options,
        signal: AbortSignal.any([AbortSignal.timeout(15000), ...(options?.signal ? [options.signal] : [])]),
      }),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}

