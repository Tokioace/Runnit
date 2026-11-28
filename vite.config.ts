import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { verifyPreviewBundle } from './scripts/build-native-preview-web.mjs'
import { readFileSync } from 'node:fs'
import { matchesPreviewBuildIdentity } from './src/lib/previewBuildIdentity'
import { assertExternalBetaBuild } from './src/lib/externalBetaBuild'
import { previewBuildIdentity } from './src/lib/previewBuildIdentity'
import { assertLegalBuildConfiguration } from './src/lib/parseApprovedLegalPages'

export default defineConfig(({ command, mode }) => {
  const env = command === 'build' ? loadEnv(mode, process.cwd(), 'VITE_') : null
  if (env) {
    assertLegalBuildConfiguration(env.VITE_APPROVED_LEGAL_PAGES_JSON, env.VITE_LEGAL_PAGES_ENABLED)
    assertExternalBetaBuild(process.env, env)
  }
  const identity = command === 'build' ? previewBuildIdentity(process.env) : null
  return {
    plugins: [react(), {
      name: 'runnit-preview-build-identity',
      apply: 'build',
      generateBundle() {
        if (identity) this.emitFile({ type: 'asset', fileName: 'runnit-build.json', source: JSON.stringify(identity) + '\n' })
      }
    }, {
      name: 'runnit-external-beta-output-validation',
      apply: 'build',
      writeBundle(output) {
        if (process.env.RUNNIT_EXTERNAL_BETA !== 'true') return
        if (!env || !identity || !output.dir) throw Error('External beta output not identifiable')
        verifyPreviewBundle(output.dir, env)
        const marker = JSON.parse(readFileSync(path.join(output.dir, 'runnit-build.json'), 'utf8'))
        if (!matchesPreviewBuildIdentity(marker, identity.commit)) throw Error('External beta build identity mismatch')
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
