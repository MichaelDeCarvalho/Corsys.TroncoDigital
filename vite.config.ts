import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { parsePublicEnv } from './src/config/env'

export default defineConfig(({ command, mode }) => {
  if (command === 'build') parsePublicEnv({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env })
  const buildEnv = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  const devQA = buildEnv.VITE_DEV_QA_ENABLED === 'true'
  if (devQA && buildEnv.VITE_SUPABASE_URL !== 'https://szqkdekwhzxsoxorgvaz.supabase.co') throw new Error('DEV QA is restricted to the approved DEV project')
  return {
  plugins: [react(), tailwindcss()],
  build: devQA ? { rollupOptions: { input: { app: 'index.html', qa: 'dev-qa.html' } } } : undefined,
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    clearMocks: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
  }
})
