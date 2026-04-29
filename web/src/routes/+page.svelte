<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  const { standings, currentWeek, seasonName } = data;

  function diff(gf: number, ga: number) {
    const d = gf - ga;
    return d > 0 ? `+${d}` : String(d);
  }
  function diffClass(gf: number, ga: number) {
    const d = gf - ga;
    return d > 0 ? 'text-rwha-green' : d < 0 ? 'text-rwha-red' : 'text-rwha-muted';
  }
</script>

<svelte:head>
  <title>Standings — RWHA Sim</title>
</svelte:head>

<!-- Page header -->
<div class="mb-6">
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">
    {seasonName} Standings
  </h1>
  {#if currentWeek > 0}
    <p class="text-rwha-muted text-sm mt-0.5">Through Week {currentWeek}</p>
  {:else}
    <p class="text-rwha-muted text-sm mt-0.5">Season not yet started</p>
  {/if}
</div>

<div class="card overflow-x-auto">
  {#if standings.length === 0}
    <div class="p-8 text-center text-rwha-muted font-mono text-sm">
      No games played yet — check back after the first session.
    </div>
  {:else}
    <table class="stat-table w-full">
      <thead>
        <tr class="border-b border-rwha-border">
          <th class="text-left pl-4 py-2 text-rwha-muted text-xs font-mono uppercase tracking-widest w-6">#</th>
          <th class="text-left py-2 text-rwha-muted text-xs font-mono uppercase tracking-widest">Team</th>
          <th>GP</th>
          <th>W</th>
          <th>L</th>
          <th>OTL</th>
          <th class="text-rwha-amber">PTS</th>
          <th>GF</th>
          <th>GA</th>
          <th>DIFF</th>
        </tr>
      </thead>
      <tbody>
        {#each standings as row, i}
          <tr class="border-b border-rwha-border/50 hover:bg-rwha-border/30 transition-colors">
            <td class="pl-4 text-rwha-muted font-mono text-xs">{i + 1}</td>
            <td class="text-left py-2 pl-2">
              <a href="/teams/{row.team_name.toLowerCase()}"
                 class="font-semibold hover:text-rwha-amber transition-colors">
                {row.team_name}
              </a>
            </td>
            <td class="font-mono text-rwha-muted">{row.gp}</td>
            <td class="font-mono font-semibold text-rwha-green">{row.w}</td>
            <td class="font-mono text-rwha-red">{row.l}</td>
            <td class="font-mono text-rwha-amber/70">{row.otl}</td>
            <td class="font-mono font-bold text-rwha-amber text-base">{row.pts}</td>
            <td class="font-mono">{row.gf}</td>
            <td class="font-mono">{row.ga}</td>
            <td class="font-mono font-semibold {diffClass(row.gf, row.ga)}">{diff(row.gf, row.ga)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
