<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  function outcomeColor(o: 'W' | 'L' | 'OT') {
    if (o === 'W')  return 'bg-rwha-green';
    if (o === 'L')  return 'bg-rwha-red';
    return 'bg-rwha-amber';
  }

  function streakClass(t: 'W' | 'L' | 'OT') {
    if (t === 'W')  return 'text-rwha-green';
    if (t === 'L')  return 'text-rwha-red';
    return 'text-rwha-amber';
  }

  function l10Label(r: typeof data.rankings[0]) {
    if (r.l10_gp === 0) return '—';
    return `${r.l10_w}-${r.l10_l}-${r.l10_otl}`;
  }
</script>

<svelte:head><title>Power Rankings — RWHA Sim</title></svelte:head>

<div class="mb-5 flex items-end justify-between gap-4">
  <div>
    <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">
      Power Rankings
    </h1>
    <p class="font-mono text-xs text-rwha-muted mt-1">
      40% overall PPG + 60% last-10 PPG — updated after each week
    </p>
  </div>
</div>

{#if data.rankings.length === 0}
  <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
    Not enough games played yet. Check back after week 2.
  </div>
{:else}
  <div class="card overflow-x-auto">
    <table class="stat-table w-full text-sm whitespace-nowrap">
      <thead>
        <tr class="border-b border-rwha-border">
          <th class="text-left pl-4 w-8 text-rwha-muted">#</th>
          <th class="text-left min-w-[140px]">Team</th>
          <th class="w-24 text-left text-rwha-muted font-normal">Record</th>
          <th class="w-12 text-rwha-muted font-normal">PTS</th>
          <th class="w-24 text-left text-rwha-muted font-normal">Last 10</th>
          <th class="w-20 text-center text-rwha-muted font-normal">Streak</th>
          <th class="w-28 text-center text-rwha-muted font-normal">Last 5</th>
          <th class="w-16 pr-4 text-rwha-muted font-normal">Score</th>
        </tr>
      </thead>
      <tbody>
        {#each data.rankings as r (r.team_id)}
          <tr>
            <!-- Rank -->
            <td class="pl-4 font-mono font-bold text-rwha-amber text-base">{r.rank}</td>

            <!-- Team -->
            <td class="font-semibold">
              <a href="/teams/{r.team_name.toLowerCase()}"
                 class="hover:text-rwha-amber transition-colors">{r.team_name}</a>
            </td>

            <!-- Overall record -->
            <td class="font-mono text-xs text-rwha-muted">
              <span class="text-rwha-green">{r.w}</span>-<span class="text-rwha-red">{r.l}</span>-<span class="text-rwha-amber">{r.otl}</span>
            </td>

            <!-- PTS -->
            <td class="font-mono font-bold text-rwha-amber">{r.pts}</td>

            <!-- Last 10 -->
            <td class="font-mono text-xs text-rwha-muted">
              {#if r.l10_gp < 10}
                <span class="text-rwha-muted/50 text-[10px]">{r.l10_gp}gp </span>
              {/if}
              {l10Label(r)}
            </td>

            <!-- Streak -->
            <td class="text-center font-mono text-xs font-bold {streakClass(r.streak_type)}">
              {#if r.gp > 0}
                {r.streak_type}{r.streak_count}
              {:else}
                —
              {/if}
            </td>

            <!-- Last 5 dots -->
            <td class="text-center">
              <div class="inline-flex gap-1 items-center">
                {#each r.l5 as o}
                  <span class="w-3 h-3 rounded-sm inline-block {outcomeColor(o)}" title={o}></span>
                {:else}
                  <span class="text-rwha-muted/40 font-mono text-xs">—</span>
                {/each}
                <!-- Pad empty slots when fewer than 5 games -->
                {#each { length: Math.max(0, 5 - r.l5.length) } as _}
                  <span class="w-3 h-3 rounded-sm inline-block bg-rwha-border/40"></span>
                {/each}
              </div>
            </td>

            <!-- Power score -->
            <td class="pr-4 font-mono text-xs text-rwha-muted">
              {r.power_score.toFixed(3)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Key -->
  <div class="mt-3 flex gap-4 font-mono text-xs text-rwha-muted flex-wrap">
    <span class="flex items-center gap-1.5">
      <span class="w-3 h-3 rounded-sm bg-rwha-green inline-block"></span>Win
    </span>
    <span class="flex items-center gap-1.5">
      <span class="w-3 h-3 rounded-sm bg-rwha-red inline-block"></span>Loss
    </span>
    <span class="flex items-center gap-1.5">
      <span class="w-3 h-3 rounded-sm bg-rwha-amber inline-block"></span>OT Loss
    </span>
    <span class="ml-auto">Oldest → Newest (left to right)</span>
  </div>
{/if}
