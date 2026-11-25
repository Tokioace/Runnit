// UI-side identity/lifetime guard, not an authorization or SDK-lock boundary.
export function createAccountMutationGuard() {
  let account: string | null = null;
  let revision = 0;
  return {
    setAccount(next: string | null) {
      if (next !== account) { account = next; revision += 1; }
    },
    begin(expected: string | null) {
      const captured = revision;
      const assertCurrent = () => {
        if (!expected || account !== expected || revision !== captured) {
          throw new Error('Dein Konto hat sich geändert. Bitte öffne die Einstellungen erneut.');
        }
      };
      assertCurrent();
      return assertCurrent;
    },
  };
}
export async function confirmMutationIdentity(
  expected: string | null,
  assertCurrent: () => void,
  readIdentity: () => Promise<string | null>,
): Promise<void> {
  assertCurrent();
  const actual = await readIdentity();
  assertCurrent();
  if (!expected || actual !== expected) throw new Error('Bitte melde dich erneut an.');
}
