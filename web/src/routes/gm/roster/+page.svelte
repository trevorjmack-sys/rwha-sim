<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  // ── Types ────────────────────────────────────────────────────────────────────
  type Column = 'proDress' | 'proScratch' | 'farmDress' | 'farmScratch';

  interface Card {
    id: number;
    name: string;
    position: string;
    ov: number;
    is_goalie: boolean;
    injured_games_remaining: number;
    is_personal: boolean;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function isDefense(pos: string) {
    return pos.split('/').some(p => p === 'D' || /^[LR]D$/.test(p));
  }

  function colKey(level: string, scratch: number): Column {
    if (level === 'pro') return scratch ? 'proScratch' : 'proDress';
    return scratch ? 'farmScratch' : 'farmDress';
  }

  function sortCards(cards: Card[]): Card[] {
    return [...cards].sort((a, b) => {
      const rank = (c: Card) => c.is_goalie ? 2 : isDefense(c.position) ? 1 : 0;
      const dr = rank(a) - rank(b);
      return dr !== 0 ? dr : b.ov - a.ov;
    });
  }

  // ── Init columns ─────────────────────────────────────────────────────────────
  function initCols(): Record<Column, Card[]> {
    const c: Record<Column, Card[]> = {
      proDress: [], proScratch: [], farmDress: [], farmScratch: [],
    };
    for (const p of data.players) {
      c[colKey(p.roster_level, p.is_scratch)].push({
        id: p.id, name: p.name, position: p.position, ov: p.ov,
        is_goalie: !!p.is_goalie,
        injured_games_remaining: p.injured_games_remaining,
        is_personal: !!(p as any).is_personal,
      });
    }
    for (const k of Object.keys(c) as Column[]) c[k] = sortCards(c[k]);
    return c;
  }

  let cols = initCols();

  // ── Dirty tracking ───────────────────────────────────────────────────────────
  const original = new Map(
    data.players.map(p => [p.id, { roster_level: p.roster_level, is_scratch: p.is_scratch as number }])
  );

  function getDirty(c: Record<Column, Card[]>) {
    const moves: { id: number; roster_level: string; is_scratch: number }[] = [];
    for (const col of Object.keys(c) as Column[]) {
      const roster_level = col.startsWith('pro') ? 'pro' : 'farm';
      const is_scratch   = col.endsWith('Scratch') ? 1 : 0;
      for (const card of c[col]) {
        const orig = original.get(card.id);
        if (orig && (orig.roster_level !== roster_level || orig.is_scratch !== is_scratch)) {
          moves.push({ id: card.id, roster_level, is_scratch });
        }
      }
    }
    return moves;
  }

  $: dirty     = getDirty(cols);
  $: movesJson = JSON.stringify(dirty);

  // ── RWHA roster rules: 18 skaters + 2 goalies dressed, max 3 scratches ───────
  $: proDressSkaters  = cols.proDress.filter(c => !c.is_goalie).length;
  $: proDressGoalies  = cols.proDress.filter(c =>  c.is_goalie).length;
  $: proScratchCount  = cols.proScratch.length;

  $: rosterOk = proDressSkaters === 18 && proDressGoalies === 2 && proScratchCount <= 3;

  $: rosterIssues = [
    proDressSkaters !== 18  ? `${proDressSkaters}/18 skaters in Pro Dress`  : null,
    proDressGoalies !== 2   ? `${proDressGoalies}/2 goalies in Pro Dress`   : null,
    proScratchCount > 3     ? `${proScratchCount}/3 max scratches`           : null,
  ].filter((x): x is string => x !== null);

  // ── Position filter ───────────────────────────────────────────────────────────
  const POS_FILTERS = ['All', 'C', 'LW', 'RW', 'D', 'G'] as const;
  type PosFilter = typeof POS_FILTERS[number];
  let posFilter: PosFilter = 'All';

  function matchesFilter(card: Card): boolean {
    if (posFilter === 'All') return true;
    if (posFilter === 'G')   return card.is_goalie;
    if (card.is_goalie)      return false;
    const parts = card.position.split('/');
    switch (posFilter) {
      case 'C':  return parts.some(p => p === 'C');
      case 'LW': return parts.some(p => p === 'L' || p === 'LW');
      case 'RW': return parts.some(p => p === 'R' || p === 'RW');
      case 'D':  return parts.some(p => p === 'D' || /^[LR]D$/.test(p));
      default:   return true;
    }
  }

  // ── Mouse drag-and-drop ───────────────────────────────────────────────────────
  let dragId:     number | null = null;
  let dragFrom:   Column | null = null;
  let dropTarget: Column | null = null;

  function startDrag(e: DragEvent, id: number, from: Column) {
    dragId = id; dragFrom = from;
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; }
  }

  function onDragOver(e: DragEvent, col: Column) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dropTarget = col;
  }

  function onDrop(e: DragEvent, to: Column) {
    e.preventDefault();
    dropTarget = null;
    if (dragId === null || !dragFrom || dragFrom === to) { dragId = null; dragFrom = null; return; }
    doMove(dragId, dragFrom, to);
    dragId = null; dragFrom = null;
  }

  function onDragEnd() { dragId = null; dragFrom = null; dropTarget = null; }

  // ── Touch drag-and-drop ───────────────────────────────────────────────────────
  let touchGhost:     HTMLElement | null = null;
  let touchDragId:    number | null      = null;
  let touchFrom:      Column | null      = null;
  let touchDropCol:   Column | null      = null;

  function onTouchStart(e: TouchEvent, id: number, from: Column) {
    const touch  = e.touches[0];
    const target = e.currentTarget as HTMLElement;
    const rect   = target.getBoundingClientRect();

    touchDragId = id;
    touchFrom   = from;
    dragId      = id; // triggers opacity on source card

    touchGhost = target.cloneNode(true) as HTMLElement;
    Object.assign(touchGhost.style, {
      position:      'fixed',
      left:          `${touch.clientX - rect.width / 2}px`,
      top:           `${touch.clientY - rect.height / 2}px`,
      width:         `${rect.width}px`,
      opacity:       '0.85',
      pointerEvents: 'none',
      zIndex:        '9999',
      transform:     'rotate(2deg) scale(1.03)',
      boxShadow:     '0 8px 24px rgba(0,0,0,0.5)',
      transition:    'none',
    });
    document.body.appendChild(touchGhost);
  }

  // Attached via onMount to allow passive:false
  function handleTouchMove(e: TouchEvent) {
    if (touchDragId === null || !touchGhost) return;
    e.preventDefault(); // stops page scroll while dragging
    const touch = e.touches[0];
    const w = parseFloat(touchGhost.style.width);
    touchGhost.style.left = `${touch.clientX - w / 2}px`;
    touchGhost.style.top  = `${touch.clientY - 30}px`;

    // Find which column is under the finger (hide ghost briefly for hit test)
    touchGhost.style.visibility = 'hidden';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    touchGhost.style.visibility = '';

    const colEl = el?.closest('[data-col]') as HTMLElement | null;
    const detected = (colEl?.dataset?.col ?? null) as Column | null;
    if (detected !== touchDropCol) {
      touchDropCol = detected;
      dropTarget   = detected; // highlight column
    }
  }

  function handleTouchEnd() {
    if (touchDragId !== null && touchFrom && touchDropCol && touchDropCol !== touchFrom) {
      doMove(touchDragId, touchFrom, touchDropCol);
    }
    touchGhost?.remove();
    touchGhost = null; touchDragId = null; touchFrom = null;
    touchDropCol = null; dragId = null; dropTarget = null;
  }

  onMount(() => {
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend',  handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend',  handleTouchEnd);
    };
  });

  // ── Shared move logic ─────────────────────────────────────────────────────────
  function doMove(id: number, from: Column, to: Column) {
    const card = cols[from].find(c => c.id === id);
    if (!card) return;
    cols[from] = cols[from].filter(c => c.id !== id);
    cols[to]   = [...cols[to], card];
    cols       = { ...cols };
  }

  // ── Column metadata ───────────────────────────────────────────────────────────
  const COL_META: Record<Column, { label: string; headerClass: string }> = {
    proDress:    { label: 'Pro Dress',    headerClass: 'text-rwha-amber' },
    proScratch:  { label: 'Pro Scratch',  headerClass: 'text-rwha-red'   },
    farmDress:   { label: 'Farm Dress',   headerClass: 'text-rwha-muted' },
    farmScratch: { label: 'Farm Scratch', headerClass: 'text-rwha-muted' },
  };
