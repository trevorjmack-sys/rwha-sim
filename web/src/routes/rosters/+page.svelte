<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function hasPos(pos: string, check: string) {
    return pos.split('/').includes(check);
  }
  function x(pos: string, check: string) {
    return hasPos(pos, check) ? 'X' : '';
  }
  function fmtCon(inj: number) {
    return inj > 0 ? (100 - inj * 5).toFixed(2) : '100.00';
  }
  function a(attrs: Record<string, number>, key: string) {
    return attrs[key] ?? '—';
  }

  // Skater attr column order matching rwha.net
  const SKATER_COLS = ['ck','fg','di','sk','st','en','du','ph','fo','pa','sc','df','ps','ex','ld'] as const;
  const GOALIE_COLS = ['sk','du','en','sz','ag','rb','sc','hs','rt','ph','ps','ex','ld'] as const;

  function puckpediaUrl(name: string): string {
    return 'https://puckpedia.com/player/' + name
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/['']/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z-]/g, '');
  }

  function photoUrl(nhlId: number | null): string | null {
    return nhlId ? `https://puckpedia.com/s/nhl/${nhlId}.jpg` : null;
  }

  // Hover photo popup
  let popupSrc = '';
  let popupX = 0;
  let popupY = 0;
  let popupVisible = false;

  function showPhoto(e: MouseEvent, nhlId: number | null) {
    const src = photoUrl(nhlId);
    if (!src) return;
    popupSrc = src;
    popupX = e.clientX + 14;
    popupY = e.clientY - 10;
    popupVisible = true;
  }
  function movePhoto(e: MouseEvent) {
    if (!popupVisible) return;
    popupX = e.clientX + 14;
    popupY = e.clientY - 10;
  }
  function hidePhoto() {
    popupVisible = false;
  }
</script>

