<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';
  export let data: PageData;

  $: teams     = data.teams;
  $: rivalries = data.rivalries;

  const teamById = (id: number) => teams.find(t => t.id === id)?.name ?? `#${id}`;

  const CONF_NAME: Record<number, string> = { 1: 'Honey', 2: 'Sturdy' };
  const DIVISIONS = ['Jofa', 'Titan', 'Cooper', 'CCM'];
  const DIV_CONF: Record<string, number> = { Jofa: 1, Titan: 1, Cooper: 2, CCM: 2 };

  // Group teams by conf → div
  $: grouped = (() => {
    const m = new Map<number, Map<string, typeof teams>>();
    m.set(1, new Map([['Jofa', []], ['Titan', []]]));
    m.set(2, new Map([['Cooper', []], ['CCM', []]]));
    for (const t of teams) m.get(t.conference)?.get(t.division)?.push(t);
    return m;
  })();

  // Rivalry form state
  let selA  = 0;
  let selB  = 0;
  let level = 3;
  let msg   = '';
  let divMsg = '';

  const rivalryLabels: Record<number, string> = {
    1: '⚡ Minor',
    2: '🔥 Moderate',
    3: '💢 Heated',
    4: '☠️  Intense',
    5: '🏒 Blood Feud',
  };
</script>

<svelte:head><title>Admin — Rivalries</title></svelte:head>

<div class="mb-6 flex items-center gap-4">
  <a href="/admin" class="text-rwha-muted hover:text-rwha-amber font-mono text-sm">← Admin</a>
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">
    Rivalries &amp; Divisions
  </h1>
</div>

<!-- ── Conference / Division Assignments ──────────────────────────────────── -->
<section class="card mb-6 p-4">
  <h2 class="font-mono font-semibold text-rwha-amber text-sm uppercase tracking-widest mb-1">
    Conference &amp; Division Assignments
  </h2>
  <p class="text-rwha-muted text-xs mb-4 font-mono">
    Schedule generator requires exactly 11 teams per conference.
    Moving a team between Jofa/Titan also moves it between conferences.
  </p>

  <div class="grid md:grid-cols-2 gap-6">
    {#each [1, 2] as conf}
      <div>
        <p class="font-mono text-sm font-bold text-rwha-amber uppercase tracking-widest mb-3">
          {CONF_NAME[conf]} Conference
          <span class="text-rwha-muted font-normal text-xs ml-1">
            ({teams.filter(t => t.conference === conf).length} teams)
          </span>
        </p>

        {#each (conf === 1 ? ['Jofa', 'Titan'] : ['Cooper', 'CCM']) as div}
          {@const divTeams = grouped.get(conf)?.get(div) ?? []}
          <div class="mb-4">
            <p class="font-mono text-xs text-rwha-muted uppercase tracking-widest mb-1">
              {div} Division ({divTeams.length})
            </p>
            {#each divTeams as team}
              <div class="flex items-center gap-2 py-1 border-b border-rwha-border/30">
                <span class="font-mono text-sm flex-1">{team.name}</span>
                <form method="POST" action="?/setDivision" use:enhance={() => {
                  return async ({ result, update }) => {
                    divMsg = result.type === 'success' ? 'Saved' : 'Error';
                    setTimeout(() => divMsg = '', 2500);
                    await update();
                  };
                }}>
                  <input type="hidden" name="team_id" value={team.id} />
                  <select name="division"
                    class="bg-rwha-surface border border-rwha-border rounded px-2 py-0.5 font-mono text-xs
                           text-rwha-text focus:border-rwha-amber outline-none"
                    on:change={(e) => e.currentTarget.form?.requestSubmit()}
                  >
                    {#each DIVISIONS as d}
                      <option value={d} selected={d === team.division}>
                        {d} ({CONF_NAME[DIV_CONF[d]!]})
                      </option>
                    {/each}
                  </select>
                </form>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/each}
  </div>
  {#if divMsg}
    <p class="text-rwha-green font-mono text-xs mt-2">{divMsg}</p>
  {/if}
</section>

<!-- ── Add / Update Rivalry ────────────────────────────────────────────────── -->
<section class="card mb-6 p-4">
  <h2 class="font-mono font-semibold text-rwha-amber text-sm uppercase tracking-widest mb-4">Set Rivalry</h2>
  <form method="POST" action="?/setRivalry" use:enhance={() => {
    return async ({ result, update }) => {
      msg = result.type === 'success' ? 'Rivalry saved!' : 'Error saving rivalry';
      setTimeout(() => msg = '', 3000);
      await update();
    };
  }} class="flex flex-wrap gap-3 items-end">
    <div class="flex flex-col gap-1">
      <label class="font-mono text-xs text-rwha-muted uppercase">Team A</label>
      <select name="team_a_id" bind:value={selA}
        class="bg-rwha-surface border border-rwha-border rounded px-3 py-1.5 font-mono text-sm text-rwha-text focus:border-rwha-amber outline-none">
        <option value={0} disabled>Select…</option>
        {#each teams as t}
          <option value={t.id}>{t.name}</option>
        {/each}
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <label class="font-mono text-xs text-rwha-muted uppercase">Team B</label>
      <select name="team_b_id" bind:value={selB}
        class="bg-rwha-surface border border-rwha-border rounded px-3 py-1.5 font-mono text-sm text-rwha-text focus:border-rwha-amber outline-none">
        <option value={0} disabled>Select…</option>
        {#each teams.filter(t => t.id !== selA) as t}
          <option value={t.id}>{t.name}</option>
        {/each}
      </select>
    </div>

    <div class="flex flex-col gap-1">
      <label class="font-mono text-xs text-rwha-muted uppercase">Level (1–5)</label>
      <select name="level" bind:value={level}
        class="bg-rwha-surface border border-rwha-border rounded px-3 py-1.5 font-mono text-sm text-rwha-text focus:border-rwha-amber outline-none">
        {#each [1, 2, 3, 4, 5] as l}
          <option value={l}>{l} — {rivalryLabels[l]}</option>
        {/each}
      </select>
    </div>

    <button type="submit"
      class="btn-primary font-mono text-sm px-4 py-1.5 rounded">
      Save Rivalry
    </button>
  </form>
  {#if msg}
    <p class="text-rwha-green font-mono text-xs mt-2">{msg}</p>
  {/if}
</section>

<!-- ── Current Rivalries ───────────────────────────────────────────────────── -->
<section class="card p-4">
  <h2 class="font-mono font-semibold text-rwha-amber text-sm uppercase tracking-widest mb-4">Active Rivalries</h2>

  {#if rivalries.length === 0}
    <p class="text-rwha-muted font-mono text-sm">No rivalries set yet.</p>
  {:else}
    <table class="stat-table w-full">
      <thead>
        <tr class="border-b border-rwha-border">
          <th class="text-left py-2 text-rwha-muted text-xs font-mono uppercase tracking-widest">Teams</th>
          <th class="text-left py-2 text-rwha-muted text-xs font-mono uppercase tracking-widest">Level</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each rivalries as r}
          <tr class="border-b border-rwha-border/40">
            <td class="py-2 font-mono text-sm">
              {teamById(r.team_a_id)} <span class="text-rwha-muted mx-1">vs</span> {teamById(r.team_b_id)}
            </td>
            <td class="font-mono text-sm text-rwha-amber">{r.level} — {rivalryLabels[r.level]}</td>
            <td class="text-right pr-2">
              <form method="POST" action="?/removeRivalry" use:enhance>
                <input type="hidden" name="rivalry_id" value={r.id} />
                <button class="text-xs font-mono text-rwha-red hover:text-red-400">Remove</button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>
