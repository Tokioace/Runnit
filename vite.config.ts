import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { assertLegalBuildConfiguration } from './src/lib/parseApprovedLegalPages'

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    assertLegalBuildConfiguration(env.VITE_APPROVED_LEGAL_PAGES_JSON, env.VITE_LEGAL_PAGES_ENABLED)
  }
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src')
      }
    },
    server: {
      port: 5173,
      host: true
    }
  }
})
