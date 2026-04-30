<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  type SortKey = 'pts' | 'gp' | 'w' | 'l' | 'otl' | 'gf' | 'ga' | 'diff' | 'sog' | 'sa' | 'spct';
  let sortKey: SortKey = 'pts';
  let sortDir = -1; // -1 = desc

  function sortVal(t: typeof data.teams[0], key: SortKey): number {
    if (key === 'diff') return t.gf - t.ga;
    if (key === 'spct') return t.sog > 0 ? t.gf / t.sog : 0;
    return (t as Record<string, number>)[key] ?? 0;
  }

  $: sorted = [...data.teams].sort((a, b) =>
    sortDir * (sortVal(b, sortKey) - sortVal(a, sortKey))
  );

  function setSortKey(k: SortKey) {
    if (sortKey === k) sortDir = -sortDir;
    else { sortKey = k; sortDir = -1; }
  }

  function thClass(k: SortKey) {
    return sortKey === k ? 'text-rwha-amber cursor-pointer' : 'text-rwha-muted cursor-pointer hover:text-rwha-text';
  }

  function indicator(k: SortKey) {
    if (sortKey !== k) return '';
    return sortDir === -1 ? ' ↓' : ' ↑';
  }

  function fmtPct(n: number) {
    return (n * 100).toFixed(1) + '%';
  }
</script>

<svelte:head><title>Team Stats — RWHA Sim</title></svelte:head>

<div class="mb-5 flex items-end justify-between">
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">Team Stats</h1>
  <span class="font-mono text-xs text-rwha-muted">Click a column header to sort</span>
</div>

{#if data.teams.every(t => t.gp === 0)}
  <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
    No games played yet — check back after the first week.
  </div>
{:else}
  <div class="card overflow-x-auto">
    <table class="stat-table w-full text-sm whitespace-nowrap">
      <thead>
        <tr class="border-b border-rwha-border">
          <th class="text-left pl-4 w-8 text-rwha-muted">#</th>
          <th class="text-left min-w-[140px]">Team</th>
          <th class="{thClass('gp')}" on:click={() => setSortKey('gp')}>GP{indicator('gp')}</th>
          <th class="{thClass('w')}"  on:click={() => setSortKey('w')}>W{indicator('w')}</th>
          <th class="{thClass('l')}"  on:click={() => setSortKey('l')}>L{indicator('l')}</th>
          <th class="{thClass('otl')} " on:click={() => setSortKey('otl')}>OTL{indicator('otl')}</th>
          <th class="{thClass('pts')} text-rwha-amber" on:click={() => setSortKey('pts')}>PTS{indicator('pts')}</th>
          <th class="{thClass('gf')}" on:click={() => setSortKey('gf')}>GF{indicator('gf')}</th>
          <th class="{thClass('ga')}" on:click={() => setSortKey('ga')}>GA{indicator('ga')}</th>
          <th class="{thClass('diff')}" on:click={() => setSortKey('diff')}>DIFF{indicator('diff')}</th>
          <th class="{thClass('sog')}" on:click={() => setSortKey('sog')}>SOG{indicator('sog')}</th>
          <th class="{thClass('sa')}"  on:click={() => setSortKey('sa')}>SA{indicator('sa')}</th>
          <th class="{thClass('spct')} pr-4" on:click={() => setSortKey('spct')}>S%{indicator('spct')}</th>
        </tr>
      </thead>
      <tbody>
        {#each sorted as t, i (t.team_id)}
          {@const diff = t.gf - t.ga}
          <tr>
            <td class="pl-4 text-rwha-muted text-xs">{i + 1}</td>
            <td class="font-semibold">
              <a href="/teams/{t.team_name.toLowerCase()}"
                 class="hover:text-rwha-amber transition-colors">{t.team_name}</a>
            </td>
            <td class="text-rwha-muted">{t.gp}</td>
            <td class="text-rwha-green">{t.w}</td>
            <td class="text-rwha-red">{t.l}</td>
            <td class="text-rwha-amber">{t.otl}</td>
            <td class="text-rwha-amber font-bold">{t.pts}</td>
            <td>{t.gf}</td>
            <td>{t.ga}</td>
            <td class="{diff > 0 ? 'text-rwha-green' : diff < 0 ? 'text-rwha-red' : 'text-rwha-muted'}">
              {diff > 0 ? '+' : ''}{diff}
            </td>
            <td class="text-rwha-muted">{t.sog}</td>
            <td class="text-rwha-muted">{t.sa}</td>
            <td class="pr-4 text-rwha-muted">
              {t.sog > 0 ? fmtPct(t.gf / t.sog) : '—'}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
