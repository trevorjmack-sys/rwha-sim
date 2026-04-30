// ── Server hooks ──────────────────────────────────────────────────────────────
// Runs on every server request.
// 1. Reads Cloudflare Access authenticated email from header.
// 2. Looks up the team in D1 and attaches user context to event.locals.
// In local Vite dev (no Cloudflare Access), VITE_DEV_EMAIL env var can be used
// to simulate a logged-in user.

import type { Handle } from '@sveltejs/kit';

/** Decode the email claim from a Cloudflare Access JWT without verifying the
 *  signature — CF Access has already verified it at the edge before the
 *  request reaches the Worker. */
function emailFromCfJwt(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    // atob needs standard base64; JWT uses base64url
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Cloudflare Access injects this header after authentication.
  const headerEmail = event.request.headers.get('cf-access-authenticated-user-email');

  // 2. Fallback: decode email from the CF Access JWT assertion header.
  const jwtHeader  = event.request.headers.get('cf-access-jwt-assertion');
  const jwtEmail   = jwtHeader ? emailFromCfJwt(jwtHeader) : null;

  // 3. Fallback: decode email from the CF_Authorization cookie (set by Access).
  const cookieHeader = event.request.headers.get('cookie') ?? '';
  const cfCookieToken = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('CF_Authorization='))
    ?.slice('CF_Authorization='.length);
  const cookieEmail = cfCookieToken ? emailFromCfJwt(cfCookieToken) : null;

  const email =
    headerEmail ??
    jwtEmail    ??
    cookieEmail ??
    // Dev override: set VITE_DEV_EMAIL in web/.env.local to simulate login
    (import.meta.env.VITE_DEV_EMAIL as string | undefined) ??
    null;

  if (email && event.platform?.env.DB) {
    try {
      const row = await event.platform.env.DB
        .prepare(`
          SELECT id, name, is_commissioner
          FROM teams
          WHERE gm_email = ?
          LIMIT 1
        `)
        .bind(email)
        .first<{ id: number; name: string; is_commissioner: number }>();

      if (row) {
        event.locals.user = {
          email,
          teamId:          row.id,
          teamName:        row.name,
          isCommissioner:  row.is_commissioner === 1,
        };
      } else {
        event.locals.user = null;
      }
    } catch {
      // D1 not bound in Vite dev mode — that's fine
      event.locals.user = null;
    }
  } else {
    event.locals.user = null;
  }

  return resolve(event);
};