<!-- Fixed photo popup (position:fixed avoids overflow clipping) -->
{#if popupVisible && popupSrc}
  <div class="fixed z-[9999] pointer-events-none rounded overflow-hidden shadow-xl border border-rwha-border"
       style="left:{popupX}px; top:{popupY}px;">
    <img src={popupSrc} alt="" class="h-32 w-auto block"
         on:error={() => { popupVisible = false; }} />
  </div>
{/if}

<svelte:head><title>Rosters — RWHA Sim</title></svelte:head>

<!-- Team anchor nav -->
<div class="mb-5">
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase mb-3">Pro Team Rosters</h1>
  <div class="flex flex-wrap gap-1.5">
    {#each data.teams as t}
      <a href="#{t.name.toLowerCase()}"
         class="px-2.5 py-1 rounded border border-rwha-border text-rwha-muted font-mono text-xs
                hover:border-rwha-amber/50 hover:text-rwha-amber transition-colors">
        {t.name}
      </a>
    {/each}
  </div>
</div>

<!-- ── Team blocks ─────────────────────────────────────────────────────────── -->
{#each data.teams as team}
  <div id="{team.name.toLowerCase()}" class="mb-10 scroll-mt-16">

    <!-- Team header -->
    <div class="flex items-baseline justify-between gap-4 mb-1">
      <h2 class="font-mono font-bold text-rwha-amber text-base uppercase tracking-wider">
        {team.name}
      </h2>
      <a href="#{team.name.toLowerCase()}" class="text-xs font-mono text-rwha-muted hover:text-rwha-amber transition-colors">↑ top</a>
    </div>
    <div class="text-xs font-mono text-rwha-muted mb-3">
      GM: <span class="text-rwha-text">{team.gm_name}</span>
      {#if team.farm_name}
        <span class="mx-2 text-rwha-border">|</span>
        Farm: <span class="text-rwha-text">{team.farm_name}</span>
      {/if}
    </div>

    <!-- ── Pro Roster ──────────────────────────────────────────────────────── -->
    <div class="section-header">Pro Roster</div>
    <div class="card mb-3 overflow-x-auto">
      <table class="stat-table text-xs whitespace-nowrap">
        <thead>
          <tr class="border-b border-rwha-border">
            <th class="text-left pl-3 sticky left-0 bg-rwha-surface w-6">#</th>
            <th class="text-left pl-2 sticky left-6 bg-rwha-surface min-w-[140px]">Player</th>
            <th class="w-5">C</th>
            <th class="w-5">L</th>
            <th class="w-5">R</th>
            <th class="w-5">D</th>
            <th>CON</th>
            <th>IJ</th>
            {#each SKATER_COLS as col}
              <th class="uppercase">{col}</th>
            {/each}
            <th class="pr-3 text-rwha-amber">OV</th>
          </tr>
        </thead>
        <tbody>
          {#each team.proSkaters as p, i}
            <tr class="{p.injured_games_remaining > 0 ? 'bg-rwha-red/5' : ''}">
              <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">{p.jersey_number ?? i + 1}</td>
              <td class="text-left pl-2 sticky left-6 bg-rwha-surface font-semibold text-rwha-text">
                <div class="flex items-center gap-1.5">
                  {#if photoUrl(p.nhl_id)}
                    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                    <img src={photoUrl(p.nhl_id)} alt=""
                         class="h-5 w-5 rounded-full object-cover shrink-0 cursor-default"
                         on:error={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                         on:mouseenter={(e) => showPhoto(e, p.nhl_id)}
                         on:mousemove={movePhoto}
                         on:mouseleave={hidePhoto} />
                  {/if}
                  <a href={puckpediaUrl(p.name)} target="_blank" rel="noopener noreferrer"
                     class="hover:text-rwha-amber transition-colors">{p.name}</a>
                  {#if p.injured_games_remaining > 0}
                    <span class="text-rwha-red font-normal">(INJ)</span>
                  {/if}
                </div>
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
                <td class="{(p.attrs[col] ?? 0) >= 90 ? 'text-rwha-amber font-bold' : (p.attrs[col] ?? 0) >= 80 ? 'text-rwha-text' : 'text-rwha-muted'}">
                  {a(p.attrs, col)}
                </td>
              {/each}
              <td class="pr-3 text-rwha-amber font-bold">{p.ov}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Pro Goalies -->
    {#if team.proGoalies.length > 0}
      <div class="card mb-4 overflow-x-auto">
        <table class="stat-table text-xs whitespace-nowrap">
          <thead>
            <tr class="border-b border-rwha-border">
              <th class="text-left pl-3 sticky left-0 bg-rwha-surface w-5">PO</th>
              <th class="text-left pl-2 sticky left-5 bg-rwha-surface min-w-[140px]">Goalie</th>
              <th>CON</th>
              <th>IJ</th>
              {#each GOALIE_COLS as col}
                <th class="uppercase">{col}</th>
              {/each}
              <th class="pr-3 text-rwha-amber">OV</th>
            </tr>
          </thead>
          <tbody>
            {#each team.proGoalies as p}
              <tr class="{p.injured_games_remaining > 0 ? 'bg-rwha-red/5' : ''}">
                <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">G</td>
                <td class="text-left pl-2 sticky left-5 bg-rwha-surface font-semibold text-rwha-text">
                  <div class="flex items-center gap-1.5">
                    {#if photoUrl(p.nhl_id)}
                      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                      <img src={photoUrl(p.nhl_id)} alt=""
                           class="h-5 w-5 rounded-full object-cover shrink-0 cursor-default"
                           on:error={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                           on:mouseenter={(e) => showPhoto(e, p.nhl_id)}
                           on:mousemove={movePhoto}
                           on:mouseleave={hidePhoto} />
                    {/if}
                    <a href={puckpediaUrl(p.name)} target="_blank" rel="noopener noreferrer"
                       class="hover:text-rwha-amber transition-colors">{p.name}</a>
                    {#if p.injured_games_remaining > 0}
                      <span class="text-rwha-red font-normal">(INJ)</span>
                    {/if}
                  </div>
                </td>
                <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
                <td class="{p.injured_games_remaining > 0 ? 'text-rwha-red font-bold' : 'text-rwha-muted'}">
                  {p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}
                </td>
                {#each GOALIE_COLS as col}
                  <td class="{(p.attrs[col] ?? 0) >= 90 ? 'text-rwha-amber font-bold' : (p.attrs[col] ?? 0) >= 80 ? 'text-rwha-text' : 'text-rwha-muted'}">
                    {a(p.attrs, col)}
                  </td>
                {/each}
                <td class="pr-3 text-rwha-amber font-bold">{p.ov}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- ── Farm Roster ─────────────────────────────────────────────────────── -->
    {#if team.farmSkaters.length > 0 || team.farmGoalies.length > 0}
      <details>
        <summary class="section-header cursor-pointer select-none hover:text-rwha-amber/80 transition-colors mb-2">
          Farm — {team.farm_name ?? 'Farm Team'} ▸
        </summary>

        <div class="card mb-3 overflow-x-auto">
          <table class="stat-table text-xs whitespace-nowrap">
            <thead>
              <tr class="border-b border-rwha-border">
                <th class="text-left pl-3 sticky left-0 bg-rwha-surface w-6">#</th>
                <th class="text-left pl-2 sticky left-6 bg-rwha-surface min-w-[140px]">Player</th>
                <th class="w-5">C</th><th class="w-5">L</th><th class="w-5">R</th><th class="w-5">D</th>
                <th>CON</th><th>IJ</th>
                {#each SKATER_COLS as col}<th class="uppercase">{col}</th>{/each}
                <th class="pr-3 text-rwha-amber">OV</th>
              </tr>
            </thead>
            <tbody>
              {#each team.farmSkaters as p, i}
                <tr>
                  <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">{p.jersey_number ?? i + 1}</td>
                  <td class="text-left pl-2 sticky left-6 bg-rwha-surface text-rwha-muted">
                    <div class="flex items-center gap-1.5">
                      {#if photoUrl(p.nhl_id)}
                        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                        <img src={photoUrl(p.nhl_id)} alt=""
                             class="h-5 w-5 rounded-full object-cover shrink-0 cursor-default"
                             on:error={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                             on:mouseenter={(e) => showPhoto(e, p.nhl_id)}
                             on:mousemove={movePhoto}
                             on:mouseleave={hidePhoto} />
                      {/if}
                      <a href={puckpediaUrl(p.name)} target="_blank" rel="noopener noreferrer"
                         class="hover:text-rwha-amber transition-colors">{p.name}</a>
                    </div>
                  </td>
                  <td class="text-rwha-muted">{x(p.position, 'C')}</td>
                  <td class="text-rwha-muted">{x(p.position, 'L')}</td>
                  <td class="text-rwha-muted">{x(p.position, 'R')}</td>
                  <td class="text-rwha-muted">{x(p.position, 'D')}</td>
                  <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
                  <td class="text-rwha-muted">{p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}</td>
                  {#each SKATER_COLS as col}
                    <td class="text-rwha-muted/70">{a(p.attrs, col)}</td>
                  {/each}
                  <td class="pr-3 text-rwha-amber/60 font-bold">{p.ov}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        {#if team.farmGoalies.length > 0}
          <div class="card mb-3 overflow-x-auto">
            <table class="stat-table text-xs whitespace-nowrap">
              <thead>
                <tr class="border-b border-rwha-border">
                  <th class="text-left pl-3 sticky left-0 bg-rwha-surface w-5">PO</th>
                  <th class="text-left pl-2 sticky left-5 bg-rwha-surface min-w-[140px]">Goalie</th>
                  <th>CON</th><th>IJ</th>
                  {#each GOALIE_COLS as col}<th class="uppercase">{col}</th>{/each}
                  <th class="pr-3 text-rwha-amber">OV</th>
                </tr>
              </thead>
              <tbody>
                {#each team.farmGoalies as p}
                  <tr>
                    <td class="pl-3 text-rwha-muted sticky left-0 bg-rwha-surface">G</td>
                    <td class="text-left pl-2 sticky left-5 bg-rwha-surface text-rwha-muted">
                      <div class="flex items-center gap-1.5">
                        {#if photoUrl(p.nhl_id)}
                          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                          <img src={photoUrl(p.nhl_id)} alt=""
                               class="h-5 w-5 rounded-full object-cover shrink-0 cursor-default"
                               on:error={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
                               on:mouseenter={(e) => showPhoto(e, p.nhl_id)}
                               on:mousemove={movePhoto}
                               on:mouseleave={hidePhoto} />
                        {/if}
                        <a href={puckpediaUrl(p.name)} target="_blank" rel="noopener noreferrer"
                           class="hover:text-rwha-amber transition-colors">{p.name}</a>
                      </div>
                    </td>
                    <td class="text-rwha-muted">{fmtCon(p.injured_games_remaining)}</td>
                    <td class="text-rwha-muted">{p.injured_games_remaining > 0 ? p.injured_games_remaining : ''}</td>
                    {#each GOALIE_COLS as col}
                      <td class="text-rwha-muted/70">{a(p.attrs, col)}</td>
                    {/each}
                    <td class="pr-3 text-rwha-amber/60 font-bold">{p.ov}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </details>
    {/if}

  </div>
{/each}

<style>
  /* Left-align all column headers on the rosters page */
  :global(.stat-table th) { text-align: left; }
</style>
