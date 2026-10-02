import { parsePublicEnv } from './env'

describe('parsePublicEnv', () => {
  it('fails closed when required Supabase public configuration is missing', () => {
    expect(() => parsePublicEnv({})).toThrow('VITE_SUPABASE_URL is required')
  })

  it('accepts URL and publishable key', () => {
    expect(parsePublicEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    })).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'sb_publishable_test',
    })
  })
  it('rejects a server secret in frontend configuration', () => {
    expect(() => parsePublicEnv({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test' })).toThrow('Only a publishable')
  })
  it('rejects credential-bearing, insecure or non-origin URLs', () => {
    for (const url of ['http://example.supabase.co', 'https://user:password@example.supabase.co', 'https://example.supabase.co/rest/v1']) {
      expect(() => parsePublicEnv({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' })).toThrow('HTTPS origin')
    }
  })
})
