import { previewBuildIdentity } from './previewBuildIdentity.ts';
import { parseApprovedLegalPages } from './parseApprovedLegalPages.ts';
type Env = Record<string, string | undefined>;
const productionRef = 'fcbffqcmvgdojsdfwgyt';

/** Opt-in gate, not an access control or proof of backend isolation.
 * Regular private preview and production builds are intentionally unchanged. */
export function assertExternalBetaBuild(system: Env, publicEnv: Env): void {
  if (system.RUNNIT_EXTERNAL_BETA === undefined || system.RUNNIT_EXTERNAL_BETA === '' ||
      system.RUNNIT_EXTERNAL_BETA === 'false') return;
  if (system.RUNNIT_EXTERNAL_BETA !== 'true') throw Error('Invalid external beta flag');
  if (!previewBuildIdentity(system)) throw Error('External beta requires an identified develop preview');
  const ref = system.RUNNIT_EXTERNAL_BETA_PROJECT_REF;
  if (typeof ref !== 'string' || !/^[a-z]{20}$/.test(ref) || ref === productionRef ||
      publicEnv.VITE_SUPABASE_URL !== 'https://' + ref + '.supabase.co') {
    throw Error('External beta requires the separately approved nonproduction project');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,128}$/.test(publicEnv.VITE_SUPABASE_ANON_KEY ?? '')) {
    throw Error('External beta requires a publishable key');
  }
  if (system.RUNNIT_EXTERNAL_BETA_ISOLATION_CONFIRMED !== 'true') {
    throw Error('External beta isolation must be confirmed by operator');
  }
  if (!parseApprovedLegalPages(publicEnv.VITE_APPROVED_LEGAL_PAGES_JSON, publicEnv.VITE_LEGAL_PAGES_ENABLED)) {
    throw Error('External beta requires approved legal pages');
  }
  if (publicEnv.VITE_IOS_PREVIEW_SMOKE === 'true') throw Error('Native smoke mode is not external beta');
}
