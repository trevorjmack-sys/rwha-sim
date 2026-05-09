<script lang="ts">
  import { page } from '$app/stores';
  import type { PageData } from './$types';
  export let data: PageData;

  $: ({ team, games, record, roster, teamStats, skaterStats, goalieStats } = data);

  // ── Conference / division names ───────────────────────────────────────────
  const CONF_NAME: Record<number, string> = { 1: 'Honey', 2: 'Sturdy' };

  // ── Tab state (default: roster) ───────────────────────────────────────────
  type Tab = 'roster' | 'players' | 'stats' | 'schedule';
  let tab: Tab = ($page.url.searchParams.get('tab') as Tab) ?? 'roster';

  // ── Player-stats helpers ──────────────────────────────────────────────────
  function fmtPlusMinus(n: number) {
    if (n > 0) return `+${n}`;
    return String(n);
  }
  function fmtSvPct(v: number) {
    // 0.912 → ".912"
    return v === 0 ? '—' : v.toFixed(3).replace(/^0/, '');
  }

  // ── Roster helpers ────────────────────────────────────────────────────────
  function hasPos(pos: string, check: string) {
    return pos.split('/').includes(check);
  }
  function x(pos: string, check: string) {
    return hasPos(pos, check) ? 'X' : '';
  }
  function fmtCon(inj: number) {
    return inj > 0 ? (100 - inj * 5).toFixed(2) : '100.00';
  }
  function a(attrs: Record<string, number>, key: string) {
    return attrs[key] ?? '—';
  }

  const SKATER_COLS = ['ck','fg','di','sk','st','en','du','ph','fo','pa','sc','df','ps','ex','ld'] as const;
  const GOALIE_COLS = ['sk','du','en','sz','ag','rb','sc','hs','rt','ph','ps','ex','ld'] as const;

  // ── Schedule helpers ──────────────────────────────────────────────────────
  function outcome(g: typeof games[0]): 'W' | 'L' | 'OT' | null {
    if (g.status !== 'complete') return null;
    const tf = g.team_goals ?? 0;
    const of_ = g.opp_goals ?? 0;
    if (tf > of_) return 'W';
    if (g.final_label === 'FINAL') return 'L';
    return 'OT';
  }
  function outcomeClass(o: 'W' | 'L' | 'OT' | null) {
    if (o === 'W')  return 'text-rwha-green font-bold';
    if (o === 'L')  return 'text-rwha-red';
    if (o === 'OT') return 'text-rwha-amber';
    return 'text-rwha-muted';
  }

  $: nextGame = games.find(g => g.status !== 'complete');
</script>

<svelte:head><title>{team.name} — RWHA Sim</title></svelte:head>

