/** Execute independent reads with bounded concurrency, preserving input order.
 * A rejection propagates to the caller; no partial history is published. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => PromiseLike<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('Concurrency must be a positive integer');
  }
  const results: R[] = new Array(items.length);
  let next = 0;
  let failed = false;
  const run = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
