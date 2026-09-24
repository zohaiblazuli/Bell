import type { Env } from './env.ts';

// Atomic rate limiter — the SQLite equivalent of the community_consume_rate_limit
// RPC. One UPSERT that increments the bucket and returns the new count; the caller
// is allowed iff hits <= limit. Window bucketing matches the Edge Function exactly
// (floor now to a `minutes`-wide bucket, ISO-8601 string).
export async function consumeRateLimit(
  env: Env,
  key: string,
  action: string,
  minutes: number,
  limit: number,
): Promise<boolean> {
  const bucketMs = minutes * 60_000;
  const start = new Date(Math.floor(Date.now() / bucketMs) * bucketMs).toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO community_rate_limits (key_hash, action, window_start, hits)
     VALUES (?1, ?2, ?3, 1)
     ON CONFLICT(key_hash, action, window_start)
       DO UPDATE SET hits = hits + 1
     RETURNING hits`,
  )
    .bind(key, action, start)
    .first<{ hits: number }>();
  return (row?.hits ?? Number.MAX_SAFE_INTEGER) <= limit;
}
