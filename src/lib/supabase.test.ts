import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/env', () => ({ readPublicEnv: () => ({
  supabaseUrl: 'https://szqkdekwhzxsoxorgvaz.supabase.co',
  supabasePublishableKey: 'sb_publishable_transport_test',
}) }))

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe('Application Supabase transport (no live service)', () => {
  it('returns a definitive PT409 after exactly one POST through the installed SDK', async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'PT409', message: 'stale version', details: null, hint: null,
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', transport)
    const { getSupabaseClient } = await import('./supabase')
    const client = getSupabaseClient()
    const result = await client.rpc('save_tenant_identity', { p_organization_id: 'test-only' })
    expect(result.status).toBe(409)
    expect(result.error?.code).toBe('PT409')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0][1]).toMatchObject({ method: 'POST', signal: expect.any(AbortSignal) })
    await client.auth.stopAutoRefresh()
  })

  it('does not repeat a POST with an unknown network outcome', async () => {
    const transport = vi.fn().mockRejectedValue(new TypeError('network unavailable'))
    vi.stubGlobal('fetch', transport)
    const { getSupabaseClient } = await import('./supabase')
    const client = getSupabaseClient()
    const result = await client.rpc('save_tenant_identity', { p_idempotency_key: 'test-only' })
    expect(result.error).not.toBeNull()
    expect(transport).toHaveBeenCalledTimes(1)
    await client.auth.stopAutoRefresh()
  })

  it('keeps retries disabled even for a retryable GET response', async () => {
    const transport = vi.fn().mockResolvedValue(new Response('{}', {
      status: 520, headers: { 'Content-Type': 'application/json', 'Retry-After': '0' },
    }))
    vi.stubGlobal('fetch', transport)
    const { getSupabaseClient } = await import('./supabase')
    const client = getSupabaseClient()
    const result = await client.from('organization_settings').select('organization_id')
    expect(result.status).toBe(520)
    expect(transport).toHaveBeenCalledTimes(1)
    await client.auth.stopAutoRefresh()
  })
})
