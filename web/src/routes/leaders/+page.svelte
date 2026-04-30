<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  type Tab = 'skaters' | 'goalies';
  let tab: Tab = 'skaters';

  function fmtSvp(n: number | null) {
    if (n == null) return '—';
    return n.toFixed(3).replace(/^0/, '');
  }
  function fmtPlusMinus(n: number) {
    return n > 0 ? `+${n}` : String(n);
  }
</script>

<svelte:head><title>Leaders — RWHA Sim</title></svelte:head>

<div class="mb-6 flex items-end justify-between">
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">Leaders</h1>

  <!-- Tab switcher -->
  <div class="flex gap-1 font-mono text-sm">
    {#each (['skaters', 'goalies'] as Tab[]) as t}
      <button
        class="px-4 py-1.5 rounded border transition-colors
               {tab === t
                 ? 'border-rwha-amber bg-rwha-amber/10 text-rwha-amber'
                 : 'border-rwha-border text-rwha-muted hover:border-rwha-amber/40'}"
        on:click={() => tab = t}
      >{t === 'skaters' ? 'Skaters' : 'Goalies'}</button>
    {/each}
  </div>
</div>

{#if tab === 'skaters'}
  {#if data.skaters.length === 0}
    <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
      No games played yet — check back after Sunday.
    </div>
  {:else}
    <div class="section-header">Scoring Leaders</div>
    <div class="card overflow-x-auto">
      <table class="stat-table">
        <thead>
          <tr>
            <th class="text-left pl-4 w-8">#</th>
            <th class="text-left">Player</th>
            <th class="text-left">Team</th>
            <th class="w-10">POS</th>
            <th>GP</th>
            <th>G</th>
            <th>A</th>
            <th class="text-rwha-amber">PTS</th>
            <th>+/−</th>
            <th>PIM</th>
            <th class="pr-4">SOG</th>
          </tr>
        </thead>
        <tbody>
          {#each data.skaters as s, i}
            <tr>
              <td class="text-left pl-4 text-rwha-muted text-xs">{i + 1}</td>
              <td class="name-col font-semibold text-rwha-text">{s.name}</td>
              <td class="name-col text-rwha-muted text-xs uppercase tracking-wide">{s.team_name}</td>
              <td class="text-rwha-muted text-xs">{s.position}</td>
              <td>{s.gp}</td>
              <td>{s.g}</td>
              <td>{s.a}</td>
              <td class="text-rwha-amber font-bold">{s.pts}</td>
              <td class="{(s.plus_minus ?? 0) > 0 ? 'text-rwha-green' : (s.plus_minus ?? 0) < 0 ? 'text-rwha-red' : 'text-rwha-muted'}">
                {fmtPlusMinus(s.plus_minus ?? 0)}
              </td>
              <td>{s.pim}</td>
              <td class="pr-4">{s.sog}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

{:else}
  {#if data.goalies.length === 0}
    <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
      No goalies qualify yet (min 10 GP).
    </div>
  {:else}
    <div class="section-header">Goalie Leaders <span class="text-rwha-muted normal-case font-sans font-normal">(min 10 GP · sorted by SV%)</span></div>
    <div class="card overflow-x-auto">
      <table class="stat-table">
        <thead>
          <tr>
            <th class="text-left pl-4 w-8">#</th>
            <th class="text-left">Goalie</th>
            <th class="text-left">Team</th>
            <th>GP</th>
            <th>W</th>
            <th>L</th>
            <th>OTL</th>
            <th>GAA</th>
            <th class="text-rwha-amber">SV%</th>
            <th class="pr-4">SO</th>
          </tr>
        </thead>
        <tbody>
          {#each data.goalies as g, i}
            <tr>
              <td class="text-left pl-4 text-rwha-muted text-xs">{i + 1}</td>
              <td class="name-col font-semibold text-rwha-text">{g.name}</td>
              <td class="name-col text-rwha-muted text-xs uppercase tracking-wide">{g.team_name}</td>
              <td>{g.gp}</td>
              <td class="text-rwha-green">{g.w}</td>
              <td class="text-rwha-red">{g.l}</td>
              <td class="text-rwha-amber">{g.otl}</td>
              <td class="font-mono">{g.gaa?.toFixed(2) ?? '—'}</td>
              <td class="text-rwha-amber font-bold font-mono">{fmtSvp(g.sv_pct)}</td>
              <td class="pr-4">{g.so}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}
