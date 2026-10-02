import { parsePublicEnv } from './env'

describe('parsePublicEnv', () => {
  it('fails closed when required Supabase public configuration is missing', () => {
    expect(() => parsePublicEnv({})).toThrow('VITE_SUPABASE_URL is required')
  })

  it('accepts URL and publishable key', () => {
    expect(parsePublicEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'public-key',
    })).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'public-key',
    })
  })
})
