<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  type Seed = typeof data.honey[0];

  const { honey, sturdy, seasonName, gp } = data;
  const projected = gp < 41;

  function record(s: Seed): string {
    const parts = [s.w, s.l];
    if (s.otl > 0) parts.push(s.otl);
    return parts.join('–');
  }

  // Top seed among the four gets amber, rest muted
  function seedColor(seed: number): string {
    return seed === 1 ? 'text-rwha-amber' : 'text-rwha-muted/50';
  }
  function nameColor(seed: number): string {
    return seed <= 2 ? 'text-rwha-text' : 'text-rwha-muted';
  }
  function ptsColor(seed: number): string {
    return seed <= 2 ? 'text-rwha-amber' : 'text-rwha-muted';
  }
</script>

<svelte:head><title>Playoffs — RWHA Sim</title></svelte:head>

<!-- Header -->
<div class="mb-6">
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">
    {seasonName} · Playoff Bracket
  </h1>
  <p class="text-rwha-muted text-sm mt-0.5">
    {#if projected}
      Projected · through {gp} game{gp === 1 ? '' : 's'} played · updates with each result
    {:else}
      Final seedings · pure conference points, no division seeding advantage
    {/if}
  </p>
</div>

{#if honey.length < 4 || sturdy.length < 4}
  <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
    Not enough games played to project a bracket yet — check back after the first week.
  </div>
{:else}

  <!-- ── 3-column bracket: Honey | Championship | Sturdy ────────────────────── -->
  <div class="grid grid-cols-1 lg:grid-cols-[1fr_200px_1fr] gap-6 items-start">

    <!-- LEFT — Honey Conference ─────────────────────────────────────────────── -->
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <h2 class="font-mono font-bold text-rwha-amber text-sm uppercase tracking-widest shrink-0">
          Honey Conference
        </h2>
        <div class="flex-1 h-px bg-rwha-border/50"></div>
      </div>

      <p class="font-mono text-[10px] uppercase tracking-widest text-rwha-muted">Conference Semifinals</p>

      <!-- SF1: 1 vs 4 -->
      <div class="card overflow-hidden">
        {#each [honey[0], honey[3]] as s, ri}
          <div class="flex items-center gap-2 px-3 py-2.5 {ri === 0 ? 'border-b border-rwha-border/40' : ''}
                      {ri === 0 ? 'bg-rwha-amber/5' : ''}">
            <span class="font-mono font-bold text-xs w-6 shrink-0 {seedColor(s.seed)}">{s.seed}</span>
            <a href="/teams/{s.team_name.toLowerCase()}"
               class="flex-1 font-semibold text-sm hover:text-rwha-amber transition-colors truncate {nameColor(s.seed)}">
              {s.team_name}
            </a>
            <span class="font-mono text-xs text-rwha-muted/60 shrink-0">{record(s)}</span>
            <span class="font-mono font-bold text-xs w-8 text-right shrink-0 {ptsColor(s.seed)}">{s.pts}</span>
          </div>
        {/each}
      </div>

      <!-- SF2: 2 vs 3 -->
      <div class="card overflow-hidden">
        {#each [honey[1], honey[2]] as s, ri}
          <div class="flex items-center gap-2 px-3 py-2.5 {ri === 0 ? 'border-b border-rwha-border/40' : ''}
                      {ri === 0 ? 'bg-rwha-amber/5' : ''}">
            <span class="font-mono font-bold text-xs w-6 shrink-0 {seedColor(s.seed)}">{s.seed}</span>
            <a href="/teams/{s.team_name.toLowerCase()}"
               class="flex-1 font-semibold text-sm hover:text-rwha-amber transition-colors truncate {nameColor(s.seed)}">
              {s.team_name}
            </a>
            <span class="font-mono text-xs text-rwha-muted/60 shrink-0">{record(s)}</span>
            <span class="font-mono font-bold text-xs w-8 text-right shrink-0 {ptsColor(s.seed)}">{s.pts}</span>
          </div>
        {/each}
      </div>

      <p class="font-mono text-[10px] uppercase tracking-widest text-rwha-muted pt-1">Conference Final</p>

      <div class="card overflow-hidden opacity-40">
        <div class="flex items-center gap-2 px-3 py-2.5 border-b border-rwha-border/40">
          <span class="font-mono text-xs w-6 text-rwha-muted shrink-0">W1</span>
          <span class="font-mono text-xs text-rwha-muted italic">Winner — Semifinal 1</span>
        </div>
        <div class="flex items-center gap-2 px-3 py-2.5">
          <span class="font-mono text-xs w-6 text-rwha-muted shrink-0">W2</span>
          <span class="font-mono text-xs text-rwha-muted italic">Winner — Semifinal 2</span>
        </div>
      </div>
    </div>

    <!-- CENTER — RWHA Championship ──────────────────────────────────────────── -->
    <div class="flex flex-col items-stretch lg:pt-[7.5rem]">
      <p class="font-mono text-[10px] uppercase tracking-widest text-rwha-muted mb-2 text-center">
        RWHA Championship
      </p>
      <div class="card border border-rwha-amber/20 overflow-hidden opacity-40">
        <div class="flex items-center gap-2 px-3 py-3 border-b border-rwha-border/40">
          <span class="font-mono text-xs text-rwha-muted/70 w-6 shrink-0">HC</span>
          <span class="font-mono text-xs text-rwha-muted italic flex-1">Honey Champion</span>
        </div>
        <div class="flex items-center gap-2 px-3 py-3">
          <span class="font-mono text-xs text-rwha-muted/70 w-6 shrink-0">SC</span>
          <span class="font-mono text-xs text-rwha-muted italic flex-1">Sturdy Champion</span>
        </div>
      </div>
    </div>

    <!-- RIGHT — Sturdy Conference ───────────────────────────────────────────── -->
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <h2 class="font-mono font-bold text-rwha-amber text-sm uppercase tracking-widest shrink-0">
          Sturdy Conference
        </h2>
        <div class="flex-1 h-px bg-rwha-border/50"></div>
      </div>

      <p class="font-mono text-[10px] uppercase tracking-widest text-rwha-muted">Conference Semifinals</p>

      <!-- SF1: 1 vs 4 -->
      <div class="card overflow-hidden">
        {#each [sturdy[0], sturdy[3]] as s, ri}
          <div class="flex items-center gap-2 px-3 py-2.5 {ri === 0 ? 'border-b border-rwha-border/40' : ''}
                      {ri === 0 ? 'bg-rwha-amber/5' : ''}">
            <span class="font-mono font-bold text-xs w-6 shrink-0 {seedColor(s.seed)}">{s.seed}</span>
            <a href="/teams/{s.team_name.toLowerCase()}"
               class="flex-1 font-semibold text-sm hover:text-rwha-amber transition-colors truncate {nameColor(s.seed)}">
              {s.team_name}
            </a>
            <span class="font-mono text-xs text-rwha-muted/60 shrink-0">{record(s)}</span>
            <span class="font-mono font-bold text-xs w-8 text-right shrink-0 {ptsColor(s.seed)}">{s.pts}</span>
          </div>
        {/each}
      </div>

      <!-- SF2: 2 vs 3 -->
      <div class="card overflow-hidden">
        {#each [sturdy[1], sturdy[2]] as s, ri}
          <div class="flex items-center gap-2 px-3 py-2.5 {ri === 0 ? 'border-b border-rwha-border/40' : ''}
                      {ri === 0 ? 'bg-rwha-amber/5' : ''}">
            <span class="font-mono font-bold text-xs w-6 shrink-0 {seedColor(s.seed)}">{s.seed}</span>
            <a href="/teams/{s.team_name.toLowerCase()}"
               class="flex-1 font-semibold text-sm hover:text-rwha-amber transition-colors truncate {nameColor(s.seed)}">
              {s.team_name}
            </a>
            <span class="font-mono text-xs text-rwha-muted/60 shrink-0">{record(s)}</span>
            <span class="font-mono font-bold text-xs w-8 text-right shrink-0 {ptsColor(s.seed)}">{s.pts}</span>
          </div>
        {/each}
      </div>

      <p class="font-mono text-[10px] uppercase tracking-widest text-rwha-muted pt-1">Conference Final</p>

      <div class="card overflow-hidden opacity-40">
        <div class="flex items-center gap-2 px-3 py-2.5 border-b border-rwha-border/40">
          <span class="font-mono text-xs w-6 text-rwha-muted shrink-0">W1</span>
          <span class="font-mono text-xs text-rwha-muted italic">Winner — Semifinal 1</span>
        </div>
        <div class="flex items-center gap-2 px-3 py-2.5">
          <span class="font-mono text-xs w-6 text-rwha-muted shrink-0">W2</span>
          <span class="font-mono text-xs text-rwha-muted italic">Winner — Semifinal 2</span>
        </div>
      </div>
    </div>

  </div>

  {#if projected}
    <p class="mt-6 text-center text-rwha-muted/30 font-mono text-xs">
      Seedings update automatically after every game. Pure conference points ranking — no division seeding advantage.
    </p>
  {/if}

{/if}
