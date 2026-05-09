<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  const { standings, currentWeek, seasonName } = data;

  // Conference names
  const CONF_NAME: Record<number, string> = { 1: 'Honey', 2: 'Sturdy' };

  // Division order within each conference
  const DIV_ORDER: Record<number, string[]> = {
    1: ['Jofa', 'Titan'],
    2: ['Cooper', 'CCM'],
  };

  // Build grouped structure: conf → div → rows
  type Row = typeof standings[0];
  function groupStandings(rows: Row[]) {
    const map = new Map<number, Map<string, Row[]>>();
    for (const conf of [1, 2]) {
      const divMap = new Map<string, Row[]>();
      for (const div of DIV_ORDER[conf]!) divMap.set(div, []);
      map.set(conf, divMap);
    }
    for (const row of rows) {
      map.get(row.conference)?.get(row.division)?.push(row);
    }
    return map;
  }

  $: grouped = groupStandings(standings);

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
  <title>RWHA Sim</title>
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

{#if standings.length === 0}
  <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
    No games played yet — check back after the first session.
  </div>
{:else}
  {#each [1, 2] as conf}
    <!-- Conference header -->
    <div class="mt-6 mb-3 flex items-center gap-3">
      <h2 class="font-mono font-bold text-rwha-amber text-base uppercase tracking-widest">
        {CONF_NAME[conf]} Conference
      </h2>
      <div class="flex-1 h-px bg-rwha-border/50"></div>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
      {#each DIV_ORDER[conf]! as div}
        {@const rows = grouped.get(conf)?.get(div) ?? []}
        <div class="card overflow-x-auto">
          <!-- Division header -->
          <div class="px-4 pt-3 pb-1 border-b border-rwha-border/40">
            <span class="font-mono text-xs uppercase tracking-widest text-rwha-muted">
              {div} Division
            </span>
          </div>

          <table class="stat-table w-full">
            <thead>
              <tr class="border-b border-rwha-border">
                <th class="text-left pl-4 py-1.5 text-rwha-muted text-xs font-mono uppercase tracking-widest w-5">#</th>
                <th class="text-left py-1.5 text-rwha-muted text-xs font-mono uppercase tracking-widest">Team</th>
                <th class="text-xs">GP</th>
                <th class="text-xs">W</th>
                <th class="text-xs">L</th>
                <th class="text-xs">OTL</th>
                <th class="text-xs">T</th>
                <th class="text-rwha-amber text-xs">PTS</th>
                <th class="text-xs">GF</th>
                <th class="text-xs">GA</th>
                <th class="text-xs">DIFF</th>
              </tr>
            </thead>
            <tbody>
              {#each rows as row, i}
                <tr class="border-b border-rwha-border/50 hover:bg-rwha-border/30 transition-colors">
                  <td class="pl-4 text-rwha-muted font-mono text-xs">{i + 1}</td>
                  <td class="text-left py-1.5 pl-2">
                    <a href="/teams/{row.team_name.toLowerCase()}"
                       class="font-semibold hover:text-rwha-amber transition-colors text-sm">
                      {row.team_name}
                    </a>
                  </td>
                  <td class="font-mono text-rwha-muted text-xs">{row.gp}</td>
                  <td class="font-mono font-semibold text-rwha-green text-xs">{row.w}</td>
                  <td class="font-mono text-rwha-red text-xs">{row.l}</td>
                  <td class="font-mono text-rwha-amber/70 text-xs">{row.otl}</td>
                  <td class="font-mono text-rwha-amber/50 text-xs">{row.t}</td>
                  <td class="font-mono font-bold text-rwha-amber">{row.pts}</td>
                  <td class="font-mono text-xs">{row.gf}</td>
                  <td class="font-mono text-xs">{row.ga}</td>
                  <td class="font-mono font-semibold text-xs {diffClass(row.gf, row.ga)}">{diff(row.gf, row.ga)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}
    </div>
  {/each}
{/if}
