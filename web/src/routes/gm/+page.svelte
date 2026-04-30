<script lang="ts">
  import type { PageData } from './$types';
  import { fmtCap, fmtSpace } from '$lib/cap';
  export let data: PageData;

  const { record, cap, nextGame, last5, rosterStatus, usingComputer } = data;

  function outcome(g: typeof last5[0]): 'W' | 'L' | 'OT' {
    if (g.team_goals > g.opp_goals) return 'W';
    if (g.final_label === 'FINAL')  return 'L';
    return 'OT';
  }
  const oColor = { W: 'text-rwha-green', L: 'text-rwha-red', OT: 'text-rwha-amber' };
  const oBg    = { W: 'bg-rwha-green/10 border-rwha-green/30', L: 'bg-rwha-red/10 border-rwha-red/30', OT: 'bg-rwha-amber/10 border-rwha-amber/30' };

  $: rosterOk = rosterStatus
    ? rosterStatus.dress_sk === 18 && rosterStatus.dress_g === 2 && rosterStatus.scratches <= 3
    : false;
</script>

<svelte:head><title>My Team — RWHA Sim</title></svelte:head>

<!-- ── Next game banner ──────────────────────────────────────────────────────── -->
{#if nextGame}
  <div class="card px-4 py-3 mb-5 flex items-center justify-between gap-4">
    <div>
      <div class="font-mono text-xs text-rwha-muted uppercase tracking-wider mb-0.5">Next Game</div>
      <div class="font-semibold text-rwha-text">
        Week {nextGame.week} —
        <span class="text-rwha-muted font-normal">{nextGame.is_home ? 'vs' : '@'}</span>
        <a href="/teams/{nextGame.opponent.toLowerCase()}"
           class="text-rwha-amber hover:brightness-110 transition-colors ml-1">
          {nextGame.opponent}
        </a>
      </div>
    </div>
    <a href="/schedule" class="font-mono text-xs text-rwha-muted border border-rwha-border px-3 py-1.5
                               rounded hover:border-rwha-amber/50 hover:text-rwha-amber transition-colors shrink-0">
      Full Schedule →
    </a>
  </div>
{:else if record && record.gp > 0}
  <div class="card px-4 py-3 mb-5 font-mono text-xs text-rwha-muted">Season complete.</div>
{/if}

<!-- ── Record stats ──────────────────────────────────────────────────────────── -->
{#if record && record.gp > 0}
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
    <div class="card px-4 py-3">
      <div class="font-mono text-xs text-rwha-muted uppercase tracking-wider">Record</div>
      <div class="font-mono font-bold text-lg mt-1">
        <span class="text-rwha-green">{record.w}</span>
        <span class="text-rwha-muted mx-1 font-normal">–</span>
        <span class="text-rwha-red">{record.l}</span>
        <span class="text-rwha-muted mx-1 font-normal">–</span>
        <span class="text-rwha-amber">{record.otl}</span>
      </div>
      <div class="font-mono text-xs text-rwha-muted mt-0.5">{record.gp} games played</div>
    </div>

    <div class="card px-4 py-3">
      <div class="font-mono text-xs text-rwha-muted uppercase tracking-wider">Points</div>
      <div class="font-mono font-bold text-rwha-amber text-2xl mt-1">{record.pts}</div>
      <div class="font-mono text-xs text-rwha-muted mt-0.5">{(record.pts / record.gp).toFixed(2)} per game</div>
    </div>

    <div class="card px-4 py-3">
      <div class="font-mono text-xs text-rwha-muted uppercase tracking-wider">Goals</div>
      <div class="font-mono font-bold text-lg mt-1">
        <span class="{record.gf >= record.ga ? 'text-rwha-green' : 'text-rwha-red'}">{record.gf}</span>
        <span class="text-rwha-muted mx-1 font-normal">–</span>
        <span class="text-rwha-muted">{record.ga}</span>
      </div>
      <div class="font-mono text-xs mt-0.5
                  {record.gf - record.ga > 0 ? 'text-rwha-green' : record.gf - record.ga < 0 ? 'text-rwha-red' : 'text-rwha-muted'}">
        {record.gf - record.ga > 0 ? '+' : ''}{record.gf - record.ga} differential
      </div>
    </div>

    <div class="card px-4 py-3">
      <div class="font-mono text-xs text-rwha-muted uppercase tracking-wider">Cap Hit</div>
      <div class="font-mono font-bold text-rwha-text text-lg mt-1">{fmtCap(cap?.hit ?? 0)}</div>
      <div class="font-mono text-xs mt-0.5
                  {(cap?.capSpace ?? 0) >= 0 ? 'text-rwha-green' : 'text-rwha-red'}">
        {fmtSpace(cap?.capSpace ?? 0)} cap space
      </div>
    </div>
  </div>
{:else}
  <div class="card p-8 mb-5 text-center text-rwha-muted font-mono text-sm">
    No games played yet — check back after the first week.
  </div>
{/if}

<!-- ── Two-column lower section ──────────────────────────────────────────────── -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">

  <!-- Last 5 results -->
  <div>
    <div class="section-header">Recent Results</div>
    <div class="card overflow-hidden">
      {#if last5.length === 0}
        <div class="p-6 text-center text-rwha-muted font-mono text-sm">No results yet.</div>
      {:else}
        {#each last5 as g (g.game_id)}
          {@const o = outcome(g)}
          <div class="px-4 py-2.5 border-b border-rwha-border/50 last:border-0
                      flex items-center gap-3">
            <!-- W/L badge -->
            <span class="font-mono text-xs font-bold w-6 shrink-0 {oColor[o]}">{o}</span>
            <!-- Week -->
            <span class="font-mono text-xs text-rwha-muted w-12 shrink-0">Wk {g.week}</span>
            <!-- H/A + opponent -->
            <span class="font-mono text-xs text-rwha-amber/60 w-4 shrink-0">
              {g.is_home ? 'vs' : '@'}
            </span>
            <a href="/teams/{g.opponent.toLowerCase()}"
               class="font-semibold text-sm flex-1 hover:text-rwha-amber transition-colors truncate">
              {g.opponent}
            </a>
            <!-- Score -->
            <span class="font-mono text-sm shrink-0">
              <span class="{o === 'W' ? 'text-rwha-green font-bold' : 'text-rwha-muted'}">{g.team_goals}</span>
              <span class="text-rwha-border mx-0.5">–</span>
              <span class="{o === 'L' || o === 'OT' ? 'text-rwha-red' : 'text-rwha-muted'}">{g.opp_goals}</span>
              {#if g.final_label !== 'FINAL'}
                <span class="text-rwha-amber text-xs ml-0.5">{g.final_label}</span>
              {/if}
            </span>
            <!-- Box score link -->
            <a href="/games/{g.game_id}"
               class="font-mono text-xs text-rwha-amber/50 hover:text-rwha-amber transition-colors shrink-0">→</a>
          </div>
        {/each}
      {/if}
    </div>
    {#if record && record.gp > 5}
      <div class="mt-1 text-right">
        <a href="/teams/{data.user?.teamName?.toLowerCase()}"
           class="font-mono text-xs text-rwha-muted hover:text-rwha-amber transition-colors">
          Full schedule →
        </a>
      </div>
    {/if}
  </div>

  <!-- Status panel -->
  <div class="flex flex-col gap-4">

    <!-- Roster status -->
    <div>
      <div class="section-header">Roster Status</div>
      <div class="card px-4 py-3 flex flex-col gap-2">
        {#if rosterStatus}
          <div class="flex items-center justify-between font-mono text-sm">
            <span class="text-rwha-muted">Pro Dress — Skaters</span>
            <span class="{rosterStatus.dress_sk === 18 ? 'text-rwha-green' : 'text-rwha-red'} font-bold">
              {rosterStatus.dress_sk}/18
            </span>
          </div>
          <div class="flex items-center justify-between font-mono text-sm">
            <span class="text-rwha-muted">Pro Dress — Goalies</span>
            <span class="{rosterStatus.dress_g === 2 ? 'text-rwha-green' : 'text-rwha-red'} font-bold">
              {rosterStatus.dress_g}/2
            </span>
          </div>
          <div class="flex items-center justify-between font-mono text-sm">
            <span class="text-rwha-muted">Scratches</span>
            <span class="{rosterStatus.scratches <= 3 ? 'text-rwha-muted' : 'text-rwha-red'} font-bold">
              {rosterStatus.scratches}/3
            </span>
          </div>
          <div class="flex items-center justify-between font-mono text-sm">
            <span class="text-rwha-muted">Farm roster</span>
            <span class="text-rwha-muted">{rosterStatus.farm} players</span>
          </div>
          <div class="border-t border-rwha-border/40 pt-2 mt-1 flex items-center justify-between">
            <span class="font-mono text-xs {rosterOk ? 'text-rwha-green' : 'text-rwha-red'} font-semibold">
              {rosterOk ? '✓ Roster complete' : '⚠ Roster incomplete'}
            </span>
            <a href="/gm/roster"
               class="font-mono text-xs text-rwha-muted border border-rwha-border px-2.5 py-1 rounded
                      hover:border-rwha-amber/50 hover:text-rwha-amber transition-colors">
              Edit Roster →
            </a>
          </div>
        {:else}
          <p class="font-mono text-xs text-rwha-muted">No roster data.</p>
        {/if}
      </div>
    </div>

    <!-- Lines status -->
    <div>
      <div class="section-header">Lines</div>
      <div class="card px-4 py-3 flex items-center justify-between">
        <div>
          <div class="font-mono text-sm text-rwha-text">
            {usingComputer ? 'Computer lines' : 'Custom lines set'}
          </div>
          <div class="font-mono text-xs text-rwha-muted mt-0.5">
            {usingComputer ? 'Sim assigns lines automatically by OV' : 'Manual line assignments active'}
          </div>
        </div>
        <a href="/gm/lines"
           class="font-mono text-xs text-rwha-muted border border-rwha-border px-2.5 py-1 rounded
                  hover:border-rwha-amber/50 hover:text-rwha-amber transition-colors shrink-0">
          Edit Lines →
        </a>
      </div>
    </div>

    <!-- Cap summary -->
    {#if cap}
      <div>
        <div class="section-header">Salary Cap</div>
        <div class="card px-4 py-3 flex flex-col gap-2">
          <div class="flex items-center justify-between font-mono text-sm">
            <span class="text-rwha-muted">Pro Cap Hit</span>
            <span class="text-rwha-text font-bold">{fmtCap(cap.hit)}</span>
          </div>
          <div class="flex items-center justify-between font-mono text-sm">
            <span class="text-rwha-muted">Cap Space</span>
            <span class="{cap.capSpace >= 0 ? 'text-rwha-green' : 'text-rwha-red'} font-bold">
              {fmtSpace(cap.capSpace)}
            </span>
          </div>
          <div class="flex items-center justify-between font-mono text-sm">
            <span class="text-rwha-muted">vs Floor</span>
            <span class="{cap.floorRoom >= 0 ? 'text-rwha-muted' : 'text-rwha-amber'} font-bold">
              {cap.floorRoom >= 0 ? fmtSpace(cap.floorRoom) + ' above' : fmtSpace(cap.floorRoom) + ' below'}
            </span>
          </div>
          <div class="text-right mt-1">
            <a href="/finance"
               class="font-mono text-xs text-rwha-muted hover:text-rwha-amber transition-colors">
              League finance →
            </a>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
