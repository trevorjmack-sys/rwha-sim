<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  // ── Trade executor ─────────────────────────────────────────────────────────
  let teamAId: string = String(data.teamAId ?? '');
  let teamBId: string = String(data.teamBId ?? '');

  let selAPlayers = new Set<number>();
  let selBPlayers = new Set<number>();

  function clearSel() {
    selAPlayers = new Set();
    selBPlayers = new Set();
  }

  function onTeamChange() {
    clearSel();
    const p = new URLSearchParams();
    if (teamAId) p.set('teamA', teamAId);
    if (teamBId) p.set('teamB', teamBId);
    goto(`?${p}`, { keepFocus: true });
  }

  function toggleSet(s: Set<number>, id: number): Set<number> {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  }

  $: tradeCount = selAPlayers.size + selBPlayers.size;
  $: tradedBanner = data.traded;
</script>

<svelte:head><title>Trade Manager — RWHA Sim</title></svelte:head>

<!-- Header -->
<div class="mb-5 flex items-center justify-between gap-4">
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">
    Trade Manager
  </h1>
  <a href="/admin" class="text-xs font-mono text-rwha-muted hover:text-rwha-amber transition-colors">← Admin</a>
</div>

{#if tradedBanner}
  <div class="mb-4 px-4 py-3 rounded border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-sm">
    ✓ Trade executed — {tradedBanner} player{tradedBanner === 1 ? '' : 's'} moved.
  </div>
{/if}

<!-- Team selectors -->
<div class="card mb-4 px-4 py-3 flex flex-wrap gap-4 items-end">
  <div class="flex flex-col gap-1 flex-1 min-w-[180px]">
    <label class="font-mono text-xs text-rwha-muted uppercase tracking-wider">Team A</label>
    <select bind:value={teamAId} on:change={onTeamChange}
            class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-sm font-mono text-rwha-text
                   focus:outline-none focus:border-rwha-amber/50">
      <option value="">— select team —</option>
      {#each data.teams as t}
        <option value={t.id} disabled={String(t.id) === teamBId}>{t.name}</option>
      {/each}
    </select>
  </div>
  <div class="font-mono text-rwha-muted text-xl pb-1">⇄</div>
  <div class="flex flex-col gap-1 flex-1 min-w-[180px]">
    <label class="font-mono text-xs text-rwha-muted uppercase tracking-wider">Team B</label>
    <select bind:value={teamBId} on:change={onTeamChange}
            class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-sm font-mono text-rwha-text
                   focus:outline-none focus:border-rwha-amber/50">
      <option value="">— select team —</option>
      {#each data.teams as t}
        <option value={t.id} disabled={String(t.id) === teamAId}>{t.name}</option>
      {/each}
    </select>
  </div>
</div>

{#if data.teamAData && data.teamBData}
  <!-- Trade form -->
  <form method="POST" action="?/executeTrade">
    <input type="hidden" name="team_a_id" value={data.teamAData.id}>
    <input type="hidden" name="team_b_id" value={data.teamBData.id}>
    {#each [...selAPlayers] as id}<input type="hidden" name="a_player" value={id}>{/each}
    {#each [...selBPlayers] as id}<input type="hidden" name="b_player" value={id}>{/each}

    <!-- Two-column asset selector -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
      {#each [
        { team: data.teamAData, sel: selAPlayers, side: 'A' as const },
        { team: data.teamBData, sel: selBPlayers, side: 'B' as const },
      ] as col}
        <div class="card overflow-hidden">
          <!-- Team header -->
          <div class="px-4 py-2 border-b border-rwha-border bg-rwha-amber/5 flex items-center justify-between">
            <span class="font-mono font-bold text-rwha-amber text-sm">{col.team.name}</span>
            <span class="font-mono text-xs text-rwha-muted">{col.team.abbrev} · {col.team.gm_name}</span>
          </div>

          <!-- Pro Roster -->
          {#if col.team.players.filter(p => p.roster_level === 'pro').length > 0}
            <div class="px-3 pt-2 pb-1">
              <div class="text-xs font-mono text-rwha-muted uppercase tracking-wider mb-1">Pro Roster</div>
              {#each col.team.players.filter(p => p.roster_level === 'pro') as p}
                <label class="flex items-center gap-2 py-0.5 cursor-pointer group">
                  <input type="checkbox"
                    checked={col.sel.has(p.id)}
                    on:change={() => {
                      if (col.side === 'A') selAPlayers = toggleSet(selAPlayers, p.id);
                      else selBPlayers = toggleSet(selBPlayers, p.id);
                    }}
                    class="accent-amber-400 w-3.5 h-3.5 shrink-0">
                  <span class="text-xs font-mono
                    {col.sel.has(p.id) ? 'text-rwha-amber' : 'text-rwha-text group-hover:text-rwha-amber/80'}
                    transition-colors">
                    {p.name}
                    <span class="text-rwha-muted ml-1">{p.is_goalie ? 'G' : p.position} · {p.ov}</span>
                  </span>
                </label>
              {/each}
            </div>
          {/if}

          <!-- Farm Roster -->
          {#if col.team.players.filter(p => p.roster_level === 'farm').length > 0}
            <details class="px-3 pt-2 pb-1">
              <summary class="text-xs font-mono text-rwha-muted uppercase tracking-wider mb-1 cursor-pointer hover:text-rwha-amber transition-colors">
                Farm Roster ({col.team.players.filter(p => p.roster_level === 'farm').length}) ▸
              </summary>
              {#each col.team.players.filter(p => p.roster_level === 'farm') as p}
                <label class="flex items-center gap-2 py-0.5 cursor-pointer group">
                  <input type="checkbox"
                    checked={col.sel.has(p.id)}
                    on:change={() => {
                      if (col.side === 'A') selAPlayers = toggleSet(selAPlayers, p.id);
                      else selBPlayers = toggleSet(selBPlayers, p.id);
                    }}
                    class="accent-amber-400 w-3.5 h-3.5 shrink-0">
                  <span class="text-xs font-mono text-rwha-muted
                    {col.sel.has(p.id) ? '!text-rwha-amber' : 'group-hover:text-rwha-text'}
                    transition-colors">
                    {p.name}
                    <span class="ml-1">{p.is_goalie ? 'G' : p.position} · {p.ov}</span>
                  </span>
                </label>
              {/each}
            </details>
          {/if}

          {#if col.team.players.length === 0}
            <div class="px-4 py-3 text-xs font-mono text-rwha-muted italic">No players.</div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Trade preview + submit -->
    {#if tradeCount > 0}
      <div class="card px-4 py-3 mb-3 border-rwha-amber/30 bg-rwha-amber/5">
        <div class="font-mono text-xs text-rwha-muted uppercase tracking-wider mb-2">Trade Preview</div>
        <div class="grid grid-cols-2 gap-4 text-xs font-mono mb-3">
          <div>
            <div class="text-rwha-amber font-bold mb-1">{data.teamAData.name} sends:</div>
            {#each [...selAPlayers] as id}
              {@const p = data.teamAData.players.find(x => x.id === id)}
              {#if p}<div class="text-rwha-text">· {p.name} <span class="text-rwha-muted">({p.is_goalie ? 'G' : p.position})</span></div>{/if}
            {/each}
            {#if selAPlayers.size === 0}<div class="text-rwha-muted italic">nothing</div>{/if}
          </div>
          <div>
            <div class="text-rwha-amber font-bold mb-1">{data.teamBData.name} sends:</div>
            {#each [...selBPlayers] as id}
              {@const p = data.teamBData.players.find(x => x.id === id)}
              {#if p}<div class="text-rwha-text">· {p.name} <span class="text-rwha-muted">({p.is_goalie ? 'G' : p.position})</span></div>{/if}
            {/each}
            {#if selBPlayers.size === 0}<div class="text-rwha-muted italic">nothing</div>{/if}
          </div>
        </div>
        <button type="submit"
          class="px-4 py-2 bg-rwha-amber text-rwha-bg font-mono font-bold text-xs rounded
                 hover:bg-rwha-amber/80 transition-colors uppercase tracking-wider">
          Execute Trade ({tradeCount} player{tradeCount === 1 ? '' : 's'})
        </button>
      </div>
    {:else}
      <div class="text-xs font-mono text-rwha-muted italic">Check players on each side to build a trade.</div>
    {/if}
  </form>

{:else}
  <div class="text-xs font-mono text-rwha-muted italic mt-2">
    Select both teams above to begin building a trade.
  </div>
{/if}
