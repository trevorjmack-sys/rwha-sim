// POST /api/admin/sync-rosters
// Auth: commissioner only
//
// Pulls current rosters from rwha.net and applies them in place (see
// $lib/server/rwha-sync.ts). Games, stats and lines are kept.

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncRosters } from '$lib/server/rwha-sync';

export const POST: RequestHandler = async ({ locals, platform }) => {
  if (!locals.user?.isCommissioner) throw error(403, 'Commissioner access required');

  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database not available');

  try {
    const summary = await syncRosters(db);
    return json({ ok: true, summary, syncedAt: Date.now() });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
};
