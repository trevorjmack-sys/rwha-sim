<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  type Prospect = { name: string; draft_year: number | null; draft_overall: number | null };
  type Pick = { original_abbrev: string; year: number; round: number };
  type PicksByYear = { year: number; picks: Pick[] };

  function puckpediaUrl(name: string): string {
    return 'https://puckpedia.com/player/' + name
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/['']/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z-]/g, '');
  }

  function draftLabel(p: Prospect): string {
    if (!p.draft_year && !p.draft_overall) return '';
    if (p.draft_year && p.draft_overall) return `${p.draft_year} #${p.draft_overall}`;
    if (p.draft_year) return `${p.draft_year}`;
    return `#${p.draft_overall}`;
  }

  // Whether a pick is the team's own original pick
  function isOwnPick(abbrev: string, teamAbbrev: string): boolean {
    return abbrev === teamAbbrev;
  }

  // ordinal round label
  function roundLabel(r: number): string {
    if (r === 1) return '1st';
    if (r === 2) return '2nd';
    if (r === 3) return '3rd';
    return `${r}th`;
  }
</script>

<svelte:head><title>Prospects — RWHA Sim</title></svelte:head>

<!-- Team anchor nav -->
<div class="mb-5">
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase mb-3">
    Prospects &amp; Draft Picks
  </h1>
  <div class="flex flex-wrap gap-1.5">
    {#each data.teams as t}
      <a href="#{t.name.toLowerCase().replace(/\s+/g,'-')}"
         class="px-2.5 py-1 rounded border border-rwha-border text-rwha-muted font-mono text-xs
                hover:border-rwha-amber/50 hover:text-rwha-amber transition-colors">
        {t.name}
      </a>
    {/each}
  </div>
</div>

<!-- ── Team blocks ─────────────────────────────────────────────────────────── -->
{#each data.teams as team}
  {@const slug = team.name.toLowerCase().replace(/\s+/g,'-')}
  <div id={slug} class="mb-8 scroll-mt-16">

    <!-- Team header -->
    <div class="flex items-baseline justify-between gap-4 mb-1">
      <h2 class="font-mono font-bold text-rwha-amber text-base uppercase tracking-wider">
        {team.name}
        <span class="text-rwha-muted font-normal text-xs ml-2 normal-case tracking-normal">
          {team.abbrev}
        </span>
      </h2>
      <a href="#{slug}" class="text-xs font-mono text-rwha-muted hover:text-rwha-amber transition-colors">↑ top</a>
    </div>
    <div class="text-xs font-mono text-rwha-muted mb-3">
      GM: <span class="text-rwha-text">{team.gm_name}</span>
    </div>

    <!-- ── Prospects ──────────────────────────────────────────────────────── -->
    <details open class="mb-3">
      <summary class="section-header cursor-pointer select-none hover:text-rwha-amber/80 transition-colors mb-2">
        Prospects ({team.prospects.length}) ▸
      </summary>

      {#if team.prospects.length === 0}
        <div class="card px-4 py-3 text-xs font-mono text-rwha-muted italic">No prospects on file.</div>
      {:else}
        <div class="card overflow-x-auto mb-1">
          <table class="stat-table text-xs whitespace-nowrap w-full">
            <thead>
              <tr class="border-b border-rwha-border">
                <th class="text-left pl-3 min-w-[160px]">Name</th>
                <th class="text-left">Draft Year</th>
                <th class="text-left pr-3">Overall</th>
              </tr>
            </thead>
            <tbody>
              {#each team.prospects as p}
                <tr>
                  <td class="pl-3 font-semibold text-rwha-text">
                    <a href={puckpediaUrl(p.name)} target="_blank" rel="noopener noreferrer"
                       class="hover:text-rwha-amber transition-colors">{p.name}</a>
                  </td>
                  <td class="text-rwha-muted">{p.draft_year ?? '—'}</td>
                  <td class="pr-3 {p.draft_overall && p.draft_overall <= 10 ? 'text-rwha-amber font-bold' : p.draft_overall && p.draft_overall <= 31 ? 'text-rwha-text' : 'text-rwha-muted'}">
                    {p.draft_overall ? `#${p.draft_overall}` : '—'}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </details>

    <!-- ── Draft Picks ────────────────────────────────────────────────────── -->
    <details open class="mb-1">
      <summary class="section-header cursor-pointer select-none hover:text-rwha-amber/80 transition-colors mb-2">
        Draft Picks ({team.picksByYear.reduce((s, y) => s + y.picks.length, 0)}) ▸
      </summary>

      {#if team.picksByYear.length === 0}
        <div class="card px-4 py-3 text-xs font-mono text-rwha-muted italic">No draft picks on file.</div>
      {:else}
        <div class="card overflow-x-auto">
          <table class="stat-table text-xs whitespace-nowrap w-full">
            <thead>
              <tr class="border-b border-rwha-border">
                <th class="text-left pl-3 w-16">Year</th>
                <th class="text-left pr-3">Picks</th>
              </tr>
            </thead>
            <tbody>
              {#each team.picksByYear as { year, picks }}
                <tr>
                  <td class="pl-3 font-mono text-rwha-amber font-bold">{year}</td>
                  <td class="pr-3 py-1.5">
                    <div class="flex flex-wrap gap-1">
                      {#each picks as pick}
                        <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono
                          {isOwnPick(pick.original_abbrev, team.abbrev)
                            ? 'bg-rwha-amber/10 text-rwha-amber border border-rwha-amber/20'
                            : 'bg-rwha-surface text-rwha-muted border border-rwha-border'}">
                          {pick.original_abbrev}&nbsp;{pick.round}
                        </span>
                      {/each}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </details>

  </div>
{/each}
