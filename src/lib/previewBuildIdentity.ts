export type PreviewBuildIdentity = Readonly<{
  schema: 'runnit-preview-build-v1';
  branch: 'develop';
  commit: string;
}>;

const validCommit = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

/** No project credentials, URL, account details or arbitrary environment data.
 * Missing deployment metadata must not be presented as verified identity. */
export function previewBuildIdentity(env: Record<string, string | undefined>): PreviewBuildIdentity | null {
  if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== 'develop' ||
      !validCommit(env.VERCEL_GIT_COMMIT_SHA)) return null;
  return { schema: 'runnit-preview-build-v1', branch: 'develop', commit: env.VERCEL_GIT_COMMIT_SHA };
}

export function matchesPreviewBuildIdentity(raw: unknown, expectedCommit: unknown): boolean {
  if (!validCommit(expectedCommit) || !raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const value = raw as Record<string, unknown>;
  return Object.keys(value).length === 3 &&
    Object.prototype.hasOwnProperty.call(value, 'schema') &&
    Object.prototype.hasOwnProperty.call(value, 'branch') &&
    Object.prototype.hasOwnProperty.call(value, 'commit') &&
    value.schema === 'runnit-preview-build-v1' && value.branch === 'develop' &&
    value.commit === expectedCommit;
}
