import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { previewBuildIdentity } from './src/lib/previewBuildIdentity'
import { assertLegalBuildConfiguration } from './src/lib/parseApprovedLegalPages'

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    assertLegalBuildConfiguration(env.VITE_APPROVED_LEGAL_PAGES_JSON, env.VITE_LEGAL_PAGES_ENABLED)
  }
  const identity = command === 'build' ? previewBuildIdentity(process.env) : null
  return {
    plugins: [react(), {
      name: 'runnit-preview-build-identity',
      apply: 'build',
      generateBundle() {
        if (identity) this.emitFile({ type: 'asset', fileName: 'runnit-build.json', source: JSON.stringify(identity) + '\n' })
      }
    }],
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
