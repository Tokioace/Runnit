/** Bound the caller's wait even if a transport ignores abort.
 * A timed-out mutation can still have committed. Never infer rollback. */
export async function withRequestDeadline<T>(
  request: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = 15000,
): Promise<T> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) {
    throw new Error('Invalid request deadline');
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Request deadline exceeded'));
        controller.abort();
      }, timeoutMs);
    });
    return await Promise.race([
      deadline,
      Promise.resolve(request(controller.signal)),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
