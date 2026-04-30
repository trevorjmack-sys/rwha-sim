<script lang="ts">
  import { enhance } from '$app/forms';
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
      // Forwards (0) → Defense (1) → Goalies (2), then by OV desc
      const rank = (c: Card) => c.is_goalie ? 2 : isDefense(c.position) ? 1 : 0;
      const dr = rank(a) - rank(b);
      return dr !== 0 ? dr : b.ov - a.ov;
    });
  }

  // ── Initialise columns from server data ──────────────────────────────────────
  function initCols(): Record<Column, Card[]> {
    const c: Record<Column, Card[]> = {
      proDress: [], proScratch: [], farmDress: [], farmScratch: [],
    };
    for (const p of data.players) {
      c[colKey(p.roster_level, p.is_scratch)].push({
        id: p.id,
        name: p.name,
        position: p.position,
        ov: p.ov,
        is_goalie: !!p.is_goalie,
        injured_games_remaining: p.injured_games_remaining,
      });
    }
    for (const k of Object.keys(c) as Column[]) c[k] = sortCards(c[k]);
    return c;
  }

  let cols = initCols();

  // ── Dirty tracking ───────────────────────────────────────────────────────────
  // Snapshot original positions so we know what actually changed
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

  // ── Roster completeness ──────────────────────────────────────────────────────
  $: proSkaters  = cols.proDress.filter(c => !c.is_goalie).length;
  $: proGoalies  = cols.proDress.filter(c => c.is_goalie).length;
  $: rosterOk    = proSkaters >= 12 && proGoalies >= 2;

  // ── Drag-and-drop state ──────────────────────────────────────────────────────
  let dragId:     number | null = null;
  let dragFrom:   Column | null = null;
  let dropTarget: Column | null = null;

  function startDrag(e: DragEvent, id: number, from: Column) {
    dragId   = id;
    dragFrom = from;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(id));
    }
  }

  function onDragOver(e: DragEvent, col: Column) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dropTarget = col;
  }

  function onDrop(e: DragEvent, to: Column) {
    e.preventDefault();
    dropTarget = null;
    if (dragId === null || !dragFrom || dragFrom === to) {
      dragId = null; dragFrom = null;
      return;
    }
    const id   = dragId;
    const from = dragFrom;
    const card = cols[from].find(c => c.id === id);
    if (!card) { dragId = null; dragFrom = null; return; }

    cols[from] = cols[from].filter(c => c.id !== id);
    cols[to]   = [...cols[to], card];
    cols = { ...cols };  // trigger Svelte reactivity

    dragId = null; dragFrom = null;
  }

  function onDragEnd() {
    dragId = null; dragFrom = null; dropTarget = null;
  }

  // ── Column metadata ──────────────────────────────────────────────────────────
  const COL_META: Record<Column, { label: string; headerClass: string }> = {
    proDress:    { label: 'Pro Dress',    headerClass: 'text-rwha-amber'  },
    proScratch:  { label: 'Pro Scratch',  headerClass: 'text-rwha-red'    },
    farmDress:   { label: 'Farm Dress',   headerClass: 'text-rwha-muted'  },
    farmScratch: { label: 'Farm Scratch', headerClass: 'text-rwha-muted'  },
  };
</script>

<svelte:head><title>Roster — RWHA Sim</title></svelte:head>

<!-- ── Top bar ───────────────────────────────────────────────────────────────── -->
<div class="mb-4 flex items-center justify-between gap-4 flex-wrap">

  <!-- Status -->
  <div class="flex items-center gap-3 flex-wrap">
    <span class="font-mono text-xs font-semibold {rosterOk ? 'text-rwha-green' : 'text-rwha-red'}">
      {rosterOk ? '✓ Roster is complete' : '✗ Roster incomplete'}
    </span>
    <span class="text-rwha-muted font-mono text-xs">
      {proSkaters} skaters · {proGoalies} goalies in Pro Dress
    </span>
  </div>

  <!-- Save feedback + button -->
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

<!-- ── 4-column board ─────────────────────────────────────────────────────────── -->
<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
  {#each Object.keys(COL_META) as colStr (colStr)}
    {@const col  = colStr as Column}
    {@const meta = COL_META[col]}
    {@const cards = cols[col]}
    {@const isTarget = dropTarget === col}

    <!-- Drop zone column -->
    <div
      class="rounded border transition-colors duration-100 flex flex-col min-h-[240px]
             {isTarget
               ? 'border-rwha-amber bg-rwha-amber/5'
               : 'border-rwha-border bg-rwha-surface'}"
      on:dragover={e => onDragOver(e, col)}
      on:drop={e => onDrop(e, col)}
      on:dragleave={() => { if (dropTarget === col) dropTarget = null; }}
      role="list"
      aria-label="{meta.label}"
    >
      <!-- Column header -->
      <div class="px-3 py-2 border-b border-rwha-border flex items-center justify-between shrink-0">
        <span class="font-mono font-bold text-xs uppercase tracking-wider {meta.headerClass}">
          {meta.label}
        </span>
        <span class="font-mono text-xs text-rwha-muted">{cards.length}</span>
      </div>

      <!-- Cards list -->
      <div class="p-2 flex flex-col gap-1 flex-1">
        {#each cards as card (card.id)}
          <!-- Player card -->
          <div
            draggable="true"
            on:dragstart={e => startDrag(e, card.id, col)}
            on:dragend={onDragEnd}
            role="listitem"
            title="Drag to move {card.name}"
            class="px-2.5 py-1.5 rounded border cursor-grab active:cursor-grabbing select-none
                   transition-opacity duration-150
                   {dragId === card.id ? 'opacity-25' : 'opacity-100'}
                   {card.injured_games_remaining > 0
                     ? 'border-rwha-red/50 bg-rwha-red/5'
                     : 'border-rwha-border/60 bg-rwha-bg hover:border-rwha-border'}"
          >
            <div class="flex items-center justify-between gap-1.5">
              <!-- Name -->
              <span class="font-mono text-xs font-semibold text-rwha-text leading-tight truncate">
                {#if card.injured_games_remaining > 0}
                  <span class="text-rwha-red">⚠</span>{' '}
                {/if}
                {card.name}
              </span>
              <!-- OV -->
              <span class="font-mono text-xs font-bold text-rwha-amber shrink-0">{card.ov}</span>
            </div>
            <!-- Position + injury games -->
            <div class="font-mono text-[10px] text-rwha-muted mt-0.5 leading-tight">
              {card.is_goalie ? 'G' : card.position.replace(/\//g, ',')}
              {#if card.injured_games_remaining > 0}
                <span class="text-rwha-red ml-1">INJ·{card.injured_games_remaining}g</span>
              {/if}
            </div>
          </div>
        {/each}

        <!-- Empty drop target hint -->
        {#if cards.length === 0}
          <div class="flex-1 flex items-center justify-center">
            <span class="font-mono text-xs text-rwha-muted/30 select-none">drop here</span>
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

<!-- ── Legend ─────────────────────────────────────────────────────────────────── -->
<div class="mt-4 text-rwha-muted font-mono text-xs flex gap-4 flex-wrap">
  <span>Drag players between columns to move them.</span>
  <span class="text-rwha-amber">●</span><span>Pro Dress = active roster</span>
  <span class="text-rwha-red">●</span><span>Pro Scratch = healthy scratch</span>
  <span>Farm columns = AHL roster</span>
</div>
