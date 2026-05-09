<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  const { stars, fights, pimLeaders, week, seasonName } = data;

  const STAR_LABEL = ['1st Star', '2nd Star', '3rd Star'];
  const STAR_SIZE  = ['text-4xl', 'text-3xl', 'text-2xl'];
  const STAR_COLOR = ['text-rwha-amber', 'text-rwha-muted', 'text-rwha-muted/50'];
  const PIM_BADGE  = ['bg-rwha-red/20 border-rwha-red/50 text-rwha-red', 'bg-rwha-red/10 border-rwha-red/30 text-rwha-red/80', 'bg-rwha-red/5 border-rwha-red/20 text-rwha-red/60'];

  function periodLabel(p: number): string {
    return p === 1 ? '1st' : p === 2 ? '2nd' : p === 3 ? '3rd' : 'OT';
  }

  function winnerName(f: typeof fights[0]): string {
    if (f.outcome === 'draw') return 'Draw';
    return f.outcome === 'home' ? f.homePlayer : f.awayPlayer;
  }
</script>

<svelte:head><title>RWHA Sim</title></svelte:head>

<!-- ── League logo ──────────────────────────────────────────────────────────── -->
<div class="flex justify-center mb-8 mt-2">
  <img src="/logos/mainlogo.png" alt="RWHA" class="h-44 w-auto object-contain drop-shadow-lg" />
</div>

<!-- ── Main grid ────────────────────────────────────────────────────────────── -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

  <!-- ── Three Stars ────────────────────────────────────────────────────────── -->
  <div>
    <div class="flex items-center gap-3 mb-3">
      <h2 class="font-mono font-bold text-rwha-amber text-sm uppercase tracking-widest shrink-0">
        Three Stars {#if week > 0}— Week {week}{/if}
      </h2>
      <div class="flex-1 h-px bg-rwha-border/50"></div>
    </div>

    {#if stars.length === 0}
      <div class="card p-6 text-center text-rwha-muted font-mono text-sm">
        No games played yet — check back after the first week.
      </div>
    {:else}
      <div class="space-y-2">
        {#each stars as s}
          <div class="card px-4 py-3 flex items-center gap-4">
            <span class="{STAR_SIZE[s.rank - 1]} {STAR_COLOR[s.rank - 1]} shrink-0 leading-none font-bold">★</span>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-rwha-text truncate">{s.playerName}</div>
              <div class="font-mono text-xs text-rwha-muted">{STAR_LABEL[s.rank - 1]} · {s.teamName}</div>
            </div>
            <div class="text-right shrink-0 font-mono">
              <div class="text-rwha-amber font-bold">{s.g}–{s.a}–{s.pts}</div>
              <div class="text-rwha-muted text-xs">G–A–PTS</div>
            </div>
          </div>
        {/each}
        {#if stars.length < 3}
          {#each Array(3 - stars.length) as _}
            <div class="card px-4 py-3 flex items-center gap-4 opacity-30">
              <span class="text-2xl text-rwha-muted shrink-0 leading-none">★</span>
              <span class="font-mono text-xs text-rwha-muted italic">No qualifying player</span>
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <!-- ── Season PIM Leaders ─────────────────────────────────────────────────── -->
  <div>
    <div class="flex items-center gap-3 mb-3">
      <h2 class="font-mono font-bold text-rwha-amber text-sm uppercase tracking-widest shrink-0">
        Penalty Leaders — Season
      </h2>
      <div class="flex-1 h-px bg-rwha-border/50"></div>
    </div>

    {#if pimLeaders.length === 0}
      <div class="card p-6 text-center text-rwha-muted font-mono text-sm">
        No penalty data yet.
      </div>
    {:else}
      <div class="space-y-2">
        {#each pimLeaders as p, i}
          <div class="card px-4 py-3 flex items-center gap-4">
            <div class="shrink-0 w-14 text-center">
              <span class="font-mono font-bold text-2xl {i === 0 ? 'text-rwha-red' : 'text-rwha-muted'}">{p.pim}</span>
              <div class="font-mono text-[10px] uppercase tracking-widest text-rwha-muted/60">PIM</div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-rwha-text truncate">{p.playerName}</div>
              <div class="font-mono text-xs text-rwha-muted">{p.teamName} · {p.gp} GP</div>
            </div>
            <div class="shrink-0">
              <span class="font-mono text-xs px-2 py-0.5 rounded border {PIM_BADGE[i]}">
                #{i + 1}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- ── Fight Card ─────────────────────────────────────────────────────────── -->
  <div class="lg:col-span-2">
    <div class="flex items-center gap-3 mb-3">
      <h2 class="font-mono font-bold text-rwha-amber text-sm uppercase tracking-widest shrink-0">
        Fight Card {#if week > 0}— Week {week}{/if}
      </h2>
      <div class="flex-1 h-px bg-rwha-border/50"></div>
    </div>

    {#if fights.length === 0}
      <div class="card p-6 text-center text-rwha-muted font-mono text-sm">
        {week === 0 ? 'No games yet.' : 'No fights this week. Bunch of lovers.'}
      </div>
    {:else}
      <div class="card overflow-x-auto">
        <table class="stat-table w-full text-sm whitespace-nowrap">
          <thead>
            <tr class="border-b border-rwha-border">
              <th class="text-left pl-4 text-rwha-muted font-mono text-xs uppercase tracking-widest">Game</th>
              <th class="text-rwha-muted font-mono text-xs uppercase tracking-widest">Per</th>
              <th class="text-rwha-muted font-mono text-xs uppercase tracking-widest">Time</th>
              <th class="text-left text-rwha-muted font-mono text-xs uppercase tracking-widest">Home</th>
              <th class="text-left text-rwha-muted font-mono text-xs uppercase tracking-widest">Away</th>
              <th class="text-left text-rwha-muted font-mono text-xs uppercase tracking-widest pr-4">Result</th>
            </tr>
          </thead>
          <tbody>
            {#each fights as f}
              <tr class="border-b border-rwha-border/40 hover:bg-rwha-border/20 transition-colors">
                <td class="pl-4 py-2 font-mono text-xs">
                  <a href="/games/{f.gameId}" class="text-rwha-blue hover:text-rwha-amber transition-colors">
                    {f.homeName} {f.homeGoals}–{f.awayGoals} {f.awayName}
                  </a>
                </td>
                <td class="font-mono text-xs text-rwha-muted text-center">{periodLabel(f.period)}</td>
                <td class="font-mono text-xs text-rwha-muted text-center">{f.time}</td>
                <td class="font-mono text-xs {f.outcome === 'home' ? 'text-rwha-green font-semibold' : 'text-rwha-muted'}">
                  {f.homePlayer}{f.homeGameMisconduct ? ' [GM]' : ''}
                </td>
                <td class="font-mono text-xs {f.outcome === 'away' ? 'text-rwha-green font-semibold' : 'text-rwha-muted'}">
                  {f.awayPlayer}{f.awayGameMisconduct ? ' [GM]' : ''}
                </td>
                <td class="font-mono text-xs pr-4">
                  {#if f.outcome === 'draw'}
                    <span class="text-rwha-amber">Draw</span>
                  {:else}
                    <span class="text-rwha-green font-semibold">{winnerName(f)} wins</span>
                  {/if}
                  {#if f.homeGameMisconduct || f.awayGameMisconduct}
                    <span class="ml-1 font-mono text-[10px] text-rwha-red border border-rwha-red/40 rounded px-1">+GM</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-1 text-rwha-muted/40 font-mono text-xs">GM = game misconduct · player serves 1-game suspension</p>
    {/if}
  </div>

</div>
