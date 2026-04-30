<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  $: prev = data.playedWeeks[data.playedWeeks.indexOf(data.week) - 1] ?? null;
  $: next = data.playedWeeks[data.playedWeeks.indexOf(data.week) + 1] ?? null;

  function winner(hg: number | null, ag: number | null, side: 'home' | 'away') {
    if (hg == null || ag == null) return '';
    if (side === 'home') return hg > ag ? 'text-rwha-amber font-bold' : 'text-rwha-muted';
    return ag > hg ? 'text-rwha-amber font-bold' : 'text-rwha-muted';
  }
</script>

<svelte:head><title>Scores — RWHA Sim</title></svelte:head>

<!-- Week nav -->
<div class="mb-6 flex items-center justify-between gap-4">
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">Scores</h1>

  <div class="flex items-center gap-3 font-mono text-sm">
    <a
      href={prev ? `/scores?week=${prev}` : '#'}
      class="w-8 h-8 flex items-center justify-center rounded border transition-colors
             {prev ? 'border-rwha-border text-rwha-muted hover:border-rwha-amber/60 hover:text-rwha-amber' : 'border-rwha-border/30 text-rwha-muted/30 pointer-events-none'}"
    >←</a>

    <span class="text-rwha-text w-20 text-center">
      {data.week === 0 ? 'No games yet' : `Week ${data.week}`}
    </span>

    <a
      href={next ? `/scores?week=${next}` : '#'}
      class="w-8 h-8 flex items-center justify-center rounded border transition-colors
             {next ? 'border-rwha-border text-rwha-muted hover:border-rwha-amber/60 hover:text-rwha-amber' : 'border-rwha-border/30 text-rwha-muted/30 pointer-events-none'}"
    >→</a>
  </div>
</div>

{#if data.games.length === 0}
  <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
    No games played yet. Check back after Sunday.
  </div>
{:else}
  <div class="space-y-2">
    {#each data.games as g (g.id)}
      <div class="card px-4 py-3">
        <div class="flex items-center gap-3">
          <!-- Game # -->
          <span class="text-rwha-muted font-mono text-xs w-10 shrink-0">#{g.id}</span>

          <!-- Away team -->
          <div class="flex-1 text-right">
            <span class="font-semibold uppercase tracking-wide text-sm {winner(g.home_goals, g.away_goals, 'away')}">
              {g.away_name}
            </span>
          </div>

          <!-- Score -->
          <div class="w-24 text-center shrink-0">
            {#if g.status === 'complete' && g.home_goals != null}
              <div class="flex items-center justify-center gap-1.5 font-mono">
                <span class="text-lg {winner(g.home_goals, g.away_goals, 'away')}">{g.away_goals}</span>
                <span class="text-rwha-muted/50 text-xs">–</span>
                <span class="text-lg {winner(g.home_goals, g.away_goals, 'home')}">{g.home_goals}</span>
              </div>
              <div class="text-rwha-muted text-xs font-mono mt-0.5">
                {g.final_label?.replace('FINAL', '').trim() || ''}
              </div>
            {:else}
              <span class="text-rwha-muted font-mono text-sm">vs</span>
            {/if}
          </div>

          <!-- Home team -->
          <div class="flex-1">
            <span class="font-semibold uppercase tracking-wide text-sm {winner(g.home_goals, g.away_goals, 'home')}">
              {g.home_name}
            </span>
          </div>

          <!-- Box score link -->
          <div class="w-20 text-right shrink-0">
            {#if g.status === 'complete'}
              <a href="/games/{g.id}"
                 class="text-xs font-mono text-rwha-blue hover:text-rwha-amber transition-colors">
                Box score →
              </a>
            {:else}
              <span class="text-xs font-mono text-rwha-muted/40">—</span>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Week picker strip -->
  {#if data.playedWeeks.length > 1}
    <div class="mt-6 flex flex-wrap gap-1.5">
      {#each data.playedWeeks as w}
        <a
          href="/scores?week={w}"
          class="px-2.5 py-1 rounded font-mono text-xs border transition-colors
                 {w === data.week
                   ? 'border-rwha-amber bg-rwha-amber/10 text-rwha-amber'
                   : 'border-rwha-border text-rwha-muted hover:border-rwha-amber/40'}"
        >W{w}</a>
      {/each}
    </div>
  {/if}
{/if}
