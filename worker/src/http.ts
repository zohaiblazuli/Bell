// Shared HTTP helpers. Mirrors community-public/index.ts: JSON responses are
// always no-store, and errors use the { error } shape the Rust client parses
// (see json_response in src-tauri/src/community.rs).
export const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
} as const;

export const reply = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

export const fail = (message: string, status = 400): Response =>
  reply({ error: message }, status);

// The same precedence Supabase used: Cloudflare's own header first.
export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
