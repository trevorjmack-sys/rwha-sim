<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';
  export let data: PageData;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function x(pos: string, check: string) {
    return pos.split('/').includes(check) ? 'X' : '';
  }
  function fmtSal(s: number | null) {
    if (!s) return '—';
    return '$' + s.toLocaleString('en-US');
  }
  function fmtCon(inj: number) {
    return inj > 0 ? (100 - inj * 5).toFixed(2) : '100.00';
  }
  function a(attrs: Record<string, number>, key: string) {
    return attrs[key] ?? '—';
  }
  function attrClass(v: unknown) {
    const n = Number(v);
    if (n >= 90) return 'text-rwha-amber font-bold';
    if (n >= 80) return 'text-rwha-text';
    return 'text-rwha-muted';
  }
  function parseAttrs(json: string): Record<string, number> {
    try { return JSON.parse(json); } catch { return {}; }
  }

  const SKATER_COLS = ['ck','fg','di','sk','st','en','du','ph','fo','pa','sc','df','ps','ex','ld','po','mo'] as const;
  const GOALIE_COLS = ['sk','du','en','sz','ag','rb','sc','hs','rt','ph','ps','ex','ld','po','mo'] as const;

  // ── Derived groups ──────────────────────────────────────────────────────────
  function isD(pos: string) { return pos.split('/').includes('D'); }

  $: proSkaters  = [
    ...data.players.filter(p => p.roster_level === 'pro' && !p.is_goalie && !isD(p.position)),
    ...data.players.filter(p => p.roster_level === 'pro' && !p.is_goalie &&  isD(p.position)),
  ];
  $: proGoalies  = data.players.filter(p => p.roster_level === 'pro'  && !!p.is_goalie);
  $: farmSkaters = [
    ...data.players.filter(p => p.roster_level === 'farm' && !p.is_goalie && !isD(p.position)),
    ...data.players.filter(p => p.roster_level === 'farm' && !p.is_goalie &&  isD(p.position)),
  ];
  $: farmGoalies = data.players.filter(p => p.roster_level === 'farm' && !!p.is_goalie);

  $: activePro     = data.players.filter(p => p.roster_level === 'pro' && !p.is_scratch);
  $: activeSkaters = activePro.filter(p => !p.is_goalie).length;
  $: activeGoalies = activePro.filter(p =>  p.is_goalie).length;
  $: scratchCount  = data.players.filter(p => p.roster_level === 'pro' && p.is_scratch).length;
</script>

<svelte:head><title>My Roster — RWHA Sim</title></svelte:head>

<!-- Summary bar -->
<div class="mb-4 flex gap-4 font-mono text-xs text-rwha-muted">
  <span>Active: <span class="text-rwha-text font-semibold">{activeSkaters}</span> skaters · <span class="text-rwha-text font-semibold">{activeGoalies}</span> goalies</span>
  <span class="text-rwha-border">|</span>
  <span>Scratched: <span class="{scratchCount > 0 ? 'text-rwha-amber' : 'text-rwha-muted'} font-semibold">{scratchCount}</span></span>
</div>

