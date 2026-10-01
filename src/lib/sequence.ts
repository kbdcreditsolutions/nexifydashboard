// Document codes (REV-00001, EXP-00001, INV-2026-0001...) are derived from a
// row count, which races under concurrent writers — two requests can read
// the same count and both try to insert the same unique code. Rather than
// add a dedicated counter table, retry the single insert that can collide
// (P2002 on the unique code column) with the next count, a few times.
const UNIQUE_CONSTRAINT_ERROR = "P2002";

export async function withSequentialCodeRetry<T>(attempt: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await attempt();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== UNIQUE_CONSTRAINT_ERROR) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