</script>

<svelte:head><title>Roster — RWHA Sim</title></svelte:head>

<!-- ── Top bar ───────────────────────────────────────────────────────────────── -->
<div class="mb-3 flex items-start justify-between gap-4 flex-wrap">

  <!-- Left: next game + roster status -->
  <div class="flex flex-col gap-1">
    <!-- Next game -->
    {#if data.nextGame}
      <div class="font-mono text-xs text-rwha-muted">
        Next Game: <span class="text-rwha-text font-semibold">
          Week {data.nextGame.week} — {data.nextGame.is_home ? 'vs' : '@'} {data.nextGame.opponent}
        </span>
      </div>
    {/if}

    <!-- Roster status -->
    {#if rosterOk}
      <div class="font-mono text-xs text-rwha-green font-semibold">
        ✓ Roster complete — 18 skaters · 2 goalies · {proScratchCount} scratch{proScratchCount === 1 ? '' : 'es'}
      </div>
    {:else}
      <div class="flex flex-wrap gap-2">
        {#each rosterIssues as issue}
          <span class="font-mono text-xs text-rwha-red">⚠ {issue}</span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Right: save button -->
  <div class="flex items-center gap-3">
    {#if form?.ok}
      <span class="font-mono text-xs text-rwha-green">Saved ✓</span>
    {/if}
    {#if form?.error}
      <span class="font-mono text-xs text-rwha-red">{form.error}</span>
    {/if}
    <form method="POST" action="?/saveRoster" use:enhance>
      <input type="hidden" name="moves" value={movesJson} />
      <button
        type="submit"
        disabled={dirty.length === 0}
        class="px-4 py-1.5 rounded font-mono font-bold text-xs uppercase tracking-widest transition-all
               {dirty.length > 0
                 ? 'bg-rwha-amber text-rwha-bg hover:brightness-110 active:scale-95 cursor-pointer'
                 : 'bg-rwha-surface border border-rwha-border text-rwha-muted cursor-not-allowed'}"
      >Save Roster{dirty.length > 0 ? ` (${dirty.length})` : ''}</button>
    </form>
  </div>
</div>

<!-- ── Position filter chips ─────────────────────────────────────────────────── -->
<div class="mb-3 flex gap-1.5 flex-wrap">
  <span class="font-mono text-xs text-rwha-muted self-center mr-1">Filter:</span>
  {#each POS_FILTERS as f}
    <button
      on:click={() => posFilter = f}
      class="px-3 py-0.5 rounded border font-mono text-xs transition-colors
             {posFilter === f
               ? 'border-rwha-amber bg-rwha-amber/15 text-rwha-amber'
               : 'border-rwha-border text-rwha-muted hover:border-rwha-amber/40 hover:text-rwha-text'}"
    >{f}</button>
  {/each}
</div>

<!-- ── 4-column board ─────────────────────────────────────────────────────────── -->
<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
  {#each Object.keys(COL_META) as colStr (colStr)}
    {@const col      = colStr as Column}
    {@const meta     = COL_META[col]}
    {@const cards    = cols[col]}
    {@const visible  = cards.filter(matchesFilter)}
    {@const isTarget = dropTarget === col}

    <div
      data-col={col}
      class="rounded border transition-colors duration-100 flex flex-col min-h-[240px]
             {isTarget ? 'border-rwha-amber bg-rwha-amber/5' : 'border-rwha-border bg-rwha-surface'}"
      on:dragover={e => onDragOver(e, col)}
      on:drop={e => onDrop(e, col)}
      on:dragleave={() => { if (dropTarget === col) dropTarget = null; }}
      role="list"
      aria-label={meta.label}
    >
      <!-- Column header -->
      <div class="px-3 py-2 border-b border-rwha-border flex items-center justify-between shrink-0">
        <span class="font-mono font-bold text-xs uppercase tracking-wider {meta.headerClass}">
          {meta.label}
        </span>
        <span class="font-mono text-xs text-rwha-muted">
          {visible.length}{visible.length !== cards.length ? `/${cards.length}` : ''}
        </span>
      </div>

      <!-- Cards -->
      <div class="p-2 flex flex-col gap-1 flex-1">
        {#each cards as card (card.id)}
          <!-- Hidden by filter but kept in DOM so drop still works -->
          <div
            draggable="true"
            on:dragstart={e => startDrag(e, card.id, col)}
            on:dragend={onDragEnd}
            on:touchstart|passive={e => onTouchStart(e, card.id, col)}
            role="listitem"
            title="Drag to move {card.name}"
            class="px-2.5 py-1.5 rounded border cursor-grab active:cursor-grabbing select-none
                   transition-all duration-150 touch-none
                   {!matchesFilter(card) ? 'hidden' : ''}
                   {dragId === card.id ? 'opacity-25' : 'opacity-100'}
                   {card.injured_games_remaining > 0
                     ? 'border-rwha-red/50 bg-rwha-red/5'
                     : 'border-rwha-border/60 bg-rwha-bg hover:border-rwha-border'}"
          >
            <div class="flex items-center justify-between gap-1.5">
              <span class="font-mono text-xs font-semibold text-rwha-text leading-tight truncate">
                {#if card.injured_games_remaining > 0}
                  <span class="text-rwha-red">⚠</span>{' '}
                {/if}
                {#if card.is_personal}
                  <span class="text-rwha-amber" title="Personal player">★</span>{' '}
                {/if}
                {card.name}
              </span>
              <span class="font-mono text-xs font-bold text-rwha-amber shrink-0">{card.ov}</span>
            </div>
            <div class="font-mono text-[10px] text-rwha-muted mt-0.5 leading-tight">
              {card.is_goalie ? 'G' : card.position.replace(/\//g, ',')}
              {#if card.is_personal}
                <span class="text-rwha-amber/60 ml-1">$8.5M</span>
              {/if}
              {#if card.injured_games_remaining > 0}
                <span class="text-rwha-red ml-1">INJ·{card.injured_games_remaining}g</span>
              {/if}
            </div>
          </div>
        {/each}

        <!-- Empty / all-filtered hint -->
        {#if visible.length === 0}
          <div class="flex-1 flex items-center justify-center">
            <span class="font-mono text-xs text-rwha-muted/30 select-none">
              {cards.length === 0 ? 'drop here' : `no ${posFilter} here`}
            </span>
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

<!-- ── Rules note ─────────────────────────────────────────────────────────────── -->
<div class="mt-4 font-mono text-xs text-rwha-muted flex gap-4 flex-wrap">
  <span>Pro Dress: <span class="text-rwha-text">18 skaters + 2 goalies</span></span>
  <span class="text-rwha-border">·</span>
  <span>Pro Scratch: <span class="text-rwha-text">max 3</span> (any position)</span>
  <span class="text-rwha-border">·</span>
  <span>Farm salaries don't count toward cap</span>
</div>
