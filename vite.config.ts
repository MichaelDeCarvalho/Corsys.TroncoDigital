import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { parsePublicEnv } from './src/config/env'

export default defineConfig(({ command, mode }) => {
  if (command === 'build') parsePublicEnv({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env })
  return {
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    clearMocks: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
  }
})
