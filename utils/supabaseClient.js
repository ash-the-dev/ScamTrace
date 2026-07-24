import { createClient } from "@supabase/supabase-js";

export function createServiceSupabase() {
  const writeTimeoutMs = Number(process.env.SUPABASE_WRITE_TIMEOUT_MS || 60000);
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY");
  }

  return createClient(url, key, {
    global: {
      fetch: (requestUrl, options = {}) =>
        fetch(requestUrl, {
          ...options,
          signal: options.signal ?? AbortSignal.timeout(writeTimeoutMs),
        }),
    },
  });
}
