import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getTeamPlayers, getTeamLines, updateTeamLines } from '$lib/server/db';
import { buildTeam } from '$lib/server/sim-bridge';
import { generateLines } from '$engine/lines';

export const load: PageServerLoad = async ({ locals, platform }) => {
  const db = platform?.env.DB;
  if (!db) return { players: [], linesRow: null };

  const teamMeta = await db
    .prepare('SELECT name, gm_name FROM teams WHERE id = ?')
    .bind(locals.user!.teamId)
    .first<{ name: string; gm_name: string }>();

  const [players, linesRow] = await Promise.all([
    getTeamPlayers(db, locals.user!.teamId),
    getTeamLines(db, locals.user!.teamId),
  ]);

  // Parse stored lines json if present
  type LinesJson = {
    forwards:   [number, number, number][];
    defense:    [number, number][];
    starter_id: number;
    backup_id:  number;
    pp?:        [number, number, number, number, number][];
    pk?:        [number, number, number, number][];
    pk3on5?:    [number, number, number];
  };

  let storedLines: LinesJson | null = null;
  if (linesRow?.lines_json) {
    try { storedLines = JSON.parse(linesRow.lines_json); } catch { /* ignore */ }
  }

  // Always generate computer lines so we can display them as a starting point
  let computerLines: LinesJson | null = null;
  try {
    const team = buildTeam(teamMeta?.name ?? '', teamMeta?.gm_name ?? '', players);
    const auto = generateLines(team);
    const byName = new Map(players.map(p => [p.name, p.id]));
    const id = (name: string) => byName.get(name) ?? 0;

    computerLines = {
      forwards: auto.forwards.map(f => [id(f.lw.name), id(f.c.name), id(f.rw.name)]) as [number,number,number][],
      defense:  auto.defense.map(d => [id(d.ld.name), id(d.rd.name)]) as [number,number][],
      starter_id: id(auto.starter.name),
      backup_id:  id(auto.backup.name),
      pp: auto.pp?.map(u => [id(u.lw.name), id(u.c.name), id(u.rw.name), id(u.ld.name), id(u.rd.name)]) as [number,number,number,number,number][],
      pk: auto.pk?.map(u => [id(u.lf.name), id(u.rf.name), id(u.ld.name), id(u.rd.name)]) as [number,number,number,number][],
      pk3on5: [0, 0, 0],
    };
  } catch { /* fall through — computerLines stays null */ }

  return {
    players,
    useComputer: linesRow ? linesRow.use_computer_lines === 1 : true,
    storedLines,
    computerLines,
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

    // PP units: [lw, c, rw, ld, rd]
    const pp: [number, number, number, number, number][] = [
      [parseId('pp1_lw'), parseId('pp1_c'), parseId('pp1_rw'), parseId('pp1_ld'), parseId('pp1_rd')],
      [parseId('pp2_lw'), parseId('pp2_c'), parseId('pp2_rw'), parseId('pp2_ld'), parseId('pp2_rd')],
    ];
    // PK 4-on-5 units: [lf, rf, ld, rd]
    const pk: [number, number, number, number][] = [
      [parseId('pk1_lf'), parseId('pk1_rf'), parseId('pk1_ld'), parseId('pk1_rd')],
      [parseId('pk2_lf'), parseId('pk2_rf'), parseId('pk2_ld'), parseId('pk2_rd')],
    ];
    // PK 3-on-5: [f1, f2, d]
    const pk3on5: [number, number, number] = [
      parseId('pk3_f1'), parseId('pk3_f2'), parseId('pk3_d'),
    ];

    // Validate even-strength lines — all slots filled
    const esIds = [...forwards.flat(), ...defense.flat(), starter_id, backup_id];
    if (esIds.some(isNaN)) return fail(400, { error: 'All even-strength line slots must be filled' });

    // Duplicate skaters across even-strength lines are allowed (double-shifting)
    if (starter_id === backup_id) {
      return fail(400, { error: 'Starter and backup must be different goalies' });
    }

    // Validate PP/PK units — only check for duplicates within each unit
    for (let i = 0; i < pp.length; i++) {
      if (pp[i]!.some(isNaN)) return fail(400, { error: `PP${i + 1} unit has empty slots` });
      if (new Set(pp[i]).size !== pp[i]!.length) return fail(400, { error: `PP${i + 1} unit has duplicate players` });
    }
    for (let i = 0; i < pk.length; i++) {
      if (pk[i]!.some(isNaN)) return fail(400, { error: `PK${i + 1} unit has empty slots` });
      if (new Set(pk[i]).size !== pk[i]!.length) return fail(400, { error: `PK${i + 1} unit has duplicate players` });
    }
    if (pk3on5.some(isNaN)) return fail(400, { error: '3-on-5 PK unit has empty slots' });
    if (new Set(pk3on5).size !== pk3on5.length) return fail(400, { error: '3-on-5 PK unit has duplicate players' });

    const linesJson = JSON.stringify({ forwards, defense, starter_id, backup_id, pp, pk, pk3on5 });
    await updateTeamLines(db, locals.user!.teamId, false, linesJson);
    return { ok: true };
  },
};
