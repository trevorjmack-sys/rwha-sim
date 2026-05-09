<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  // ── Tabs ───────────────────────────────────────────────────────────────────
  let activeTab: 'trade' | 'prospects' | 'picks' = 'trade';

  // ── Trade executor ─────────────────────────────────────────────────────────
  let teamAId: string = String(data.teamAId ?? '');
  let teamBId: string = String(data.teamBId ?? '');

  // Selections (what each team is giving up)
  let selAPlayers   = new Set<number>();
  let selBPlayers   = new Set<number>();
  let selAProspects = new Set<number>();
  let selBProspects = new Set<number>();
  let selAPicks     = new Set<number>();
  let selBPicks     = new Set<number>();

  function clearSel() {
    selAPlayers = new Set(); selBPlayers = new Set();
    selAProspects = new Set(); selBProspects = new Set();
    selAPicks = new Set(); selBPicks = new Set();
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

  $: tradeCount = selAPlayers.size + selBPlayers.size
                + selAProspects.size + selBProspects.size
                + selAPicks.size + selBPicks.size;

  $: tradedBanner = data.traded;

  // ── Prospect manager ───────────────────────────────────────────────────────
  let prospTeam = '';
  let newPName = '', newPYear = '', newPOv = '';

  $: filteredProspects = prospTeam
    ? data.prospects.filter(p => p.team_id === Number(prospTeam))
    : data.prospects;

  // move-prospect inline state
  let movingProspectId: number | null = null;
  let moveProspectDest = '';

  // ── Pick manager ───────────────────────────────────────────────────────────
  let pickTeam = '';
  let newPickOwner = '', newPickAbbrev = '', newPickYear = '2026', newPickRound = '1';

  $: filteredPicks = pickTeam
    ? data.picks.filter(p => p.owner_team_id === Number(pickTeam))
    : data.picks;

  // move-pick inline state
  let movingPickId: number | null = null;
  let movePickDest = '';

  // ── Helpers ────────────────────────────────────────────────────────────────
  function ordinal(r: number) {
    return r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : `${r}th`;
  }

  function playerLabel(p: any) {
    const pos = p.is_goalie ? 'G' : p.position;
    return `${p.name} (${pos}, OV ${p.ov})`;
  }

  function pickLabel(pk: any) {
    return `${pk.year} ${pk.original_abbrev} ${ordinal(pk.round)}`;
  }

  // Refresh data after form actions (prospects/picks tabs)
  const refreshEnhance = () => {
    return async ({ result, update }: any) => {
      await update();
      await invalidateAll();
      // reset add forms
      newPName = ''; newPYear = ''; newPOv = '';
      newPickOwner = ''; newPickAbbrev = ''; newPickYear = '2026'; newPickRound = '1';
      movingProspectId = null; moveProspectDest = '';
      movingPickId = null; movePickDest = '';
    };
  };
</script>

<svelte:head><title>Trade Manager — RWHA Sim</title></svelte:head>

<!-- Header -->
<div class="mb-5 flex items-center justify-between gap-4">
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">
    Trade Manager
  </h1>
  <a href="/admin" class="text-xs font-mono text-rwha-muted hover:text-rwha-amber transition-colors">← Admin</a>
</div>

<!-- Tabs -->
<div class="flex gap-1 mb-5 border-b border-rwha-border pb-0">
  {#each [['trade','Execute Trade'],['prospects','Prospects'],['picks','Draft Picks']] as [key, label]}
    <button
      class="px-4 py-2 font-mono text-xs transition-colors border-b-2 -mb-px
             {activeTab === key
               ? 'border-rwha-amber text-rwha-amber'
               : 'border-transparent text-rwha-muted hover:text-rwha-text'}"
      on:click={() => activeTab = key as any}
    >{label}</button>
  {/each}
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- EXECUTE TRADE TAB                                                          -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
{#if activeTab === 'trade'}

  {#if tradedBanner}
    <div class="mb-4 px-4 py-3 rounded border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-sm">
      ✓ Trade executed — {tradedBanner} asset{tradedBanner === 1 ? '' : 's'} moved.
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
      {#each [...selAPlayers]   as id}<input type="hidden" name="a_player"   value={id}>{/each}
      {#each [...selBPlayers]   as id}<input type="hidden" name="b_player"   value={id}>{/each}
      {#each [...selAProspects] as id}<input type="hidden" name="a_prospect" value={id}>{/each}
      {#each [...selBProspects] as id}<input type="hidden" name="b_prospect" value={id}>{/each}
      {#each [...selAPicks]     as id}<input type="hidden" name="a_pick"     value={id}>{/each}
      {#each [...selBPicks]     as id}<input type="hidden" name="b_pick"     value={id}>{/each}

      <!-- Two-column asset selector -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {#each [
          { team: data.teamAData, selP: selAPlayers, selPr: selAProspects, selPk: selAPicks, side: 'A' as const },
          { team: data.teamBData, selP: selBPlayers, selPr: selBProspects, selPk: selBPicks, side: 'B' as const },
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
                      checked={col.side === 'A' ? selAPlayers.has(p.id) : selBPlayers.has(p.id)}
                      on:change={() => {
                        if (col.side === 'A') selAPlayers = toggleSet(selAPlayers, p.id);
                        else selBPlayers = toggleSet(selBPlayers, p.id);
                      }}
                      class="accent-amber-400 w-3.5 h-3.5 shrink-0">
                    <span class="text-xs font-mono
                      {(col.side === 'A' ? selAPlayers : selBPlayers).has(p.id)
                        ? 'text-rwha-amber' : 'text-rwha-text group-hover:text-rwha-amber/80'}
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
                      checked={col.side === 'A' ? selAPlayers.has(p.id) : selBPlayers.has(p.id)}
                      on:change={() => {
                        if (col.side === 'A') selAPlayers = toggleSet(selAPlayers, p.id);
                        else selBPlayers = toggleSet(selBPlayers, p.id);
                      }}
                      class="accent-amber-400 w-3.5 h-3.5 shrink-0">
                    <span class="text-xs font-mono text-rwha-muted
                      {(col.side === 'A' ? selAPlayers : selBPlayers).has(p.id) ? '!text-rwha-amber' : 'group-hover:text-rwha-text'}
                      transition-colors">
                      {p.name}
                      <span class="ml-1">{p.is_goalie ? 'G' : p.position} · {p.ov}</span>
                    </span>
                  </label>
                {/each}
              </details>
            {/if}

            <!-- Prospects -->
            {#if col.team.prospects.length > 0}
              <div class="px-3 pt-2 pb-1 border-t border-rwha-border/50 mt-1">
                <div class="text-xs font-mono text-rwha-muted uppercase tracking-wider mb-1">Prospects</div>
                {#each col.team.prospects as p}
                  <label class="flex items-center gap-2 py-0.5 cursor-pointer group">
                    <input type="checkbox"
                      checked={col.side === 'A' ? selAProspects.has(p.id) : selBProspects.has(p.id)}
                      on:change={() => {
                        if (col.side === 'A') selAProspects = toggleSet(selAProspects, p.id);
                        else selBProspects = toggleSet(selBProspects, p.id);
                      }}
                      class="accent-amber-400 w-3.5 h-3.5 shrink-0">
                    <span class="text-xs font-mono
                      {(col.side === 'A' ? selAProspects : selBProspects).has(p.id)
                        ? 'text-rwha-amber' : 'text-rwha-text group-hover:text-rwha-amber/80'}
                      transition-colors">
                      {p.name}
                      {#if p.draft_year}
                        <span class="text-rwha-muted ml-1">{p.draft_year} #{p.draft_overall ?? '?'}</span>
                      {/if}
                    </span>
                  </label>
                {/each}
              </div>
            {/if}

            <!-- Draft Picks -->
            {#if col.team.picks.length > 0}
              <div class="px-3 pt-2 pb-2 border-t border-rwha-border/50 mt-1">
                <div class="text-xs font-mono text-rwha-muted uppercase tracking-wider mb-1">Draft Picks</div>
                {#each col.team.picks as pk}
                  <label class="flex items-center gap-2 py-0.5 cursor-pointer group">
                    <input type="checkbox"
                      checked={col.side === 'A' ? selAPicks.has(pk.id) : selBPicks.has(pk.id)}
                      on:change={() => {
                        if (col.side === 'A') selAPicks = toggleSet(selAPicks, pk.id);
                        else selBPicks = toggleSet(selBPicks, pk.id);
                      }}
                      class="accent-amber-400 w-3.5 h-3.5 shrink-0">
                    <span class="text-xs font-mono
                      {(col.side === 'A' ? selAPicks : selBPicks).has(pk.id)
                        ? 'text-rwha-amber' : 'text-rwha-muted group-hover:text-rwha-text'}
                      transition-colors">
                      {pk.year} · {pk.original_abbrev} {ordinal(pk.round)}
                    </span>
                  </label>
                {/each}
              </div>
            {/if}

            {#if col.team.players.length === 0 && col.team.prospects.length === 0 && col.team.picks.length === 0}
              <div class="px-4 py-3 text-xs font-mono text-rwha-muted italic">No assets.</div>
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
              {#each [...selAProspects] as id}
                {@const p = data.teamAData.prospects.find(x => x.id === id)}
                {#if p}<div class="text-rwha-text">· {p.name} <span class="text-rwha-muted">(prospect)</span></div>{/if}
              {/each}
              {#each [...selAPicks] as id}
                {@const pk = data.teamAData.picks.find(x => x.id === id)}
                {#if pk}<div class="text-rwha-text">· {pickLabel(pk)}</div>{/if}
              {/each}
              {#if selAPlayers.size + selAProspects.size + selAPicks.size === 0}
                <div class="text-rwha-muted italic">nothing</div>
              {/if}
            </div>
            <div>
              <div class="text-rwha-amber font-bold mb-1">{data.teamBData.name} sends:</div>
              {#each [...selBPlayers] as id}
                {@const p = data.teamBData.players.find(x => x.id === id)}
                {#if p}<div class="text-rwha-text">· {p.name} <span class="text-rwha-muted">({p.is_goalie ? 'G' : p.position})</span></div>{/if}
              {/each}
              {#each [...selBProspects] as id}
                {@const p = data.teamBData.prospects.find(x => x.id === id)}
                {#if p}<div class="text-rwha-text">· {p.name} <span class="text-rwha-muted">(prospect)</span></div>{/if}
              {/each}
              {#each [...selBPicks] as id}
                {@const pk = data.teamBData.picks.find(x => x.id === id)}
                {#if pk}<div class="text-rwha-text">· {pickLabel(pk)}</div>{/if}
              {/each}
              {#if selBPlayers.size + selBProspects.size + selBPicks.size === 0}
                <div class="text-rwha-muted italic">nothing</div>
              {/if}
            </div>
          </div>
          <button type="submit"
            class="px-4 py-2 bg-rwha-amber text-rwha-bg font-mono font-bold text-xs rounded
                   hover:bg-rwha-amber/80 transition-colors uppercase tracking-wider">
            Execute Trade ({tradeCount} asset{tradeCount === 1 ? '' : 's'})
          </button>
        </div>
      {:else}
        <div class="text-xs font-mono text-rwha-muted italic">Check assets on each side to build a trade.</div>
      {/if}
    </form>

  {:else}
    <div class="text-xs font-mono text-rwha-muted italic mt-2">
      Select both teams above to begin building a trade.
    </div>
  {/if}

{/if}

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- PROSPECTS TAB                                                               -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
{#if activeTab === 'prospects'}

  {#if form?.success && form?.action === 'addProspect'}
    <div class="mb-3 px-3 py-2 rounded border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-xs">✓ Prospect added.</div>
  {/if}
  {#if form?.success && form?.action === 'deleteProspect'}
    <div class="mb-3 px-3 py-2 rounded border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-xs">✓ Prospect removed.</div>
  {/if}
  {#if form?.success && form?.action === 'moveProspect'}
    <div class="mb-3 px-3 py-2 rounded border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-xs">✓ Prospect moved.</div>
  {/if}

  <!-- Add prospect form -->
  <details class="card mb-4">
    <summary class="px-4 py-3 cursor-pointer font-mono text-xs text-rwha-muted uppercase tracking-wider hover:text-rwha-amber transition-colors">
      + Add Prospect ▸
    </summary>
    <form method="POST" action="?/addProspect" use:enhance={refreshEnhance()}
          class="px-4 pb-4 flex flex-wrap gap-3 items-end border-t border-rwha-border pt-3">
      <div class="flex flex-col gap-1">
        <label class="font-mono text-xs text-rwha-muted">Team</label>
        <select name="team_id" required
                class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-xs font-mono text-rwha-text
                       focus:outline-none focus:border-rwha-amber/50 min-w-[140px]">
          <option value="">— team —</option>
          {#each data.teams as t}<option value={t.id}>{t.name}</option>{/each}
        </select>
      </div>
      <div class="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label class="font-mono text-xs text-rwha-muted">Name</label>
        <input type="text" name="name" required placeholder="Player Name"
               class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-xs font-mono text-rwha-text
                      focus:outline-none focus:border-rwha-amber/50">
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-mono text-xs text-rwha-muted">Draft Year</label>
        <input type="number" name="draft_year" placeholder="2025" min="2010" max="2030"
               class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-xs font-mono text-rwha-text
                      focus:outline-none focus:border-rwha-amber/50 w-24">
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-mono text-xs text-rwha-muted">Overall</label>
        <input type="number" name="draft_overall" placeholder="1" min="1" max="300"
               class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-xs font-mono text-rwha-text
                      focus:outline-none focus:border-rwha-amber/50 w-20">
      </div>
      <button type="submit"
              class="px-3 py-1.5 bg-rwha-amber/20 border border-rwha-amber/30 text-rwha-amber font-mono text-xs rounded
                     hover:bg-rwha-amber/30 transition-colors">
        Add
      </button>
    </form>
  </details>

  <!-- Filter + table -->
  <div class="mb-3 flex items-center gap-3">
    <label class="font-mono text-xs text-rwha-muted">Filter by team:</label>
    <select bind:value={prospTeam}
            class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-xs font-mono text-rwha-text
                   focus:outline-none focus:border-rwha-amber/50">
      <option value="">All teams ({data.prospects.length})</option>
      {#each data.teams as t}
        {@const cnt = data.prospects.filter(p => p.team_id === t.id).length}
        {#if cnt > 0}
          <option value={t.id}>{t.name} ({cnt})</option>
        {/if}
      {/each}
    </select>
  </div>

  <div class="card overflow-x-auto">
    <table class="stat-table text-xs whitespace-nowrap w-full">
      <thead>
        <tr class="border-b border-rwha-border">
          <th class="text-left pl-3 min-w-[160px]">Name</th>
          <th class="text-left min-w-[120px]">Team</th>
          <th class="text-left">Draft Year</th>
          <th class="text-left">Overall</th>
          <th class="pr-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredProspects as p}
          <tr>
            <td class="pl-3 font-semibold text-rwha-text">{p.name}</td>
            <td class="text-rwha-muted">{p.team_name}</td>
            <td class="text-rwha-muted">{p.draft_year ?? '—'}</td>
            <td class="{p.draft_overall && p.draft_overall <= 10 ? 'text-rwha-amber font-bold' : 'text-rwha-muted'}">
              {p.draft_overall ? `#${p.draft_overall}` : '—'}
            </td>
            <td class="pr-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <!-- Move inline -->
                {#if movingProspectId === p.id}
                  <form method="POST" action="?/moveProspect" use:enhance={refreshEnhance()} class="flex items-center gap-1">
                    <input type="hidden" name="id" value={p.id}>
                    <select name="to_team_id" bind:value={moveProspectDest} required
                            class="bg-rwha-bg border border-rwha-border rounded px-1.5 py-0.5 text-xs font-mono text-rwha-text
                                   focus:outline-none focus:border-rwha-amber/50">
                      <option value="">— to team —</option>
                      {#each data.teams.filter(t => t.id !== p.team_id) as t}
                        <option value={t.id}>{t.name}</option>
                      {/each}
                    </select>
                    <button type="submit" class="px-2 py-0.5 bg-rwha-amber/20 border border-rwha-amber/30 text-rwha-amber font-mono text-xs rounded hover:bg-rwha-amber/30 transition-colors">→</button>
                    <button type="button" on:click={() => movingProspectId = null}
                            class="px-2 py-0.5 border border-rwha-border text-rwha-muted font-mono text-xs rounded hover:text-rwha-text transition-colors">✕</button>
                  </form>
                {:else}
                  <button on:click={() => { movingProspectId = p.id; moveProspectDest = ''; }}
                          class="text-rwha-muted hover:text-rwha-amber font-mono text-xs transition-colors">Move</button>
                {/if}
                <!-- Delete -->
                <form method="POST" action="?/deleteProspect" use:enhance={refreshEnhance()}
                      on:submit|preventDefault={(e) => { if(confirm(`Delete ${p.name}?`)) (e.target as HTMLFormElement).submit(); }}>
                  <input type="hidden" name="id" value={p.id}>
                  <button type="submit" class="text-rwha-red hover:text-rwha-red/70 font-mono text-xs transition-colors">Delete</button>
                </form>
              </div>
            </td>
          </tr>
        {/each}
        {#if filteredProspects.length === 0}
          <tr><td colspan="5" class="pl-3 py-3 text-rwha-muted italic text-xs font-mono">No prospects.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>

{/if}

<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- DRAFT PICKS TAB                                                             -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
{#if activeTab === 'picks'}

  {#if form?.success && form?.action === 'addPick'}
    <div class="mb-3 px-3 py-2 rounded border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-xs">✓ Pick added.</div>
  {/if}
  {#if form?.success && form?.action === 'deletePick'}
    <div class="mb-3 px-3 py-2 rounded border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-xs">✓ Pick removed.</div>
  {/if}
  {#if form?.success && form?.action === 'movePick'}
    <div class="mb-3 px-3 py-2 rounded border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-xs">✓ Pick transferred.</div>
  {/if}

  <!-- Add pick form -->
  <details class="card mb-4">
    <summary class="px-4 py-3 cursor-pointer font-mono text-xs text-rwha-muted uppercase tracking-wider hover:text-rwha-amber transition-colors">
      + Add Pick ▸
    </summary>
    <form method="POST" action="?/addPick" use:enhance={refreshEnhance()}
          class="px-4 pb-4 flex flex-wrap gap-3 items-end border-t border-rwha-border pt-3">
      <div class="flex flex-col gap-1">
        <label class="font-mono text-xs text-rwha-muted">Owner Team</label>
        <select name="owner_team_id" required
                class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-xs font-mono text-rwha-text
                       focus:outline-none focus:border-rwha-amber/50 min-w-[140px]">
          <option value="">— team —</option>
          {#each data.teams as t}<option value={t.id}>{t.name}</option>{/each}
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-mono text-xs text-rwha-muted">Original Abbrev</label>
        <input type="text" name="original_abbrev" placeholder="MAL" maxlength="4"
               class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-xs font-mono text-rwha-text uppercase
                      focus:outline-none focus:border-rwha-amber/50 w-20"
               style="text-transform:uppercase">
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-mono text-xs text-rwha-muted">Year</label>
        <select name="year" bind:value={newPickYear}
                class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-xs font-mono text-rwha-text
                       focus:outline-none focus:border-rwha-amber/50 w-24">
          {#each [2026,2027,2028,2029,2030,2031] as y}<option value={y}>{y}</option>{/each}
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-mono text-xs text-rwha-muted">Round</label>
        <select name="round" bind:value={newPickRound}
                class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-xs font-mono text-rwha-text
                       focus:outline-none focus:border-rwha-amber/50 w-20">
          {#each [1,2,3,4,5,6] as r}<option value={r}>{r}</option>{/each}
        </select>
      </div>
      <button type="submit"
              class="px-3 py-1.5 bg-rwha-amber/20 border border-rwha-amber/30 text-rwha-amber font-mono text-xs rounded
                     hover:bg-rwha-amber/30 transition-colors">
        Add
      </button>
    </form>
  </details>

  <!-- Filter + table -->
  <div class="mb-3 flex items-center gap-3">
    <label class="font-mono text-xs text-rwha-muted">Filter by owner:</label>
    <select bind:value={pickTeam}
            class="bg-rwha-bg border border-rwha-border rounded px-2 py-1.5 text-xs font-mono text-rwha-text
                   focus:outline-none focus:border-rwha-amber/50">
      <option value="">All teams ({data.picks.length})</option>
      {#each data.teams as t}
        {@const cnt = data.picks.filter(p => p.owner_team_id === t.id).length}
        {#if cnt > 0}
          <option value={t.id}>{t.name} ({cnt})</option>
        {/if}
      {/each}
    </select>
  </div>

  <div class="card overflow-x-auto">
    <table class="stat-table text-xs whitespace-nowrap w-full">
      <thead>
        <tr class="border-b border-rwha-border">
          <th class="text-left pl-3">Owner</th>
          <th class="text-left">Orig</th>
          <th class="text-left">Year</th>
          <th class="text-left">Round</th>
          <th class="pr-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredPicks as pk}
          <tr>
            <td class="pl-3 text-rwha-text font-semibold">{pk.owner_team_name}</td>
            <td class="font-mono {pk.original_abbrev === pk.owner_abbrev ? 'text-rwha-muted' : 'text-rwha-amber font-bold'}">{pk.original_abbrev}</td>
            <td class="text-rwha-amber font-mono font-bold">{pk.year}</td>
            <td class="text-rwha-muted font-mono">{ordinal(pk.round)}</td>
            <td class="pr-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <!-- Transfer inline -->
                {#if movingPickId === pk.id}
                  <form method="POST" action="?/movePick" use:enhance={refreshEnhance()} class="flex items-center gap-1">
                    <input type="hidden" name="id" value={pk.id}>
                    <select name="to_team_id" bind:value={movePickDest} required
                            class="bg-rwha-bg border border-rwha-border rounded px-1.5 py-0.5 text-xs font-mono text-rwha-text
                                   focus:outline-none focus:border-rwha-amber/50">
                      <option value="">— to team —</option>
                      {#each data.teams.filter(t => t.id !== pk.owner_team_id) as t}
                        <option value={t.id}>{t.name}</option>
                      {/each}
                    </select>
                    <button type="submit" class="px-2 py-0.5 bg-rwha-amber/20 border border-rwha-amber/30 text-rwha-amber font-mono text-xs rounded hover:bg-rwha-amber/30 transition-colors">→</button>
                    <button type="button" on:click={() => movingPickId = null}
                            class="px-2 py-0.5 border border-rwha-border text-rwha-muted font-mono text-xs rounded hover:text-rwha-text transition-colors">✕</button>
                  </form>
                {:else}
                  <button on:click={() => { movingPickId = pk.id; movePickDest = ''; }}
                          class="text-rwha-muted hover:text-rwha-amber font-mono text-xs transition-colors">Transfer</button>
                {/if}
                <!-- Delete -->
                <form method="POST" action="?/deletePick" use:enhance={refreshEnhance()}
                      on:submit|preventDefault={(e) => { if(confirm(`Delete ${pickLabel(pk)}?`)) (e.target as HTMLFormElement).submit(); }}>
                  <input type="hidden" name="id" value={pk.id}>
                  <button type="submit" class="text-rwha-red hover:text-rwha-red/70 font-mono text-xs transition-colors">Delete</button>
                </form>
              </div>
            </td>
          </tr>
        {/each}
        {#if filteredPicks.length === 0}
          <tr><td colspan="5" class="pl-3 py-3 text-rwha-muted italic text-xs font-mono">No picks.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>

{/if}