<!-- ── Pro Skaters ─────────────────────────────────────────────────────────── -->
<div class="section-header">Pro Roster</div>
<div class="card mb-3 overflow-x-auto">
  <table class="stat-table text-xs whitespace-nowrap">
    <thead>
      <tr class="border-b border-rwha-border">
        <th class="pl-3 w-8 sticky left-0 bg-rwha-surface">SCR</th>
        <th class="text-left pl-2 sticky left-8 bg-rwha-surface min-w-[150px]">Player</th>
        <th class="w-5">C</th><th class="w-5">L</th><th class="w-5">R</th><th class="w-5">D</th>
        <th>CON</th><th>IJ</th>
        {#each SKATER_COLS as col}<th class="uppercase">{col}</th>{/each}
        <th class="text-rwha-amber">OV</th>
        <th>Age</th><th>Yrs</th><th class="pr-3">Salary</th>
      </tr>
    </thead>
    <tbody>
      {#each proSkaters as p (p.id)}
        {@const attrs = parseAttrs(p.attrs)}
        <tr class="{p.is_scratch ? 'opacity-40' : ''} {p.injured_games_remaining > 0 ? 'bg-rwha-red/5' : ''}">
          <!-- Scratch toggle -->
          <td class="pl-3 sticky left-0 bg-rwha-surface">
            <form method="POST" action="?/scratch" use:enhance>
              <input type="hidden" name="playerId" value={p.id} />
              <input type="hidden" name="scratch"  value={p.is_scratch ? '0' : '1'} />
              <button
                type="submit"
                title="{p.is_scratch ? 'Un-scratch' : 'Scratch'}"
                class="w-5 h-5 rounded border flex items-center justify-center transition-colors
                       {p.is_scratch
                         ? 'border-rwha-amber bg-rwha-amber/20 text-rwha-amber'
                         : 'border-rwha-border/60 text-rwha-muted hover:border-rwha-amber/50'}"
              >{#if p.is_scratch}<span class="text-xs leading-none">✕</span>{/if}</button>
            </form>
          </td>
          <!-- Name -->
          <td class="text-left pl-2 sticky left-8 bg-rwha-surface font-semibold
                     {p.is_scratch ? 'line-through text-rwha-muted' : 'text-rwha-text'}">
            {p.name}
            {#if p.injured_games_remaining > 0}
              <span class="text-rwha-red ml-1 font-normal not-italic">(INJ)</span>
            {/if}
          </td>
          <td class="text-rwha-amber font-bold">{x(p.position, 'C')}</td>
          <td class="text-rwha-amber font-bold">{x(p.position, 'L')}</td>
          <td class="text-rwha-amber font-bold">{x(p.position, 'R')}</td>
          <td class="text-rwha-amber font-bold">{x(p.position, 'D')}</td>
          <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
          <td class="{p.injured_games_remaining > 0 ? 'text-rwha-red font-bold' : 'text-rwha-muted'}">
            {p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}
          </td>
          {#each SKATER_COLS as col}
            <td class="{attrClass(attrs[col])}">{a(attrs, col)}</td>
          {/each}
          <td class="text-rwha-amber font-bold">{p.ov}</td>
          <td class="text-rwha-muted">{p.age ?? '—'}</td>
          <td class="text-rwha-muted">{p.contract_yrs ?? '—'}</td>
          <td class="pr-3 text-rwha-muted">{fmtSal(p.salary)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<!-- ── Pro Goalies ─────────────────────────────────────────────────────────── -->
{#if proGoalies.length > 0}
  <div class="card mb-5 overflow-x-auto">
    <table class="stat-table text-xs whitespace-nowrap">
      <thead>
        <tr class="border-b border-rwha-border">
          <th class="pl-3 w-8 sticky left-0 bg-rwha-surface">SCR</th>
          <th class="text-left pl-2 sticky left-8 bg-rwha-surface min-w-[150px]">Goalie</th>
          <th>PO</th><th>CON</th><th>IJ</th>
          {#each GOALIE_COLS as col}<th class="uppercase">{col}</th>{/each}
          <th class="text-rwha-amber">OV</th>
          <th>Age</th><th>Yrs</th><th class="pr-3">Salary</th>
        </tr>
      </thead>
      <tbody>
        {#each proGoalies as p (p.id)}
          {@const attrs = parseAttrs(p.attrs)}
          <tr class="{p.is_scratch ? 'opacity-40' : ''} {p.injured_games_remaining > 0 ? 'bg-rwha-red/5' : ''}">
            <td class="pl-3 sticky left-0 bg-rwha-surface">
              <form method="POST" action="?/scratch" use:enhance>
                <input type="hidden" name="playerId" value={p.id} />
                <input type="hidden" name="scratch"  value={p.is_scratch ? '0' : '1'} />
                <button type="submit" title="{p.is_scratch ? 'Un-scratch' : 'Scratch'}"
                  class="w-5 h-5 rounded border flex items-center justify-center transition-colors
                         {p.is_scratch ? 'border-rwha-amber bg-rwha-amber/20 text-rwha-amber' : 'border-rwha-border/60 text-rwha-muted hover:border-rwha-amber/50'}"
                >{#if p.is_scratch}<span class="text-xs leading-none">✕</span>{/if}</button>
              </form>
            </td>
            <td class="text-left pl-2 sticky left-8 bg-rwha-surface font-semibold
                       {p.is_scratch ? 'line-through text-rwha-muted' : 'text-rwha-text'}">
              {p.name}
              {#if p.injured_games_remaining > 0}<span class="text-rwha-red ml-1 font-normal">(INJ)</span>{/if}
            </td>
            <td class="text-rwha-muted">G</td>
            <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
            <td class="{p.injured_games_remaining > 0 ? 'text-rwha-red font-bold' : 'text-rwha-muted'}">
              {p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}
            </td>
            {#each GOALIE_COLS as col}
              <td class="{attrClass(attrs[col])}">{a(attrs, col)}</td>
            {/each}
            <td class="text-rwha-amber font-bold">{p.ov}</td>
            <td class="text-rwha-muted">{p.age ?? '—'}</td>
            <td class="text-rwha-muted">{p.contract_yrs ?? '—'}</td>
            <td class="pr-3 text-rwha-muted">{fmtSal(p.salary)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<!-- ── Farm Roster ─────────────────────────────────────────────────────────── -->
{#if farmSkaters.length > 0 || farmGoalies.length > 0}
  <details>
    <summary class="section-header cursor-pointer select-none hover:text-rwha-amber/80 transition-colors mb-2">
      Farm Roster ▸
    </summary>

    <div class="card mb-3 overflow-x-auto">
      <table class="stat-table text-xs whitespace-nowrap">
        <thead>
          <tr class="border-b border-rwha-border">
            <th class="text-left pl-3 sticky left-0 bg-rwha-surface w-6">#</th>
            <th class="text-left pl-2 sticky left-6 bg-rwha-surface min-w-[150px]">Player</th>
            <th class="w-5">C</th><th class="w-5">L</th><th class="w-5">R</th><th class="w-5">D</th>
            <th>CON</th><th>IJ</th>
            {#each SKATER_COLS as col}<th class="uppercase">{col}</th>{/each}
            <th class="text-rwha-amber">OV</th>
            <th>Age</th><th>Yrs</th><th class="pr-3">Salary</th>
          </tr>
        </thead>
        <tbody>
          {#each farmSkaters as p, i (p.id)}
            {@const attrs = parseAttrs(p.attrs)}
            <tr>
              <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">{i + 1}</td>
              <td class="text-left pl-2 sticky left-6 bg-rwha-surface text-rwha-muted">{p.name}</td>
              <td class="text-rwha-muted">{x(p.position, 'C')}</td>
              <td class="text-rwha-muted">{x(p.position, 'L')}</td>
              <td class="text-rwha-muted">{x(p.position, 'R')}</td>
              <td class="text-rwha-muted">{x(p.position, 'D')}</td>
              <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
              <td class="text-rwha-muted">{p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}</td>
              {#each SKATER_COLS as col}
                <td class="text-rwha-muted/70">{a(attrs, col)}</td>
              {/each}
              <td class="text-rwha-amber/60 font-bold">{p.ov}</td>
              <td class="text-rwha-muted">{p.age ?? '—'}</td>
              <td class="text-rwha-muted">{p.contract_yrs ?? '—'}</td>
              <td class="pr-3 text-rwha-muted">{fmtSal(p.salary)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if farmGoalies.length > 0}
      <div class="card mb-3 overflow-x-auto">
        <table class="stat-table text-xs whitespace-nowrap">
          <thead>
            <tr class="border-b border-rwha-border">
              <th class="pl-3 w-6 sticky left-0 bg-rwha-surface">PO</th>
              <th class="text-left pl-2 sticky left-6 bg-rwha-surface min-w-[150px]">Goalie</th>
              <th>CON</th><th>IJ</th>
              {#each GOALIE_COLS as col}<th class="uppercase">{col}</th>{/each}
              <th class="text-rwha-amber">OV</th>
              <th>Age</th><th>Yrs</th><th class="pr-3">Salary</th>
            </tr>
          </thead>
          <tbody>
            {#each farmGoalies as p (p.id)}
              {@const attrs = parseAttrs(p.attrs)}
              <tr>
                <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">G</td>
                <td class="text-left pl-2 sticky left-6 bg-rwha-surface text-rwha-muted">{p.name}</td>
                <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
                <td class="text-rwha-muted">{p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}</td>
                {#each GOALIE_COLS as col}
                  <td class="text-rwha-muted/70">{a(attrs, col)}</td>
                {/each}
                <td class="text-rwha-amber/60 font-bold">{p.ov}</td>
                <td class="text-rwha-muted">{p.age ?? '—'}</td>
                <td class="text-rwha-muted">{p.contract_yrs ?? '—'}</td>
                <td class="pr-3 text-rwha-muted">{fmtSal(p.salary)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </details>
{/if}
