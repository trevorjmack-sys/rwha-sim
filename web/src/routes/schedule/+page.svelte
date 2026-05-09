<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
  $: seasonName = data.seasonName ?? '';

  // ── Week strip helpers ────────────────────────────────────────────────────────
  function weekHref(w: number) {
    const p = new URLSearchParams();
    p.set('week', String(w));
    if (data.teamFilter) p.set('team', data.teamFilter);
    return `/schedule?${p}`;
  }

  function weekClass(w: { week: number; total: number; played: number }) {
    const cur = w.week === data.week;
    if (cur)            return 'bg-rwha-amber text-rwha-bg font-bold';
    if (w.played === w.total && w.total > 0) return 'text-rwha-amber/70 hover:text-rwha-amber';
    if (w.played > 0)   return 'text-rwha-amber/40 hover:text-rwha-amber/70';
    return 'text-rwha-muted hover:text-rwha-text';
  }

  // ── Result helpers ────────────────────────────────────────────────────────────
  function score(g: typeof data.games[0]) {
    if (g.status !== 'complete') return null;
    return { h: g.home_goals ?? 0, a: g.away_goals ?? 0, label: g.final_label };
  }

  function teamHref(name: string) {
    return `/teams/${name.toLowerCase()}`;
  }

  function rivalryIcon(level: number): string {
    if (level <= 0) return '';
    if (level <= 2) return '🔥';
    if (level <= 4) return '💢';
    return '☠️';
  }

  $: prev = data.weeks.find(w => w.week === data.week - 1);
  $: next = data.weeks.find(w => w.week === data.week + 1);
  $: currentWeekInfo = data.weeks.find(w => w.week === data.week);
</script>

<svelte:head><title>Schedule — RWHA Sim</title></svelte:head>

<!-- ── Header ────────────────────────────────────────────────────────────────── -->
<div class="mb-5 flex items-end justify-between gap-4">
  <div>
    <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">Schedule</h1>
    {#if seasonName}<div class="font-mono text-xs text-rwha-muted/70 mt-0.5">{seasonName}</div>{/if}
  </div>
  <span class="font-mono text-xs text-rwha-muted">
    {data.weeks.filter(w => w.played > 0).length} of {data.weeks.length} weeks played
  </span>
</div>

<!-- ── Week strip ─────────────────────────────────────────────────────────────── -->
<div class="mb-4 flex items-center gap-2">
  <!-- Prev -->
  {#if prev}
    <a href={weekHref(prev.week)}
       class="font-mono text-xs text-rwha-muted hover:text-rwha-amber px-1 transition-colors">‹</a>
  {:else}
    <span class="font-mono text-xs text-rwha-border px-1">‹</span>
  {/if}

  <!-- Week pills — scrollable row -->
  <div class="flex gap-1 overflow-x-auto flex-1 pb-1">
    {#each data.weeks as w (w.week)}
      <a
        href={weekHref(w.week)}
        class="shrink-0 px-2 py-0.5 rounded font-mono text-xs transition-colors {weekClass(w)}"
      >{w.week}</a>
    {/each}
  </div>

  <!-- Next -->
  {#if next}
    <a href={weekHref(next.week)}
       class="font-mono text-xs text-rwha-muted hover:text-rwha-amber px-1 transition-colors">›</a>
  {:else}
    <span class="font-mono text-xs text-rwha-border px-1">›</span>
  {/if}
</div>

<!-- ── Week heading ───────────────────────────────────────────────────────────── -->
<div class="section-header mb-2">
  Week {data.week}
  {#if currentWeekInfo}
    <span class="ml-2 font-normal normal-case text-rwha-muted text-xs">
      — {currentWeekInfo.played}/{currentWeekInfo.total} games played
    </span>
  {/if}
</div>

<!-- ── Game list ─────────────────────────────────────────────────────────────── -->
{#if data.games.length === 0}
  <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
    No games this week.
  </div>
{:else}
  <div class="card overflow-hidden">
    <table class="stat-table w-full text-sm">
      <thead>
        <tr class="border-b border-rwha-border">
          <th class="text-left pl-4 text-rwha-muted font-normal">Home</th>
          <th class="w-8 text-rwha-muted font-normal">vs</th>
          <th class="text-left text-rwha-muted font-normal">Away</th>
          <th class="w-20 text-rwha-muted font-normal">Score</th>
          <th class="w-14 pr-4"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.games as g (g.id)}
          {@const s = score(g)}
          <tr class="{g.status === 'complete' ? '' : 'opacity-60'}">
            <!-- Home -->
            <td class="pl-4 py-2.5 font-semibold">
              <a href={teamHref(g.home_name)}
                 class="hover:text-rwha-amber transition-colors {s && s.h > s.a ? 'text-rwha-text' : 'text-rwha-muted'}">
                {g.home_name}
              </a>
            </td>
            <td class="text-rwha-border text-xs text-center">
              vs{#if g.rivalryLevel > 0}<span class="ml-1" title="Rivalry (level {g.rivalryLevel})">{rivalryIcon(g.rivalryLevel)}</span>{/if}
            </td>
            <!-- Away -->
            <td class="font-semibold">
              <a href={teamHref(g.away_name)}
                 class="hover:text-rwha-amber transition-colors {s && s.a > s.h ? 'text-rwha-text' : 'text-rwha-muted'}">
                {g.away_name}
              </a>
            </td>
            <!-- Score -->
            <td class="text-center font-mono">
              {#if s}
                <span class="{s.h > s.a ? 'text-rwha-text font-bold' : 'text-rwha-muted'}">{s.h}</span>
                <span class="text-rwha-border mx-0.5">–</span>
                <span class="{s.a > s.h ? 'text-rwha-text font-bold' : 'text-rwha-muted'}">{s.a}</span>
                {#if s.label && s.label !== 'FINAL'}
                  <span class="text-rwha-amber text-xs ml-1">{s.label}</span>
                {/if}
              {:else}
                <span class="text-rwha-border text-xs">TBD</span>
              {/if}
            </td>
            <!-- Box score link -->
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

<!-- ── Legend ─────────────────────────────────────────────────────────────────── -->
<div class="mt-4 font-mono text-xs text-rwha-muted flex gap-4 flex-wrap">
  <span><span class="text-rwha-amber">●</span> All complete</span>
  <span><span class="text-rwha-amber/40">●</span> In progress</span>
  <span><span class="text-rwha-muted">●</span> Upcoming</span>
  <span class="text-rwha-border">·</span>
  <span>🔥 Rivalry</span>
  <span>💢 Intense rivalry</span>
  <span>☠️ Historic rivals</span>
  <span class="ml-auto">Click a team name to see their full schedule</span>
</div>