<!-- ── Team header ────────────────────────────────────────────────────────────── -->
<div class="mb-5">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 class="font-mono font-bold text-rwha-amber text-2xl tracking-wider uppercase">
        {team.name}
      </h1>
      <div class="font-mono text-xs text-rwha-muted mt-1 flex gap-3 flex-wrap">
        <span>GM: <span class="text-rwha-text">{team.gm_name}</span></span>
        {#if team.farm_name}
          <span class="text-rwha-border">|</span>
          <span>Farm: <span class="text-rwha-text">{team.farm_name}</span></span>
        {/if}
      </div>
      {#if team.conference != null}
        <div class="font-mono text-xs text-rwha-muted/60 mt-0.5">
          {CONF_NAME[team.conference] ?? `Conf ${team.conference}`} Conference
          {#if team.division}· {team.division} Division{/if}
        </div>
      {/if}
    </div>

    <!-- Record pill -->
    {#if record.gp > 0}
      <div class="card px-4 py-2 flex items-center gap-4 font-mono text-sm">
        <div>
          <div class="text-rwha-muted text-xs mb-0.5">Record</div>
          <div class="font-bold">
            <span class="text-rwha-green">{record.w}</span>
            <span class="text-rwha-muted mx-1">–</span>
            <span class="text-rwha-red">{record.l}</span>
            <span class="text-rwha-muted mx-1">–</span>
            <span class="text-rwha-amber">{record.otl}</span>
          </div>
        </div>
        <div>
          <div class="text-rwha-muted text-xs mb-0.5">PTS</div>
          <div class="font-bold text-rwha-amber text-lg">{record.pts}</div>
        </div>
        <div>
          <div class="text-rwha-muted text-xs mb-0.5">GF–GA</div>
          <div class="font-bold">
            <span class="{record.gf >= record.ga ? 'text-rwha-green' : 'text-rwha-red'}">{record.gf}</span>
            <span class="text-rwha-muted mx-0.5">–</span>
            <span class="text-rwha-muted">{record.ga}</span>
          </div>
        </div>
      </div>
    {:else}
      <div class="font-mono text-xs text-rwha-muted/60 mt-2">No games played yet.</div>
    {/if}
  </div>

  {#if nextGame}
    <div class="mt-2 font-mono text-xs text-rwha-muted">
      Next: <span class="text-rwha-text font-semibold">
        Week {nextGame.week} — {nextGame.is_home ? 'vs' : '@'} {nextGame.opponent_name}
      </span>
    </div>
  {:else if record.gp > 0}
    <div class="mt-2 font-mono text-xs text-rwha-muted">Season complete.</div>
  {/if}
</div>

<!-- ── Tab bar ─────────────────────────────────────────────────────────────────── -->
<div class="flex flex-wrap gap-1 font-mono text-sm mb-5">
  {#each ([
    ['roster',   'Roster'],
    ['players',  'Player Stats'],
    ['stats',    'Team Stats'],
    ['schedule', 'Schedule'],
  ] as [Tab, string][]) as [t, label]}
    <button
      class="px-4 py-1.5 rounded border transition-colors
             {tab === t
               ? 'border-rwha-amber bg-rwha-amber/10 text-rwha-amber'
               : 'border-rwha-border text-rwha-muted hover:border-rwha-amber/40'}"
      on:click={() => tab = t}
    >{label}</button>
  {/each}
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- ROSTER TAB                                                                  -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
{#if tab === 'roster'}

  <!-- ── Pro Roster ──────────────────────────────────────────────────────────── -->
  <div class="section-header">Pro Roster</div>
  <div class="card mb-3 overflow-x-auto">
    <table class="stat-table text-xs whitespace-nowrap">
      <thead>
        <tr class="border-b border-rwha-border">
          <th class="text-left pl-3 sticky left-0 bg-rwha-surface w-6">#</th>
          <th class="text-left pl-2 sticky left-6 bg-rwha-surface min-w-[140px]">Player</th>
          <th class="w-5">C</th>
          <th class="w-5">L</th>
          <th class="w-5">R</th>
          <th class="w-5">D</th>
          <th>CON</th>
          <th>IJ</th>
          {#each SKATER_COLS as col}
            <th class="uppercase">{col}</th>
          {/each}
          <th class="pr-3 text-rwha-amber">OV</th>
        </tr>
      </thead>
      <tbody>
        {#each roster.proSkaters as p, i}
          <tr class="{p.injured_games_remaining > 0 ? 'bg-rwha-red/5' : ''}">
            <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">{i + 1}</td>
            <td class="text-left pl-2 sticky left-6 bg-rwha-surface font-semibold text-rwha-text">
              {#if (p as any).is_personal}
                <span class="text-rwha-amber" title="Personal player">★</span>{' '}
              {/if}
              {p.name}
              {#if p.injured_games_remaining > 0}
                <span class="text-rwha-red ml-1 font-normal">(INJ)</span>
              {/if}
            </td>
            <td class="text-rwha-amber font-bold">{x(p.position, 'C')}</td>
            <td class="text-rwha-amber font-bold">{x(p.position, 'L')}</td>
            <td class="text-rwha-amber font-bold">{x(p.position, 'R')}</td>
            <td class="text-rwha-amber font-bold">{x(p.position, 'D')}</td>
            <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
            <td class="{p.injured_games_remaining > 0 ? 'text-rwha-red font-bold' : 'text-rwha-muted'}">
              {p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}
            </td>
            {#each SKATER_COLS as col}
              <td class="{(p.attrs[col] ?? 0) >= 90 ? 'text-rwha-amber font-bold' : (p.attrs[col] ?? 0) >= 80 ? 'text-rwha-text' : 'text-rwha-muted'}">
                {a(p.attrs, col)}
              </td>
            {/each}
            <td class="pr-3 text-rwha-amber font-bold">{p.ov}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Pro Goalies -->
  {#if roster.proGoalies.length > 0}
    <div class="card mb-4 overflow-x-auto">
      <table class="stat-table text-xs whitespace-nowrap">
        <thead>
          <tr class="border-b border-rwha-border">
            <th class="text-left pl-3 sticky left-0 bg-rwha-surface w-5">PO</th>
            <th class="text-left pl-2 sticky left-5 bg-rwha-surface min-w-[140px]">Goalie</th>
            <th>CON</th>
            <th>IJ</th>
            {#each GOALIE_COLS as col}
              <th class="uppercase">{col}</th>
            {/each}
            <th class="pr-3 text-rwha-amber">OV</th>
          </tr>
        </thead>
        <tbody>
          {#each roster.proGoalies as p}
            <tr class="{p.injured_games_remaining > 0 ? 'bg-rwha-red/5' : ''}">
              <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">G</td>
              <td class="text-left pl-2 sticky left-5 bg-rwha-surface font-semibold text-rwha-text">
                {p.name}
                {#if p.injured_games_remaining > 0}
                  <span class="text-rwha-red ml-1 font-normal">(INJ)</span>
                {/if}
              </td>
              <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
              <td class="{p.injured_games_remaining > 0 ? 'text-rwha-red font-bold' : 'text-rwha-muted'}">
                {p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}
              </td>
              {#each GOALIE_COLS as col}
                <td class="{(p.attrs[col] ?? 0) >= 90 ? 'text-rwha-amber font-bold' : (p.attrs[col] ?? 0) >= 80 ? 'text-rwha-text' : 'text-rwha-muted'}">
                  {a(p.attrs, col)}
                </td>
              {/each}
              <td class="pr-3 text-rwha-amber font-bold">{p.ov}</td>
              </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- ── Farm Roster (collapsible) ───────────────────────────────────────────── -->
  {#if roster.farmSkaters.length > 0 || roster.farmGoalies.length > 0}
    <details class="mb-4">
      <summary class="section-header cursor-pointer select-none hover:text-rwha-amber/80 transition-colors mb-2">
        Farm — {team.farm_name ?? 'Farm Team'} ▸
      </summary>

      <div class="card mb-3 overflow-x-auto">
        <table class="stat-table text-xs whitespace-nowrap">
          <thead>
            <tr class="border-b border-rwha-border">
              <th class="text-left pl-3 sticky left-0 bg-rwha-surface w-6">#</th>
              <th class="text-left pl-2 sticky left-6 bg-rwha-surface min-w-[140px]">Player</th>
              <th class="w-5">C</th><th class="w-5">L</th><th class="w-5">R</th><th class="w-5">D</th>
              <th>CON</th><th>IJ</th>
              {#each SKATER_COLS as col}<th class="uppercase">{col}</th>{/each}
              <th class="text-rwha-amber">OV</th>
              <th class="pr-3">Age</th>
            </tr>
          </thead>
          <tbody>
            {#each roster.farmSkaters as p, i}
              <tr>
                <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">{i + 1}</td>
                <td class="text-left pl-2 sticky left-6 bg-rwha-surface text-rwha-muted">{p.name}</td>
                <td class="text-rwha-muted">{x(p.position, 'C')}</td>
                <td class="text-rwha-muted">{x(p.position, 'L')}</td>
                <td class="text-rwha-muted">{x(p.position, 'R')}</td>
                <td class="text-rwha-muted">{x(p.position, 'D')}</td>
                <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
                <td class="text-rwha-muted">{p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}</td>
                {#each SKATER_COLS as col}
                  <td class="text-rwha-muted/70">{a(p.attrs, col)}</td>
                {/each}
                <td class="pr-3 text-rwha-amber/60 font-bold">{p.ov}</td>
                  </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if roster.farmGoalies.length > 0}
        <div class="card mb-3 overflow-x-auto">
          <table class="stat-table text-xs whitespace-nowrap">
            <thead>
              <tr class="border-b border-rwha-border">
                <th class="text-left pl-3 sticky left-0 bg-rwha-surface w-5">PO</th>
                <th class="text-left pl-2 sticky left-5 bg-rwha-surface min-w-[140px]">Goalie</th>
                <th>CON</th><th>IJ</th>
                {#each GOALIE_COLS as col}<th class="uppercase">{col}</th>{/each}
                <th class="text-rwha-amber">OV</th>
                <th class="pr-3">Age</th>
              </tr>
            </thead>
            <tbody>
              {#each roster.farmGoalies as p}
                <tr>
                  <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">G</td>
                  <td class="text-left pl-2 sticky left-5 bg-rwha-surface text-rwha-muted">{p.name}</td>
                  <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
                  <td class="text-rwha-muted">{p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}</td>
                  {#each GOALIE_COLS as col}
                    <td class="text-rwha-muted/70">{a(p.attrs, col)}</td>
                  {/each}
                  <td class="pr-3 text-rwha-amber/60 font-bold">{p.ov}</td>
                      </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </details>
  {/if}

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- PLAYER STATS TAB                                                            -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
{:else if tab === 'players'}

  {#if skaterStats.length === 0 && goalieStats.length === 0}
    <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
      No games played yet — check back after the first week.
    </div>
  {:else}

    <!-- Skaters -->
    {#if skaterStats.length > 0}
      <div class="section-header">Skaters</div>
      <div class="card mb-4 overflow-x-auto">
        <table class="stat-table text-xs whitespace-nowrap">
          <thead>
            <tr class="border-b border-rwha-border">
              <th class="text-left pl-3 sticky left-0 bg-rwha-surface w-6">#</th>
              <th class="text-left pl-2 sticky left-6 bg-rwha-surface min-w-[140px]">Player</th>
              <th class="text-left">Pos</th>
              <th>GP</th>
              <th class="text-rwha-amber">G</th>
              <th class="text-rwha-amber">A</th>
              <th class="text-rwha-amber">PTS</th>
              <th>+/–</th>
              <th>SOG</th>
              <th>Hits</th>
              <th>Blk</th>
              <th class="pr-3">PIM</th>
            </tr>
          </thead>
          <tbody>
            {#each skaterStats as p, i}
              <tr>
                <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">{i + 1}</td>
                <td class="text-left pl-2 sticky left-6 bg-rwha-surface font-semibold text-rwha-text">{p.name}</td>
                <td class="text-rwha-muted font-mono">{p.position}</td>
                <td class="text-rwha-muted">{p.gp}</td>
                <td class="text-rwha-amber font-bold">{p.g}</td>
                <td class="text-rwha-amber font-bold">{p.a}</td>
                <td class="text-rwha-amber font-bold">{p.pts}</td>
                <td class="{p.plus_minus > 0 ? 'text-rwha-green' : p.plus_minus < 0 ? 'text-rwha-red' : 'text-rwha-muted'} font-mono">
                  {fmtPlusMinus(p.plus_minus)}
                </td>
                <td class="text-rwha-muted">{p.sog}</td>
                <td class="text-rwha-muted">{p.hits}</td>
                <td class="text-rwha-muted">{p.blocks}</td>
                <td class="pr-3 text-rwha-muted">{p.pim}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- Goalies -->
    {#if goalieStats.length > 0}
      <div class="section-header">Goalies</div>
      <div class="card overflow-x-auto">
        <table class="stat-table text-xs whitespace-nowrap">
          <thead>
            <tr class="border-b border-rwha-border">
              <th class="text-left pl-3 sticky left-0 bg-rwha-surface min-w-[140px]">Goalie</th>
              <th>GP</th>
              <th class="text-rwha-green">W</th>
              <th class="text-rwha-red">L</th>
              <th class="text-rwha-amber">OT</th>
              <th>SA</th>
              <th>GA</th>
              <th class="text-rwha-amber">SV%</th>
              <th class="pr-3 text-rwha-amber">GAA</th>
            </tr>
          </thead>
          <tbody>
            {#each goalieStats as g}
              <tr>
                <td class="pl-3 sticky left-0 bg-rwha-surface font-semibold text-rwha-text">{g.name}</td>
                <td class="text-rwha-muted">{g.gp}</td>
                <td class="text-rwha-green font-bold">{g.w}</td>
                <td class="text-rwha-red">{g.l}</td>
                <td class="text-rwha-amber">{g.otl}</td>
                <td class="text-rwha-muted">{g.sa}</td>
                <td class="text-rwha-muted">{g.ga}</td>
                <td class="text-rwha-amber font-bold">{fmtSvPct(g.svPct)}</td>
                <td class="pr-3 text-rwha-amber font-bold">{g.gaa}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

  {/if}

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- STATS TAB                                                                   -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
{:else if tab === 'stats'}

  {#if teamStats.gp === 0}
    <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
      No games played yet — check back after the first week.
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

      <!-- Scoring -->
      <div class="card px-4 py-4">
        <div class="section-header mb-3">Scoring</div>
        <div class="space-y-2">
          {#each [
            ['Goals For',  teamStats.gf, `${teamStats.gfPg}/gm`],
            ['Goals Against', teamStats.ga, `${teamStats.gaPg}/gm`],
            ['Goal Diff', teamStats.gf - teamStats.ga, null],
          ] as [label, val, sub]}
            <div class="flex items-center justify-between font-mono text-sm">
              <span class="text-rwha-muted">{label}</span>
              <span class="font-bold
                {label === 'Goals For' ? 'text-rwha-green'
                  : label === 'Goals Against' ? 'text-rwha-red'
                  : (teamStats.gf - teamStats.ga) > 0 ? 'text-rwha-green'
                  : (teamStats.gf - teamStats.ga) < 0 ? 'text-rwha-red'
                  : 'text-rwha-muted'}">
                {label === 'Goal Diff' && (teamStats.gf - teamStats.ga) > 0 ? '+' : ''}{val}
                {#if sub}<span class="text-rwha-muted font-normal text-xs ml-1">({sub})</span>{/if}
              </span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Shots -->
      <div class="card px-4 py-4">
        <div class="section-header mb-3">Shots on Goal</div>
        <div class="space-y-2">
          {#each [
            ['SOG For',     teamStats.sog,  `${teamStats.sogPg}/gm`],
            ['SOG Against', teamStats.sogA, `${teamStats.sogAPg}/gm`],
            ['Shot Diff', teamStats.sog - teamStats.sogA, null],
          ] as [label, val, sub]}
            <div class="flex items-center justify-between font-mono text-sm">
              <span class="text-rwha-muted">{label}</span>
              <span class="font-bold text-rwha-text">
                {label === 'Shot Diff' && (teamStats.sog - teamStats.sogA) > 0 ? '+' : ''}{val}
                {#if sub}<span class="text-rwha-muted font-normal text-xs ml-1">({sub})</span>{/if}
              </span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Special Teams -->
      <div class="card px-4 py-4">
        <div class="section-header mb-3">Special Teams</div>
        <div class="space-y-2">
          {#each [
            ['Power Play',   `${teamStats.ppGoals}/${teamStats.ppOpps}`, `${teamStats.ppPct}%`],
            ['Penalty Kill', `${teamStats.pkOpps - teamStats.pkGoalsA}/${teamStats.pkOpps}`, `${teamStats.pkPct}%`],
          ] as [label, record, pct]}
            <div class="flex items-center justify-between font-mono text-sm">
              <span class="text-rwha-muted">{label}</span>
              <span class="font-bold text-rwha-amber">
                {pct}
                <span class="text-rwha-muted font-normal text-xs ml-1">({record})</span>
              </span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Other -->
      <div class="card px-4 py-4">
        <div class="section-header mb-3">Per Game</div>
        <div class="space-y-2">
          {#each [
            ['Face-off %',  `${teamStats.foPct}%`],
            ['Hits',        teamStats.hitsPg],
            ['Blocks',      teamStats.blocksPg],
            ['PIM',         teamStats.pimPg],
          ] as [label, val]}
            <div class="flex items-center justify-between font-mono text-sm">
              <span class="text-rwha-muted">{label}</span>
              <span class="font-bold text-rwha-text">{val}</span>
            </div>
          {/each}
        </div>
      </div>

    </div>
  {/if}

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- SCHEDULE TAB                                                                -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
{:else}
  <div class="section-header">Season Schedule</div>
  <div class="card overflow-x-auto">
    <table class="stat-table w-full text-sm">
      <thead>
        <tr class="border-b border-rwha-border">
          <th class="text-left pl-4 w-10">Wk</th>
          <th class="w-8 text-rwha-muted font-normal">H/A</th>
          <th class="text-left">Opponent</th>
          <th class="w-16 text-center">Score</th>
          <th class="w-10 text-center">OT</th>
          <th class="w-8 text-center">W/L</th>
          <th class="w-14 pr-4"></th>
        </tr>
      </thead>
      <tbody>
        {#each games as g (g.id)}
          {@const o = outcome(g)}
          <tr class="{g.status !== 'complete' ? 'opacity-50' : ''}
                     {o === 'W' ? 'bg-rwha-green/3' : o === 'L' ? 'bg-rwha-red/3' : ''}">
            <td class="pl-4 text-rwha-muted font-mono text-xs">{g.week}</td>
            <td class="text-center font-mono text-xs {g.is_home ? 'text-rwha-muted' : 'text-rwha-amber/70'}">
              {g.is_home ? 'vs' : '@'}
            </td>
            <td class="font-semibold">
              <a href="/teams/{g.opponent_name.toLowerCase()}"
                 class="hover:text-rwha-amber transition-colors">
                {g.opponent_name}
              </a>
            </td>
            <td class="text-center font-mono">
              {#if o}
                <span class="{o === 'W' ? 'text-rwha-green font-bold' : 'text-rwha-muted'}">{g.team_goals}</span>
                <span class="text-rwha-border mx-0.5">–</span>
                <span class="{o === 'L' || o === 'OT' ? 'text-rwha-muted font-bold' : 'text-rwha-muted'}">{g.opp_goals}</span>
              {:else}
                <span class="text-rwha-border text-xs">TBD</span>
              {/if}
            </td>
            <td class="text-center font-mono text-xs text-rwha-amber">
              {#if g.final_label && g.final_label !== 'FINAL' && o}
                {g.final_label}
              {/if}
            </td>
            <td class="text-center font-mono text-xs font-bold {outcomeClass(o)}">{o ?? ''}</td>
            <td class="pr-4 text-right">
              {#if g.status === 'complete'}
                <a href="/games/{g.id}"
                   class="font-mono text-xs text-rwha-amber/60 hover:text-rwha-amber transition-colors">
                  Box →
                </a>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
