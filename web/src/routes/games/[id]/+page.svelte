<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function pLabel(i: number) {
    return i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : 'OT';
  }
  function pLabelNum(n: number) {
    return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : 'OT';
  }

  function fmtPct(n: number) { return (n * 100).toFixed(1) + '%'; }
  function fmtSvp(n: number) { return n.toFixed(3).replace(/^0/, ''); }

  $: homeWon = (data.homeGoals ?? 0) > (data.awayGoals ?? 0);
  $: awayWon = (data.awayGoals ?? 0) > (data.homeGoals ?? 0);
  $: periods = Math.max(data.homeByPeriod.length, data.awayByPeriod.length);

  $: homeSkaters = data.skaters.filter(s => s.team === data.homeName);
  $: awaySkaters = data.skaters.filter(s => s.team === data.awayName);
  $: homeGoalies = data.goalies.filter(g => g.team === data.homeName);
  $: awayGoalies = data.goalies.filter(g => g.team === data.awayName);

  function decisionBadge(d: string) {
    if (d === 'W')  return 'badge-w';
    if (d === 'L')  return 'badge-l';
    if (d === 'OT') return 'badge-ot';
    return '';
  }
</script>

<svelte:head><title>Game #{data.gameId} — RWHA Sim</title></svelte:head>

<!-- Back link -->
<div class="mb-4">
  <a href="/scores" class="text-xs font-mono text-rwha-muted hover:text-rwha-amber transition-colors">
    ← Scores
  </a>
</div>

<!-- ── Score header ─────────────────────────────────────────────────────────── -->
<div class="card px-6 py-5 mb-5">
  <div class="flex items-center gap-4">
    <!-- Away -->
    <div class="flex-1 text-right">
      <div class="text-xl font-bold uppercase tracking-widest {awayWon ? 'text-rwha-amber' : 'text-rwha-muted'}">
        {data.awayName}
      </div>
      <div class="text-xs font-mono text-rwha-muted mt-0.5">Away</div>
    </div>

    <!-- Scores -->
    <div class="text-center shrink-0 px-4">
      <div class="flex items-baseline gap-3 justify-center">
        <span class="font-mono text-4xl font-bold {awayWon ? 'text-rwha-amber' : 'text-rwha-muted'}">
          {data.awayGoals ?? '–'}
        </span>
        <span class="text-rwha-muted/40 text-xl">–</span>
        <span class="font-mono text-4xl font-bold {homeWon ? 'text-rwha-amber' : 'text-rwha-muted'}">
          {data.homeGoals ?? '–'}
        </span>
      </div>
      <div class="text-rwha-muted font-mono text-xs mt-1 tracking-widest">
        {data.finalLabel ?? (data.status === 'scheduled' ? 'NOT PLAYED' : 'FINAL')}
      </div>
      <div class="text-rwha-muted/40 font-mono text-xs mt-0.5">Week {data.week} · Game #{data.gameId}</div>
    </div>

    <!-- Home -->
    <div class="flex-1">
      <div class="text-xl font-bold uppercase tracking-widest {homeWon ? 'text-rwha-amber' : 'text-rwha-muted'}">
        {data.homeName}
      </div>
      <div class="text-xs font-mono text-rwha-muted mt-0.5">Home</div>
    </div>
  </div>
</div>

