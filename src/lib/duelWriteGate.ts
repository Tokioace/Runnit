/** Local single-writer gate per duel. The server remains authoritative for
 * concurrent requests from other devices and for uncertain network outcomes. */
export function createDuelWriteGate() {
  const owners = new Map<string, symbol>();
  return {
    tryAcquire(duelId: string): (() => void) | null {
      if (owners.has(duelId)) return null;
      const token = Symbol(duelId);
      owners.set(duelId, token);
      return () => {
        if (owners.get(duelId) === token) owners.delete(duelId);
      };
    },
  };
}
