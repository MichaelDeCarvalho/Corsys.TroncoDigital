import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readPublicEnv } from '../config/env'

let client: SupabaseClient | undefined

export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const env = readPublicEnv()
  client = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
