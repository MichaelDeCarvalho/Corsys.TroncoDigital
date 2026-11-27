import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readPublicEnv } from '../config/env'

export const SUPABASE_REQUEST_TIMEOUT_MS = 15000

export type RpcTransportMeta = {
  rpcName: string
  requestId: string | null
  httpStatus: number | null
  recordedAt: number
}

const REQUEST_ID_SAFE = /^[A-Za-z0-9._:-]{4,128}$/
const MAX_TRACKED_RPCS = 32
const rpcTransportMeta = new Map<string, RpcTransportMeta>()

function extractRpcNameFromUrl(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const pathname = new URL(raw).pathname
    const match = pathname.match(/\/rest\/v1\/rpc\/([a-zA-Z0-9_]+)$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function sanitizeHeaderRequestId(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return REQUEST_ID_SAFE.test(trimmed) ? trimmed : null
}

function recordRpcTransportMeta(meta: RpcTransportMeta): void {
  if (rpcTransportMeta.size >= MAX_TRACKED_RPCS && !rpcTransportMeta.has(meta.rpcName)) {
    const oldestKey = rpcTransportMeta.keys().next().value
    if (oldestKey) rpcTransportMeta.delete(oldestKey)
  }
  rpcTransportMeta.set(meta.rpcName, meta)
}

export function getLastRpcTransportMeta(rpcName: string, sinceMs = 0): RpcTransportMeta | null {
  const entry = rpcTransportMeta.get(rpcName)
  if (!entry || entry.recordedAt < sinceMs) return null
  return entry
}

export function clearRpcTransportMeta(): void {
  rpcTransportMeta.clear()
}

let client: SupabaseClient | undefined

export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const env = readPublicEnv()
  client = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    // Financial mutations already handle uncertain outcomes with explicit idempotency keys.
    // Avoid automatic retries of definitive PT409 business conflicts.
    db: { retry: false },
    global: {
      fetch: async (url, options) => {
        const rpcName = extractRpcNameFromUrl(url)
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.any([
            AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS),
            ...(options?.signal ? [options.signal] : []),
          ]),
        })
        if (rpcName) {
          const requestId =
            sanitizeHeaderRequestId(response.headers.get('sb-request-id')) ??
            sanitizeHeaderRequestId(response.headers.get('x-request-id')) ??
            sanitizeHeaderRequestId(response.headers.get('cf-ray'))
          recordRpcTransportMeta({
            rpcName,
            requestId,
            httpStatus: response.status,
            recordedAt: Date.now(),
          })
        }
        return response
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}

