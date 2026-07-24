const TRANSIENT_RE =
  /522|502|503|504|timeout|timed\s*out|ECONNRESET|ETIMEDOUT|fetch failed|Cloudflare|connection timed out|upstream/i;

export function isTransientSupabaseError(error) {
  if (!error) return false;
  const status = Number(error.status ?? error.statusCode ?? error.code);
  if ([408, 425, 429, 500, 502, 503, 504, 522].includes(status)) return true;
  return TRANSIENT_RE.test(String(error.message || error));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a Supabase call that returns `{ data, error }` (or throws) on transient failures.
 * Uses exponential backoff: base * 2^attempt, capped at maxDelayMs.
 */
export async function withSupabaseRetry(operation, options = {}) {
  const retries = Number(
    options.retries ?? process.env.SUPABASE_WRITE_RETRIES ?? 5
  );
  const baseDelayMs = Number(
    options.baseDelayMs ?? process.env.SUPABASE_RETRY_BASE_MS ?? 1000
  );
  const maxDelayMs = Number(
    options.maxDelayMs ?? process.env.SUPABASE_RETRY_MAX_MS ?? 30000
  );
  const label = options.label || "supabase write";

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await operation();

      if (result?.error && isTransientSupabaseError(result.error)) {
        lastError = result.error;
        if (attempt >= retries) return result;

        const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
        console.warn(
          `${label}: transient error (attempt ${attempt + 1}/${retries + 1}), retry in ${delay}ms:`,
          String(result.error.message || result.error).slice(0, 160)
        );
        await sleep(delay);
        continue;
      }

      return result;
    } catch (err) {
      lastError = err;
      if (!isTransientSupabaseError(err) || attempt >= retries) {
        throw err;
      }

      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      console.warn(
        `${label}: thrown transient error (attempt ${attempt + 1}/${retries + 1}), retry in ${delay}ms:`,
        String(err.message || err).slice(0, 160)
      );
      await sleep(delay);
    }
  }

  return { data: null, error: lastError };
}
