import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getTeamPlayers, getTeamLines, updateTeamLines } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals, platform }) => {
  const db = platform?.env.DB;
  if (!db) return { players: [], linesRow: null };

  const [players, linesRow] = await Promise.all([
    getTeamPlayers(db, locals.user!.teamId),
    getTeamLines(db, locals.user!.teamId),
  ]);

  // Parse stored lines json if present
  let storedLines: {
    forwards: [number, number, number][];
    defense:  [number, number][];
    starter_id: number;
    backup_id:  number;
  } | null = null;

  if (linesRow?.lines_json) {
    try { storedLines = JSON.parse(linesRow.lines_json); } catch { /* ignore */ }
  }

  return {
    players,
    useComputer: linesRow ? linesRow.use_computer_lines === 1 : true,
    storedLines,
  };
};

export const actions: Actions = {
  // Toggle computer lines on/off — saves and clears manual lines
  setComputer: async ({ request, locals, platform }) => {
    const db = platform?.env.DB;
    if (!db) return fail(503, { error: 'DB unavailable' });

    const fd  = await request.formData();
    const val = fd.get('useComputer') === '1';
    await updateTeamLines(db, locals.user!.teamId, val, null);
    return { ok: true };
  },

  // Save manual lines
  saveLines: async ({ request, locals, platform }) => {
    const db = platform?.env.DB;
    if (!db) return fail(503, { error: 'DB unavailable' });

    const fd = await request.formData();

    const parseId = (key: string) => parseInt(String(fd.get(key) ?? ''), 10);

    const forwards: [number, number, number][] = [
      [parseId('f1_lw'), parseId('f1_c'), parseId('f1_rw')],
      [parseId('f2_lw'), parseId('f2_c'), parseId('f2_rw')],
      [parseId('f3_lw'), parseId('f3_c'), parseId('f3_rw')],
      [parseId('f4_lw'), parseId('f4_c'), parseId('f4_rw')],
    ];
    const defense: [number, number][] = [
      [parseId('d1_ld'), parseId('d1_rd')],
      [parseId('d2_ld'), parseId('d2_rd')],
      [parseId('d3_ld'), parseId('d3_rd')],
    ];
    const starter_id = parseId('starter');
    const backup_id  = parseId('backup');

    // Basic validation — all IDs must be valid numbers
    const allIds = [...forwards.flat(), ...defense.flat(), starter_id, backup_id];
    if (allIds.some(isNaN)) return fail(400, { error: 'All line slots must be filled' });

    // No player can appear twice
    const skaterIds = [...forwards.flat(), ...defense.flat()];
    if (new Set(skaterIds).size !== skaterIds.length) {
      return fail(400, { error: 'A player cannot appear on more than one line' });
    }
    if (starter_id === backup_id) {
      return fail(400, { error: 'Starter and backup must be different goalies' });
    }

    const linesJson = JSON.stringify({ forwards, defense, starter_id, backup_id });
    await updateTeamLines(db, locals.user!.teamId, false, linesJson);
    return { ok: true };
  },
};
