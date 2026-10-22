import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { parsePublicEnv } from './src/config/env'

export default defineConfig(({ command, mode }) => {
  const buildEnv = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  if (command === 'build') {
    parsePublicEnv(buildEnv)
  }
  const devQA = buildEnv.VITE_DEV_QA_ENABLED === 'true'
  if (devQA && buildEnv.VITE_SUPABASE_URL !== 'https://szqkdekwhzxsoxorgvaz.supabase.co') throw new Error('DEV QA is restricted to the approved DEV project')
  return {
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['.run.app', 'localhost', '127.0.0.1'],
  },
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
