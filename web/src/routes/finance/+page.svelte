<script lang="ts">
  import type { PageData } from './$types';
  import { fmtCap, fmtSpace, RWHA_CAP, RWHA_FLOOR, NHL_CAP, NHL_FLOOR, CAP_FACTOR_DISPLAY } from '$lib/cap';
  export let data: PageData;

  // ── Expand/collapse team rows ─────────────────────────────────────────────────
  let expanded = new Set<number>();
  function toggle(id: number) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    expanded = expanded; // trigger reactivity
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function fmtSal(s: number | null) {
    if (!s) return '—';
    return '$' + s.toLocaleString('en-US');
  }

  function statusClass(s: 'over' | 'under' | 'ok') {
    if (s === 'over')  return 'text-rwha-red font-bold';
    if (s === 'under') return 'text-rwha-amber font-bold';
    return 'text-rwha-green';
  }

  function statusLabel(s: 'over' | 'under' | 'ok') {
    if (s === 'over')  return 'OVER CAP';
    if (s === 'under') return 'UNDER FLOOR';
    return '✓';
  }

  function barWidth(hit: number, cap: number) {
    const pct = Math.min((hit / cap) * 100, 110); // allow slight overflow
    return `${pct.toFixed(1)}%`;
  }

  function barColor(s: 'over' | 'under' | 'ok') {
    if (s === 'over')  return 'bg-rwha-red';
    if (s === 'under') return 'bg-rwha-amber/60';
    return 'bg-rwha-green/70';
  }

  // ── Summary counts ────────────────────────────────────────────────────────────
  $: overCount  = data.teams.filter(t => t.status === 'over').length;
  $: underCount = data.teams.filter(t => t.status === 'under').length;
  $: okCount    = data.teams.filter(t => t.status === 'ok').length;
</script>

<svelte:head><title>Finance — RWHA Sim</title></svelte:head>

<!-- ── Cap banner ─────────────────────────────────────────────────────────────── -->
<div class="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">

  <!-- Cap -->
  <div class="card px-4 py-3">
    <div class="font-mono text-xs text-rwha-muted uppercase tracking-wider">Salary Cap</div>
    <div class="font-mono font-bold text-rwha-amber text-2xl mt-1">{fmtCap(RWHA_CAP)}</div>
    <div class="font-mono text-xs text-rwha-muted mt-1">
      NHL ${(NHL_CAP/1_000_000).toFixed(1)}M × {CAP_FACTOR_DISPLAY}
    </div>
  </div>

  <!-- Floor -->
  <div class="card px-4 py-3">
    <div class="font-mono text-xs text-rwha-muted uppercase tracking-wider">Salary Floor</div>
    <div class="font-mono font-bold text-rwha-amber text-2xl mt-1">{fmtCap(RWHA_FLOOR)}</div>
    <div class="font-mono text-xs text-rwha-muted mt-1">
      NHL ${(NHL_FLOOR/1_000_000).toFixed(1)}M × {CAP_FACTOR_DISPLAY}
    </div>
  </div>

  <!-- Status summary -->
  <div class="card px-4 py-3">
    <div class="font-mono text-xs text-rwha-muted uppercase tracking-wider mb-2">League Status</div>
    <div class="flex gap-4 font-mono text-sm">
      <span><span class="text-rwha-green font-bold">{okCount}</span> <span class="text-rwha-muted">compliant</span></span>
      <span><span class="text-rwha-amber font-bold">{underCount}</span> <span class="text-rwha-muted">under floor</span></span>
      <span><span class="text-rwha-red font-bold">{overCount}</span> <span class="text-rwha-muted">over cap</span></span>
    </div>
    <div class="font-mono text-xs text-rwha-muted mt-2">Farm salaries excluded from cap</div>
  </div>

</div>