{#if data.status !== 'complete'}
  <div class="card p-8 text-center text-rwha-muted font-mono text-sm">This game hasn't been played yet.</div>
{:else}

<!-- ── Period-by-period + team totals ──────────────────────────────────────── -->
<div class="card mb-5 overflow-x-auto">
  <table class="stat-table">
    <thead>
      <tr>
        <th class="text-left pl-4 w-32">Team</th>
        {#each { length: periods } as _, i}
          <th>{pLabel(i)}</th>
        {/each}
        <th class="text-rwha-amber">TOT</th>
        <th>SOG</th>
        <th>PP</th>
        <th>FO%</th>
        <th>HITS</th>
        <th>BLK</th>
        <th class="pr-4">PIM</th>
      </tr>
    </thead>
    <tbody>
      {#each [
        { name: data.awayName, byPeriod: data.awayByPeriod, sog: data.awaySogPeriod, totals: data.awayStats, won: awayWon },
        { name: data.homeName, byPeriod: data.homeByPeriod, sog: data.homeSogPeriod, totals: data.homeStats, won: homeWon },
      ] as row}
        <tr>
          <td class="name-col pl-4 font-semibold uppercase tracking-wide text-xs {row.won ? 'text-rwha-amber' : ''}">
            {row.name}
          </td>
          {#each { length: periods } as _, i}
            <td>{row.byPeriod[i] ?? 0}</td>
          {/each}
          <td class="font-bold {row.won ? 'text-rwha-amber' : ''}">
            {row.byPeriod.reduce((s, n) => s + n, 0)}
          </td>
          <td>{row.sog.reduce((s, n) => s + n, 0)}</td>
          <td class="text-xs">
            {row.totals ? `${row.totals.ppGoals}/${row.totals.ppOpps}` : '—'}
          </td>
          <td class="text-xs">
            {row.totals && row.totals.faceoffsTotal > 0
              ? fmtPct(row.totals.faceoffsWon / row.totals.faceoffsTotal)
              : '—'}
          </td>
          <td>{row.totals?.hits ?? '—'}</td>
          <td>{row.totals?.blocks ?? '—'}</td>
          <td class="pr-4">{row.totals?.pim ?? '—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<!-- ── Goals ─────────────────────────────────────────────────────────────────── -->
{#if data.goals.length > 0}
  <div class="section-header">Scoring Summary</div>
  <div class="card mb-5 divide-y divide-rwha-border/40">
    {#each data.goals as g}
      <div class="flex items-baseline gap-2 px-4 py-2 text-sm font-mono">
        <span class="text-rwha-muted w-6 text-right shrink-0">{pLabelNum(g.period)}</span>
        <span class="text-rwha-muted w-10 shrink-0">{g.time}</span>
        <span class="text-rwha-amber/80 w-12 shrink-0 uppercase">{g.team.slice(0, 3)}</span>
        <span class="text-rwha-amber font-semibold">
          {g.strength !== 'EV' ? `[${g.strength}] ` : ''}{g.scorer}
          {#if g.emptyNet}<span class="text-rwha-muted text-xs"> (EN)</span>{/if}
          {#if g.gameWinner}<span class="text-rwha-green text-xs"> ★GWG</span>{/if}
        </span>
        {#if g.assists.length > 0}
          <span class="text-rwha-muted">from {g.assists.join(', ')}</span>
        {:else}
          <span class="text-rwha-muted">unassisted</span>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<!-- ── Three stars ─────────────────────────────────────────────────────────── -->
{#if data.threeStars}
  <div class="section-header">Three Stars</div>
  <div class="card mb-5 px-4 py-3 flex gap-6">
    {#each data.threeStars as star}
      <div class="flex items-center gap-2">
        <span class="font-mono text-rwha-amber text-sm font-bold">#{star.rank}</span>
        <div>
          <div class="font-semibold text-sm text-rwha-text">{star.player}</div>
          <div class="text-xs font-mono text-rwha-muted">{star.team} · {star.blurb}</div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<!-- ── Skater stats ─────────────────────────────────────────────────────────── -->
{#each [
  { label: data.awayName + ' Skaters', skaters: awaySkaters },
  { label: data.homeName + ' Skaters', skaters: homeSkaters },
] as section}
  {#if section.skaters.length > 0}
    <div class="section-header">{section.label}</div>
    <div class="card mb-5 overflow-x-auto">
      <table class="stat-table">
        <thead>
          <tr>
            <th class="text-left pl-4">Player</th>
            <th class="w-8">POS</th>
            <th>G</th>
            <th>A</th>
            <th>PTS</th>
            <th>+/−</th>
            <th>SOG</th>
            <th>HIT</th>
            <th>BLK</th>
            <th>PIM</th>
            <th class="pr-4">TOI</th>
          </tr>
        </thead>
        <tbody>
          {#each section.skaters as s}
            <tr>
              <td class="name-col pl-4 text-rwha-text">{s.name}</td>
              <td class="text-rwha-muted text-xs">{s.position}</td>
              <td class="{s.g > 0 ? 'text-rwha-amber font-bold' : ''}">{s.g}</td>
              <td class="{s.a > 0 ? 'text-rwha-text font-semibold' : ''}">{s.a}</td>
              <td class="{s.g + s.a > 0 ? 'text-rwha-amber font-bold' : ''}">{s.g + s.a}</td>
              <td class="{s.plusMinus > 0 ? 'text-rwha-green' : s.plusMinus < 0 ? 'text-rwha-red' : 'text-rwha-muted'}">
                {s.plusMinus > 0 ? '+' : ''}{s.plusMinus}
              </td>
              <td>{s.sog}</td>
              <td>{s.hits}</td>
              <td>{s.blocks}</td>
              <td>{s.pim}</td>
              <td class="pr-4 text-rwha-muted">{s.toi}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/each}

<!-- ── Goalie stats ─────────────────────────────────────────────────────────── -->
{#each [
  { label: data.awayName + ' Goalie', goalies: awayGoalies },
  { label: data.homeName + ' Goalie', goalies: homeGoalies },
] as section}
  {#if section.goalies.length > 0}
    <div class="section-header">{section.label}</div>
    <div class="card mb-5 overflow-x-auto">
      <table class="stat-table">
        <thead>
          <tr>
            <th class="text-left pl-4">Goalie</th>
            <th>DEC</th>
            <th>SA</th>
            <th>GA</th>
            <th>SV%</th>
            <th class="pr-4">TOI</th>
          </tr>
        </thead>
        <tbody>
          {#each section.goalies as g}
            <tr>
              <td class="name-col pl-4 text-rwha-text">{g.name}</td>
              <td>
                {#if g.decision !== '-'}
                  <span class="{decisionBadge(g.decision)}">{g.decision}</span>
                {:else}
                  <span class="text-rwha-muted">—</span>
                {/if}
              </td>
              <td>{g.shotsAgainst}</td>
              <td>{g.goalsAgainst}</td>
              <td class="font-mono">{fmtSvp(g.savePct)}</td>
              <td class="pr-4 text-rwha-muted">{g.toi}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/each}

{/if}<!-- end if complete -->
