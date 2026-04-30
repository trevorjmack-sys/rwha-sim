<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  const { team, games, record } = data;

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

  // Next upcoming game
  $: nextGame = games.find(g => g.status !== 'complete');
</script>

<svelte:head><title>{team.name} — RWHA Sim</title></svelte:head>

<!-- ── Team header ────────────────────────────────────────────────────────────── -->
<div class="mb-6">
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
    </div>
    <a href="/rosters#{team.name.toLowerCase()}"
       class="text-xs font-mono text-rwha-muted border border-rwha-border px-3 py-1.5 rounded
              hover:border-rwha-amber/50 hover:text-rwha-amber transition-colors">
      View Roster ↗
    </a>
  </div>

  <!-- Record bar -->
  {#if record.gp > 0}
    <div class="mt-4 card px-4 py-3 flex items-center gap-6 flex-wrap font-mono text-sm">
      <div>
        <span class="text-rwha-muted text-xs">Record</span>
        <div class="font-bold text-rwha-text mt-0.5">
          <span class="text-rwha-green">{record.w}</span>
          <span class="text-rwha-muted mx-1">–</span>
          <span class="text-rwha-red">{record.l}</span>
          <span class="text-rwha-muted mx-1">–</span>
          <span class="text-rwha-amber">{record.otl}</span>
        </div>
      </div>
      <div>
        <span class="text-rwha-muted text-xs">Points</span>
        <div class="font-bold text-rwha-amber text-lg mt-0.5">{record.pts}</div>
      </div>
      <div>
        <span class="text-rwha-muted text-xs">GP</span>
        <div class="font-bold text-rwha-text mt-0.5">{record.gp}</div>
      </div>
      <div>
        <span class="text-rwha-muted text-xs">GF – GA</span>
        <div class="font-bold mt-0.5">
          <span class="{record.gf >= record.ga ? 'text-rwha-green' : 'text-rwha-red'}">{record.gf}</span>
          <span class="text-rwha-muted mx-1">–</span>
          <span class="{record.ga > record.gf ? 'text-rwha-red' : 'text-rwha-muted'}">{record.ga}</span>
        </div>
      </div>
      <div>
        <span class="text-rwha-muted text-xs">Diff</span>
        <div class="font-bold mt-0.5 {record.gf - record.ga > 0 ? 'text-rwha-green' : record.gf - record.ga < 0 ? 'text-rwha-red' : 'text-rwha-muted'}">
          {record.gf - record.ga > 0 ? '+' : ''}{record.gf - record.ga}
        </div>
      </div>
    </div>
  {/if}

  <!-- Next game callout -->
  {#if nextGame}
    <div class="mt-3 font-mono text-xs text-rwha-muted">
      Next: <span class="text-rwha-text font-semibold">
        Week {nextGame.week} — {nextGame.is_home ? 'vs' : '@'} {nextGame.opponent_name}
      </span>
    </div>
  {:else if record.gp > 0}
    <div class="mt-3 font-mono text-xs text-rwha-muted">Season complete.</div>
  {/if}
</div>

<!-- ── Schedule table ─────────────────────────────────────────────────────────── -->
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
          <!-- Week -->
          <td class="pl-4 text-rwha-muted font-mono text-xs">{g.week}</td>
          <!-- H/A -->
          <td class="text-center font-mono text-xs {g.is_home ? 'text-rwha-muted' : 'text-rwha-amber/70'}">
            {g.is_home ? 'vs' : '@'}
          </td>
          <!-- Opponent -->
          <td class="font-semibold">
            <a href="/teams/{g.opponent_name.toLowerCase()}"
               class="hover:text-rwha-amber transition-colors">
              {g.opponent_name}
            </a>
          </td>
          <!-- Score -->
          <td class="text-center font-mono">
            {#if o}
              <span class="{o === 'W' ? 'text-rwha-green font-bold' : 'text-rwha-muted'}">{g.team_goals}</span>
              <span class="text-rwha-border mx-0.5">–</span>
              <span class="{o === 'L' || o === 'OT' ? 'text-rwha-muted font-bold' : 'text-rwha-muted'}">{g.opp_goals}</span>
            {:else}
              <span class="text-rwha-border text-xs">TBD</span>
            {/if}
          </td>
          <!-- OT label -->
          <td class="text-center font-mono text-xs text-rwha-amber">
            {#if g.final_label && g.final_label !== 'FINAL' && o}
              {g.final_label}
            {/if}
          </td>
          <!-- W/L badge -->
          <td class="text-center font-mono text-xs font-bold {outcomeClass(o)}">
            {o ?? ''}
          </td>
          <!-- Box score -->
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
