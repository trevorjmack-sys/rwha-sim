// ── Server hooks ──────────────────────────────────────────────────────────────
// Runs on every server request.
// 1. Reads Cloudflare Access authenticated email from header.
// 2. Looks up the team in D1 and attaches user context to event.locals.
// In local Vite dev (no Cloudflare Access), VITE_DEV_EMAIL env var can be used
// to simulate a logged-in user.

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Cloudflare Access injects this header on authenticated requests.
  // In production, Access is configured on /gm/* and /admin/*.
  const email =
    event.request.headers.get('cf-access-authenticated-user-email') ??
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
