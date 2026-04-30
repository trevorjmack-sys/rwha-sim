<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';
  export let data: PageData;

  // ── Derived groups ─────────────────────────────────────────────────────────
  // Positions in DB are STHS multi-value strings: C/L, C/R, L/R, D, LD, RD, G etc.
  function isDefense(pos: string)  { return /^[LR]?D$/.test(pos) || pos === 'D'; }
  function isForward(pos: string)  { return !isDefense(pos); }

  $: forwards  = data.players.filter(p => !p.is_goalie && isForward(p.position));
  $: defense   = data.players.filter(p => !p.is_goalie && isDefense(p.position));
  $: goalies   = data.players.filter(p => !!p.is_goalie);

  // ── Attrs ──────────────────────────────────────────────────────────────────
  function parseAttrs(json: string): Record<string, number> {
    try { return JSON.parse(json); } catch { return {}; }
  }
  const SKATER_ATTRS = ['sk','sc','pa','fo','df','ck'];
  const GOALIE_ATTRS = ['sk','sz','rb','rt','sc','du'];
  $: proPlayers  = data.players.filter(p => p.roster_level === 'pro');
  $: farmPlayers = data.players.filter(p => p.roster_level === 'farm');

  // Count active (non-scratch) pro skaters + goalies
  $: activePro = proPlayers.filter(p => !p.is_scratch);
  $: activeSkaters = activePro.filter(p => !p.is_goalie).length;
  $: activeGoalies = activePro.filter(p =>  p.is_goalie).length;

  function fmtSal(s: number | null) {
    if (!s) return '—';
    return '$' + (s / 1_000_000).toFixed(2) + 'M';
  }
</script>

<svelte:head><title>Roster — RWHA Sim</title></svelte:head>

<!-- Active roster summary -->
<div class="mb-4 flex gap-4 font-mono text-xs text-rwha-muted">
  <span>Pro active: <span class="text-rwha-text font-semibold">{activeSkaters}</span> skaters · <span class="text-rwha-text font-semibold">{activeGoalies}</span> goalies</span>
  <span class="text-rwha-border">|</span>
  <span>Scratched: <span class="{proPlayers.filter(p=>p.is_scratch).length > 0 ? 'text-rwha-amber' : 'text-rwha-muted'} font-semibold">{proPlayers.filter(p=>p.is_scratch).length}</span></span>
</div>

<!-- ── Player groups ─────────────────────────────────────────────────────────── -->
{#each [
  { label: 'Forwards', group: forwards.filter(p => p.roster_level === 'pro') },
  { label: 'Defense',  group: defense.filter(p => p.roster_level === 'pro')  },
  { label: 'Goalies',  group: goalies.filter(p => p.roster_level === 'pro')  },
] as section}
  {#if section.group.length > 0}
    <div class="section-header">{section.label}</div>
    <div class="card mb-4 divide-y divide-rwha-border/40">
      {#each section.group as p (p.id)}
        <div class="flex items-center gap-3 px-4 py-2.5
                    {p.is_scratch ? 'opacity-50' : ''}
                    {p.injured_games_remaining > 0 ? 'bg-rwha-red/5' : ''}">

          <!-- Scratch toggle -->
          <form method="POST" action="?/scratch" use:enhance class="shrink-0">
            <input type="hidden" name="playerId" value={p.id} />
            <input type="hidden" name="scratch"  value={p.is_scratch ? '0' : '1'} />
            <button
              type="submit"
              class="w-5 h-5 rounded border flex items-center justify-center transition-colors
                     {p.is_scratch
                       ? 'border-rwha-amber bg-rwha-amber/20 text-rwha-amber'
                       : 'border-rwha-border/60 text-rwha-muted hover:border-rwha-amber/50'}"
              title="{p.is_scratch ? 'Un-scratch' : 'Scratch'}"
            >
              {#if p.is_scratch}<span class="text-xs leading-none">✕</span>{/if}
            </button>
          </form>

          <!-- Position badge -->
          <span class="text-xs font-mono text-rwha-muted w-7 shrink-0">{p.position}</span>

          <!-- Name + attrs -->
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm {p.is_scratch ? 'line-through text-rwha-muted' : 'text-rwha-text'}">
              {p.name}
            </div>
            {#if !p.is_scratch}
              {@const attrs = parseAttrs(p.attrs)}
              {@const keys  = p.is_goalie ? GOALIE_ATTRS : SKATER_ATTRS}
              <div class="flex gap-2 mt-0.5">
                {#each keys as k}
                  {#if attrs[k] != null}
                    <span class="font-mono text-xs text-rwha-muted">
                      <span class="text-rwha-muted/50 uppercase">{k}</span><span class="text-rwha-text/70">{attrs[k]}</span>
                    </span>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>

          <!-- OV -->
          <span class="font-mono text-sm font-bold text-rwha-amber w-8 text-right shrink-0">{p.ov}</span>

          <!-- Age -->
          <span class="font-mono text-xs text-rwha-muted w-6 text-right shrink-0">{p.age ?? '—'}</span>

          <!-- Salary -->
          <span class="font-mono text-xs text-rwha-muted w-16 text-right shrink-0 hidden sm:block">
            {fmtSal(p.salary)}
          </span>

          <!-- Status badges -->
          <div class="w-16 text-right shrink-0">
            {#if p.injured_games_remaining > 0}
              <span class="badge-l text-xs">INJ {p.injured_games_remaining}g</span>
            {:else if p.is_scratch}
              <span class="badge-ot text-xs">SCR</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/each}

<!-- ── Farm roster (read-only) ──────────────────────────────────────────────── -->
{#if farmPlayers.length > 0}
  <details class="mt-2">
    <summary class="section-header cursor-pointer select-none hover:text-rwha-amber/80 transition-colors">
      Farm Roster ({farmPlayers.length} players) ▸
    </summary>
    <div class="card mt-2 divide-y divide-rwha-border/40">
      {#each farmPlayers as p (p.id)}
        <div class="flex items-center gap-3 px-4 py-2 {p.injured_games_remaining > 0 ? 'opacity-50' : ''}">
          <span class="text-xs font-mono text-rwha-muted w-7 shrink-0">{p.position}</span>
          <span class="text-sm flex-1 text-rwha-muted">{p.name}</span>
          <span class="font-mono text-sm font-bold text-rwha-amber/60 w-8 text-right shrink-0">{p.ov}</span>
          <span class="font-mono text-xs text-rwha-muted/50 w-6 text-right shrink-0">{p.age ?? '—'}</span>
          {#if p.injured_games_remaining > 0}
            <span class="badge-l text-xs">INJ</span>
          {/if}
        </div>
      {/each}
    </div>
  </details>
{/if}
