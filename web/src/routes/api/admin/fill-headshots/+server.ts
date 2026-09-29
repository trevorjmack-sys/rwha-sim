// POST /api/admin/fill-headshots
// Auth: commissioner only
//
// Looks up NHL ids (for roster headshots) for players who don't have one yet.
// Each call does a limited number of lookups; the admin page calls it until
// `remaining` reaches 0.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fillNhlIds } from '$lib/server/rwha-sync';

export const POST: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user?.isCommissioner) throw error(403, 'Commissioner access required');
  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');
  try {
    return json({ ok: true, ...(await fillNhlIds(db, 45)) });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
};