<!-- ── Team cap table ─────────────────────────────────────────────────────────── -->
<div class="section-header">Team Cap Hits — Pro Roster</div>
<div class="card overflow-hidden">
  {#each data.teams as t (t.team_id)}
    {@const isOpen = expanded.has(t.team_id)}

    <!-- Team row -->
    <div
      class="border-b border-rwha-border last:border-0 cursor-pointer hover:bg-rwha-border/10 transition-colors"
      on:click={() => toggle(t.team_id)}
      role="button"
      tabindex="0"
      on:keydown={e => e.key === 'Enter' && toggle(t.team_id)}
      aria-expanded={isOpen}
    >
      <div class="px-4 py-3 flex items-center gap-4 flex-wrap">

        <!-- Expand chevron -->
        <span class="font-mono text-xs text-rwha-muted w-3 shrink-0 transition-transform
                     {isOpen ? 'rotate-90' : ''}">▶</span>

        <!-- Team + GM -->
        <div class="min-w-[160px]">
          <a href="/teams/{t.team_name.toLowerCase()}"
             class="font-semibold text-rwha-text hover:text-rwha-amber transition-colors"
             on:click|stopPropagation>
            {t.team_name}
          </a>
          <div class="font-mono text-xs text-rwha-muted">{t.gm_name}</div>
        </div>

        <!-- Pro cap hit -->
        <div class="min-w-[110px]">
          <div class="font-mono text-xs text-rwha-muted">Pro Cap Hit</div>
          <div class="font-mono font-bold text-rwha-text">{fmtCap(t.pro_cap_hit)}</div>
        </div>

        <!-- Cap space -->
        <div class="min-w-[100px]">
          <div class="font-mono text-xs text-rwha-muted">Cap Space</div>
          <div class="font-mono font-bold {t.cap_space >= 0 ? 'text-rwha-green' : 'text-rwha-red'}">
            {fmtSpace(t.cap_space)}
          </div>
        </div>

        <!-- Floor status -->
        <div class="min-w-[100px]">
          <div class="font-mono text-xs text-rwha-muted">vs Floor</div>
          <div class="font-mono font-bold {t.floor_space >= 0 ? 'text-rwha-muted' : 'text-rwha-amber'}">
            {t.floor_space >= 0 ? fmtSpace(t.floor_space) + ' above' : fmtSpace(t.floor_space) + ' below'}
          </div>
        </div>

        <!-- Farm payroll (info only) -->
        <div class="min-w-[100px] hidden lg:block">
          <div class="font-mono text-xs text-rwha-muted">Farm Payroll</div>
          <div class="font-mono text-rwha-muted/70">{fmtCap(t.farm_payroll)}</div>
        </div>

        <!-- Status badge -->
        <div class="ml-auto">
          <span class="font-mono text-xs uppercase tracking-wider {statusClass(t.status)}">
            {statusLabel(t.status)}
          </span>
        </div>
      </div>

      <!-- Cap bar -->
      <div class="px-4 pb-3 -mt-1">
        <div class="h-1.5 rounded-full bg-rwha-border/40 overflow-hidden relative">
          <!-- Floor marker line -->
          <div class="absolute top-0 bottom-0 w-px bg-rwha-amber/40"
               style="left: {((RWHA_FLOOR / RWHA_CAP) * 100).toFixed(1)}%"></div>
          <!-- Cap hit bar -->
          <div class="h-full rounded-full transition-all {barColor(t.status)}"
               style="width: {barWidth(t.pro_cap_hit, RWHA_CAP)}"></div>
        </div>
        <div class="flex justify-between font-mono text-[10px] text-rwha-muted/50 mt-0.5">
          <span>$0</span>
          <span class="text-rwha-amber/40">Floor</span>
          <span>Cap {fmtCap(RWHA_CAP)}</span>
        </div>
      </div>
    </div>

    <!-- Expanded player list -->
    {#if isOpen}
      <div class="bg-rwha-bg border-b border-rwha-border">

        <!-- Pro roster -->
        <div class="px-4 pt-3 pb-1">
          <div class="font-mono text-xs text-rwha-amber uppercase tracking-wider mb-2">
            Pro Roster — {t.pro_players.length} players · {fmtCap(t.pro_cap_hit)} cap hit
            {#if t.pro_missing > 0}
              <span class="text-rwha-red ml-2">({t.pro_missing} missing salary data)</span>
            {/if}
          </div>
          <table class="w-full text-xs font-mono">
            <thead>
              <tr class="text-rwha-muted border-b border-rwha-border/40">
                <th class="text-left pb-1 pr-4 min-w-[140px]">Player</th>
                <th class="text-left pb-1 pr-3 w-12">Pos</th>
                <th class="text-left pb-1 pr-3 w-8">OV</th>
                <th class="text-right pb-1 pr-4 w-28">Salary</th>
                <th class="text-right pb-1 pr-2 w-10">Yrs</th>
              </tr>
            </thead>
            <tbody>
              {#each t.pro_players as p (p.id)}
                <tr class="border-b border-rwha-border/20 last:border-0">
                  <td class="py-1 pr-4 text-rwha-text font-semibold">
                    {p.name}
                    {#if p.is_goalie}<span class="text-rwha-muted ml-1 font-normal">G</span>{/if}
                  </td>
                  <td class="pr-3 text-rwha-muted">{p.is_goalie ? 'G' : p.position.replace(/\//g, ',')}</td>
                  <td class="pr-3 text-rwha-amber">{p.ov}</td>
                  <td class="text-right pr-4 {p.salary ? 'text-rwha-text' : 'text-rwha-muted/40'}">
                    {fmtSal(p.salary)}
                  </td>
                  <td class="text-right pr-2 text-rwha-muted">{p.contract_yrs ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Farm roster (informational) -->
        {#if t.farm_players.length > 0}
          <div class="px-4 pt-2 pb-3">
            <div class="font-mono text-xs text-rwha-muted uppercase tracking-wider mb-2">
              Farm Roster — {t.farm_players.length} players · {fmtCap(t.farm_payroll)}
              <span class="normal-case ml-1 text-rwha-muted/60">(does not count toward cap)</span>
            </div>
            <table class="w-full text-xs font-mono">
              <tbody>
                {#each t.farm_players as p (p.id)}
                  <tr class="border-b border-rwha-border/20 last:border-0">
                    <td class="py-0.5 pr-4 text-rwha-muted min-w-[140px]">{p.name}</td>
                    <td class="pr-3 text-rwha-muted/60 w-12">{p.is_goalie ? 'G' : p.position.replace(/\//g, ',')}</td>
                    <td class="pr-3 text-rwha-muted/60 w-8">{p.ov}</td>
                    <td class="text-right pr-4 text-rwha-muted/60 w-28">{fmtSal(p.salary)}</td>
                    <td class="text-right pr-2 text-rwha-muted/60 w-10">{p.contract_yrs ?? '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

      </div>
    {/if}

  {/each}
</div>

<!-- ── Footer note ────────────────────────────────────────────────────────────── -->
<div class="mt-4 font-mono text-xs text-rwha-muted flex gap-2 flex-wrap">
  <span>Formula: NHL Cap / Floor × (32÷22 = {CAP_FACTOR_DISPLAY})</span>
  <span class="text-rwha-border">·</span>
  <span>Farm salaries excluded · Pro scratches count toward cap</span>
  <span class="text-rwha-border">·</span>
  <span>Contracts synced from Puckpedia at season start</span>
</div>
