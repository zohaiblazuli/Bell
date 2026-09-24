import { Hono } from 'hono';
import type { Env } from './env.ts';
import { fail } from './http.ts';
import { publicRoutes } from './routes/public.ts';
import { adminRoutes } from './routes/admin.ts';
import { authRoutes } from './auth/shim.ts';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.json({ service: 'bell-community-worker', ok: true }));

// Route groups mirror the two Supabase Edge Functions + the GoTrue base, so the
// Rust client's BELL_COMMUNITY_API_BASE / BELL_SUPABASE_URL can point at one origin.
app.route('/community-public', publicRoutes);
app.route('/community-admin', adminRoutes);
app.route('/auth/v1', authRoutes);

app.notFound(() => fail('Not found.', 404));
app.onError((err, _c) => {
  console.error(err);
  return fail('Community Resources is temporarily unavailable.', 500);
});

export default {
  fetch: app.fetch,

  // Replaces the Postgres community_purge_expired_security_data RPC: drop expired
  // admin-IP audit rows and stale rate-limit buckets. Scheduled via wrangler crons.
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const now = new Date().toISOString();
    const staleWindow = new Date(Date.now() - 86_400_000).toISOString();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM community_admin_ip_events WHERE expires_at <= ?').bind(now),
      env.DB.prepare('DELETE FROM community_rate_limits WHERE window_start < ?').bind(staleWindow),
    ]);
  },
} satisfies ExportedHandler<Env>;
