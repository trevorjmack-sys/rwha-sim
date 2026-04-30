import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getTeamPlayers, updateScratch } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform }) => {
  const db = platform?.env.DB;
  if (!db) return { players: [] };

  const players = await getTeamPlayers(db, locals.user!.teamId);
  return { players };
};

export const actions: Actions = {
  scratch: async ({ request, locals, platform }) => {
    const db = platform?.env.DB;
    if (!db) return fail(503, { error: 'DB unavailable' });

    const data   = await request.formData();
    const idStr  = data.get('playerId');
    const val    = data.get('scratch');
    const id     = parseInt(String(idStr), 10);

    if (isNaN(id)) return fail(400, { error: 'Bad player id' });

    await updateScratch(db, id, locals.user!.teamId, val === '1');
    return { ok: true };
  },
};
