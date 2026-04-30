<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  type Tab = 'skaters' | 'goalies';
  let tab: Tab = 'skaters';

  // ── Skater sort ───────────────────────────────────────────────────────────────
  type SkaterKey = 'pts' | 'g' | 'a' | 'gp' | 'plus_minus' | 'pim' | 'sog';
  let skSort: SkaterKey = 'pts';
  let skDir = -1;

  function setSk(k: SkaterKey) {
    if (skSort === k) skDir = -skDir; else { skSort = k; skDir = -1; }
  }

  $: sortedSkaters = [...data.skaters].sort((a, b) => {
    const av = Number((a as Record<string, unknown>)[skSort] ?? 0);
    const bv = Number((b as Record<string, unknown>)[skSort] ?? 0);
    // Secondary: PTS desc
    if (av === bv && skSort !== 'pts') return Number(b.pts ?? 0) - Number(a.pts ?? 0);
    return skDir * (av - bv);
  });

  // ── Goalie sort ───────────────────────────────────────────────────────────────
  type GoalieKey = 'sv_pct' | 'gaa' | 'w' | 'l' | 'otl' | 'gp' | 'so';
  let glSort: GoalieKey = 'sv_pct';
  let glDir = -1;

  function setGl(k: GoalieKey) {
    if (glSort === k) glDir = -glDir; else { glSort = k; glDir = k === 'gaa' ? 1 : -1; }
  }

  $: sortedGoalies = [...data.goalies].sort((a, b) => {
    const av = Number((a as Record<string, unknown>)[glSort] ?? 0);
    const bv = Number((b as Record<string, unknown>)[glSort] ?? 0);
    if (av === bv && glSort !== 'sv_pct') return Number(b.sv_pct ?? 0) - Number(a.sv_pct ?? 0);
    return glDir * (av - bv);
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function fmtSvp(n: unknown) {
    const v = Number(n);
    if (!v) return '—';
    return v.toFixed(3).replace(/^0/, '');
  }
  function fmtPM(n: unknown) {
    const v = Number(n ?? 0);
    return v > 0 ? `+${v}` : String(v);
  }
  function thCls(active: boolean) {
    return active
      ? 'text-rwha-amber cursor-pointer'
      : 'text-rwha-muted cursor-pointer hover:text-rwha-text transition-colors';
  }
  function ind(cur: string, key: string, dir: number) {
    return cur === key ? (dir === -1 ? ' ↓' : ' ↑') : '';
  }
</script>

<svelte:head><title>Leaders — RWHA Sim</title></svelte:head>

<div class="mb-6 flex items-end justify-between">
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">Leaders</h1>
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

<!-- ── Skaters ─────────────────────────────────────────────────────────────────── -->
{#if tab === 'skaters'}
  {#if data.skaters.length === 0}
    <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
      No games played yet — check back after Sunday.
    </div>
  {:else}
    <div class="section-header mb-1">
      Scoring Leaders
      <span class="text-rwha-muted normal-case font-sans font-normal text-xs ml-2">
        — click headers to sort · {sortedSkaters.length} players
      </span>
    </div>
    <div class="card overflow-x-auto">
      <table class="stat-table w-full text-sm whitespace-nowrap">
        <thead>
          <tr class="border-b border-rwha-border">
            <th class="text-left pl-4 w-8 text-rwha-muted">#</th>
            <th class="text-left min-w-[150px]">Player</th>
            <th class="text-left min-w-[100px]">Team</th>
            <th class="w-10 text-rwha-muted">POS</th>
            <th class="{thCls(skSort==='gp')}" on:click={() => setSk('gp')}>GP{ind(skSort,'gp',skDir)}</th>
            <th class="{thCls(skSort==='g')}"  on:click={() => setSk('g')}>G{ind(skSort,'g',skDir)}</th>
            <th class="{thCls(skSort==='a')}"  on:click={() => setSk('a')}>A{ind(skSort,'a',skDir)}</th>
            <th class="{thCls(skSort==='pts')} {skSort==='pts' ? '' : 'text-rwha-amber'}"
                on:click={() => setSk('pts')}>PTS{ind(skSort,'pts',skDir)}</th>
            <th class="{thCls(skSort==='plus_minus')}" on:click={() => setSk('plus_minus')}>+/−{ind(skSort,'plus_minus',skDir)}</th>
            <th class="{thCls(skSort==='pim')}" on:click={() => setSk('pim')}>PIM{ind(skSort,'pim',skDir)}</th>
            <th class="{thCls(skSort==='sog')} pr-4" on:click={() => setSk('sog')}>SOG{ind(skSort,'sog',skDir)}</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedSkaters as s, i}
            <tr>
              <td class="pl-4 text-rwha-muted text-xs">{i + 1}</td>
              <td class="name-col font-semibold text-rwha-text">{s.name}</td>
              <td class="name-col text-xs">
                <a href="/teams/{String(s.team_name).toLowerCase()}"
                   class="text-rwha-muted uppercase tracking-wide hover:text-rwha-amber transition-colors">
                  {s.team_name}
                </a>
              </td>
              <td class="text-rwha-muted text-xs">{s.position}</td>
              <td class="text-rwha-muted">{s.gp}</td>
              <td>{s.g}</td>
              <td>{s.a}</td>
              <td class="text-rwha-amber font-bold">{s.pts}</td>
              <td class="{Number(s.plus_minus ?? 0) > 0 ? 'text-rwha-green' : Number(s.plus_minus ?? 0) < 0 ? 'text-rwha-red' : 'text-rwha-muted'}">
                {fmtPM(s.plus_minus)}
              </td>
              <td class="text-rwha-muted">{s.pim}</td>
              <td class="pr-4 text-rwha-muted">{s.sog}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

<!-- ── Goalies ─────────────────────────────────────────────────────────────────── -->
{:else}
  {#if data.goalies.length === 0}
    <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
      No goalies with recorded starts yet.
    </div>
  {:else}
    <div class="section-header mb-1">
      Goalie Leaders
      <span class="text-rwha-muted normal-case font-sans font-normal text-xs ml-2">
        — click headers to sort
      </span>
    </div>
    <div class="card overflow-x-auto">
      <table class="stat-table w-full text-sm whitespace-nowrap">
        <thead>
          <tr class="border-b border-rwha-border">
            <th class="text-left pl-4 w-8 text-rwha-muted">#</th>
            <th class="text-left min-w-[150px]">Goalie</th>
            <th class="text-left min-w-[100px]">Team</th>
            <th class="{thCls(glSort==='gp')}"  on:click={() => setGl('gp')}>GP{ind(glSort,'gp',glDir)}</th>
            <th class="{thCls(glSort==='w')}"   on:click={() => setGl('w')}>W{ind(glSort,'w',glDir)}</th>
            <th class="{thCls(glSort==='l')}"   on:click={() => setGl('l')}>L{ind(glSort,'l',glDir)}</th>
            <th class="{thCls(glSort==='otl')}" on:click={() => setGl('otl')}>OTL{ind(glSort,'otl',glDir)}</th>
            <th class="{thCls(glSort==='gaa')}" on:click={() => setGl('gaa')}>GAA{ind(glSort,'gaa',glDir)}</th>
            <th class="{thCls(glSort==='sv_pct')} {glSort==='sv_pct' ? '' : 'text-rwha-amber'}"
                on:click={() => setGl('sv_pct')}>SV%{ind(glSort,'sv_pct',glDir)}</th>
            <th class="{thCls(glSort==='so')} pr-4" on:click={() => setGl('so')}>SO{ind(glSort,'so',glDir)}</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedGoalies as g, i}
            <tr>
              <td class="pl-4 text-rwha-muted text-xs">{i + 1}</td>
              <td class="name-col font-semibold text-rwha-text">{g.name}</td>
              <td class="name-col text-xs">
                <a href="/teams/{String(g.team_name).toLowerCase()}"
                   class="text-rwha-muted uppercase tracking-wide hover:text-rwha-amber transition-colors">
                  {g.team_name}
                </a>
              </td>
              <td class="text-rwha-muted">{g.gp}</td>
              <td class="text-rwha-green">{g.w}</td>
              <td class="text-rwha-red">{g.l}</td>
              <td class="text-rwha-amber">{g.otl}</td>
              <td class="font-mono">{Number(g.gaa ?? 0).toFixed(2)}</td>
              <td class="text-rwha-amber font-bold font-mono">{fmtSvp(g.sv_pct)}</td>
              <td class="pr-4">{g.so}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}
