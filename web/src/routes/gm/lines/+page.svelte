<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  // ── Player pools ────────────────────────────────────────────────────────────
  // Positions in DB are STHS multi-value strings: C/L, C/R, L/R, D, LD, RD, G etc.
  function isDefense(pos: string) { return /^[LR]?D$/.test(pos) || pos === 'D'; }

  $: proPlayers = data.players.filter(p => p.roster_level === 'pro' && !p.is_scratch);
  $: forwards   = proPlayers.filter(p => !p.is_goalie && !isDefense(p.position));
  $: defensemen = proPlayers.filter(p => !p.is_goalie &&  isDefense(p.position));
  $: goaliePool = proPlayers.filter(p =>  p.is_goalie);

  // ── Parse stored lines → initial slot values ────────────────────────────────
  type FwdKey  = 'f1_lw'|'f1_c'|'f1_rw'|'f2_lw'|'f2_c'|'f2_rw'|'f3_lw'|'f3_c'|'f3_rw'|'f4_lw'|'f4_c'|'f4_rw';
  type DefKey  = 'd1_ld'|'d1_rd'|'d2_ld'|'d2_rd'|'d3_ld'|'d3_rd';
  type GoalKey = 'starter'|'backup';
  type PPKey   = 'pp1_lw'|'pp1_c'|'pp1_rw'|'pp1_ld'|'pp1_rd'|'pp2_lw'|'pp2_c'|'pp2_rw'|'pp2_ld'|'pp2_rd';
  type PKKey   = 'pk1_lf'|'pk1_rf'|'pk1_ld'|'pk1_rd'|'pk2_lf'|'pk2_rf'|'pk2_ld'|'pk2_rd'|'pk3_f1'|'pk3_f2'|'pk3_d';
  type SlotKey = FwdKey | DefKey | GoalKey | PPKey | PKKey;

  function initSlots(): Record<SlotKey, number> {
    // Use stored manual lines if available and not in computer mode,
    // otherwise fall back to computer-generated lines as a pre-filled starting point.
    const sl = (!data.useComputer && data.storedLines) ? data.storedLines : (data.computerLines ?? data.storedLines);
    const b  = 0;
    return {
      // Even strength
      f1_lw: sl?.forwards[0]?.[0] ?? b, f1_c: sl?.forwards[0]?.[1] ?? b, f1_rw: sl?.forwards[0]?.[2] ?? b,
      f2_lw: sl?.forwards[1]?.[0] ?? b, f2_c: sl?.forwards[1]?.[1] ?? b, f2_rw: sl?.forwards[1]?.[2] ?? b,
      f3_lw: sl?.forwards[2]?.[0] ?? b, f3_c: sl?.forwards[2]?.[1] ?? b, f3_rw: sl?.forwards[2]?.[2] ?? b,
      f4_lw: sl?.forwards[3]?.[0] ?? b, f4_c: sl?.forwards[3]?.[1] ?? b, f4_rw: sl?.forwards[3]?.[2] ?? b,
      d1_ld: sl?.defense[0]?.[0] ?? b,  d1_rd: sl?.defense[0]?.[1] ?? b,
      d2_ld: sl?.defense[1]?.[0] ?? b,  d2_rd: sl?.defense[1]?.[1] ?? b,
      d3_ld: sl?.defense[2]?.[0] ?? b,  d3_rd: sl?.defense[2]?.[1] ?? b,
      starter: sl?.starter_id ?? b,
      backup:  sl?.backup_id  ?? b,
      // Power play
      pp1_lw: sl?.pp?.[0]?.[0] ?? b, pp1_c: sl?.pp?.[0]?.[1] ?? b, pp1_rw: sl?.pp?.[0]?.[2] ?? b,
      pp1_ld: sl?.pp?.[0]?.[3] ?? b, pp1_rd: sl?.pp?.[0]?.[4] ?? b,
      pp2_lw: sl?.pp?.[1]?.[0] ?? b, pp2_c: sl?.pp?.[1]?.[1] ?? b, pp2_rw: sl?.pp?.[1]?.[2] ?? b,
      pp2_ld: sl?.pp?.[1]?.[3] ?? b, pp2_rd: sl?.pp?.[1]?.[4] ?? b,
      // Penalty kill 4-on-5
      pk1_lf: sl?.pk?.[0]?.[0] ?? b, pk1_rf: sl?.pk?.[0]?.[1] ?? b,
      pk1_ld: sl?.pk?.[0]?.[2] ?? b, pk1_rd: sl?.pk?.[0]?.[3] ?? b,
      pk2_lf: sl?.pk?.[1]?.[0] ?? b, pk2_rf: sl?.pk?.[1]?.[1] ?? b,
      pk2_ld: sl?.pk?.[1]?.[2] ?? b, pk2_rd: sl?.pk?.[1]?.[3] ?? b,
      // Penalty kill 3-on-5
      pk3_f1: sl?.pk3on5?.[0] ?? b,
      pk3_f2: sl?.pk3on5?.[1] ?? b,
      pk3_d:  sl?.pk3on5?.[2] ?? b,
    };
  }

  let slots = initSlots();
  let useComputer = data.useComputer;

  // Duplicate detection for even-strength lines
  $: skaterSlots = [
    slots.f1_lw, slots.f1_c, slots.f1_rw,
    slots.f2_lw, slots.f2_c, slots.f2_rw,
    slots.f3_lw, slots.f3_c, slots.f3_rw,
    slots.f4_lw, slots.f4_c, slots.f4_rw,
    slots.d1_ld, slots.d1_rd,
    slots.d2_ld, slots.d2_rd,
    slots.d3_ld, slots.d3_rd,
  ];
  $: duplicateIds = new Set(
    skaterSlots.filter((id, i) => id !== 0 && skaterSlots.indexOf(id) !== i)
  );

  // Duplicate detection within each PP/PK unit
  function unitDups(ids: number[]): Set<number> {
    return new Set(ids.filter((id, i) => id !== 0 && ids.indexOf(id) !== i));
  }
  $: pp1Slots = [slots.pp1_lw, slots.pp1_c, slots.pp1_rw, slots.pp1_ld, slots.pp1_rd];
  $: pp2Slots = [slots.pp2_lw, slots.pp2_c, slots.pp2_rw, slots.pp2_ld, slots.pp2_rd];
  $: pk1Slots = [slots.pk1_lf, slots.pk1_rf, slots.pk1_ld, slots.pk1_rd];
  $: pk2Slots = [slots.pk2_lf, slots.pk2_rf, slots.pk2_ld, slots.pk2_rd];
  $: pk3Slots = [slots.pk3_f1, slots.pk3_f2, slots.pk3_d];
  $: pp1Dups = unitDups(pp1Slots);
  $: pp2Dups = unitDups(pp2Slots);
  $: pk1Dups = unitDups(pk1Slots);
  $: pk2Dups = unitDups(pk2Slots);
  $: pk3Dups = unitDups(pk3Slots);

  function playerLabel(p: typeof data.players[0]) {
    const inj = p.injured_games_remaining > 0 ? ' ⚠' : '';
    const pos = p.is_goalie ? 'G' : p.position.replace(/\//g, ',');
    return `${p.name}  —  ${pos}  (${p.ov})${inj}`;
  }

  function slotClass(id: number, dups: Set<number> = duplicateIds) {
    if (id === 0) return 'border-rwha-red/50';
    if (dups.has(id)) return 'border-rwha-red';
    return 'border-rwha-border';
  }
</script>

<svelte:head><title>Lines — RWHA Sim</title></svelte:head>

{#if form?.error}
  <div class="mb-4 p-3 rounded border border-rwha-red/40 bg-rwha-red/10 text-rwha-red font-mono text-sm">
    {form.error}
  </div>
{/if}
{#if form?.ok}
  <div class="mb-4 p-3 rounded border border-rwha-green/40 bg-rwha-green/10 text-rwha-green font-mono text-sm">
    Lines saved ✓
  </div>
{/if}

<!-- ── Computer lines toggle ─────────────────────────────────────────────────── -->
<div class="card px-4 py-4 mb-5 flex items-center justify-between gap-4">
  <div>
    <div class="font-semibold text-sm {useComputer ? 'text-rwha-amber' : 'text-rwha-text'}">
      {useComputer ? 'Computer Lines (showing auto-generated)' : 'Manual Lines'}
    </div>
    <div class="text-xs font-mono text-rwha-muted mt-0.5">
      {#if useComputer}
        Lines below are auto-assigned by OV. Edit and save to lock in your own.
      {:else}
        Your saved lines are shown below. Toggle on to reset to auto-generated.
      {/if}
    </div>
  </div>

  <form method="POST" action="?/setComputer" use:enhance={({ formData }) => {
    const switchingTo = formData.get('useComputer') === '1';
    useComputer = switchingTo;
    // Re-init slots when toggling back to computer lines
    if (switchingTo) slots = initSlots();
    return async ({ update }) => update();
  }}>
    <input type="hidden" name="useComputer" value={useComputer ? '0' : '1'} />
    <button
      type="submit"
      aria-label="{useComputer ? 'Switch to manual lines' : 'Switch to computer lines'}"
      class="relative w-12 h-6 rounded-full border-2 transition-colors duration-200
             {useComputer
               ? 'border-rwha-amber bg-rwha-amber/20'
               : 'border-rwha-border bg-transparent'}"
    >
      <span class="absolute top-0.5 transition-all duration-200 w-4 h-4 rounded-full
                   {useComputer ? 'left-6 bg-rwha-amber' : 'left-0.5 bg-rwha-muted'}">
      </span>
    </button>
  </form>
</div>

<!-- ── Lines form (always shown) ─────────────────────────────────────────────── -->
<form method="POST" action="?/saveLines" use:enhance>

  <!-- Forward lines -->
  <div class="section-header">Forward Lines</div>
  <div class="card mb-4 divide-y divide-rwha-border/40">
    {#each [1,2,3,4] as line}
      <div class="px-4 py-3 flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <span class="text-rwha-muted font-mono text-xs w-12 shrink-0">Line {line}</span>

        {#each (['lw','c','rw'] as const) as pos}
          <div class="flex-1 min-w-[140px]">
            <label for="f{line}_{pos}" class="text-rwha-muted font-mono text-xs block mb-0.5">{pos.toUpperCase()}</label>
            <select
              id="f{line}_{pos}"
              name="f{line}_{pos}"
              bind:value={slots[`f${line}_${pos}` as FwdKey]}
              class="w-full bg-rwha-bg border rounded px-2 py-1.5 font-mono text-xs text-rwha-text
                     focus:outline-none focus:border-rwha-amber/60 transition-colors
                     {slotClass(slots[`f${line}_${pos}` as FwdKey])}"
            >
              <option value={0}>— unset —</option>
              {#each forwards as p (p.id)}
                <option value={p.id}>{playerLabel(p)}</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Defense pairs -->
  <div class="section-header">Defense Pairs</div>
  <div class="card mb-4 divide-y divide-rwha-border/40">
    {#each [1,2,3] as pair}
      <div class="px-4 py-3 flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <span class="text-rwha-muted font-mono text-xs w-12 shrink-0">Pair {pair}</span>

        {#each (['ld','rd'] as const) as pos}
          <div class="flex-1 min-w-[180px]">
            <label for="d{pair}_{pos}" class="text-rwha-muted font-mono text-xs block mb-0.5">{pos.toUpperCase()}</label>
            <select
              id="d{pair}_{pos}"
              name="d{pair}_{pos}"
              bind:value={slots[`d${pair}_${pos}` as DefKey]}
              class="w-full bg-rwha-bg border rounded px-2 py-1.5 font-mono text-xs text-rwha-text
                     focus:outline-none focus:border-rwha-amber/60 transition-colors
                     {slotClass(slots[`d${pair}_${pos}` as DefKey])}"
            >
              <option value={0}>— unset —</option>
              {#each defensemen as p (p.id)}
                <option value={p.id}>{playerLabel(p)}</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Goalies -->
  <div class="section-header">Goalies</div>
  <div class="card mb-5">
    <div class="px-4 py-3 flex items-center gap-4 flex-wrap sm:flex-nowrap">
      {#each ([['starter','Starter'],['backup','Backup']] as const) as [key, label]}
        <div class="flex-1 min-w-[180px]">
          <label for={key} class="text-rwha-muted font-mono text-xs block mb-0.5">{label}</label>
          <select
            id={key}
            name={key}
            bind:value={slots[key]}
            class="w-full bg-rwha-bg border rounded px-2 py-1.5 font-mono text-xs text-rwha-text
                   focus:outline-none focus:border-rwha-amber/60 transition-colors
                   {slots.starter !== 0 && slots.starter === slots.backup ? 'border-rwha-red' : 'border-rwha-border'}"
          >
            <option value={0}>— unset —</option>
            {#each goaliePool as p (p.id)}
              <option value={p.id}>{playerLabel(p)}</option>
            {/each}
          </select>
        </div>
      {/each}
    </div>
  </div>

  <!-- ── Power Play ──────────────────────────────────────────────────────────── -->
  <div class="section-header">Power Play (5-on-4)</div>
  <div class="card mb-4 divide-y divide-rwha-border/40">
    {#each ([
      ['PP1', 'pp1', pp1Dups],
      ['PP2', 'pp2', pp2Dups],
    ] as [string, string, Set<number>][]) as [label, pfx, dups]}
      <div class="px-4 py-3">
        <div class="text-rwha-muted font-mono text-xs mb-2">{label}</div>
        <div class="flex items-start gap-2 flex-wrap sm:flex-nowrap">
          <!-- Forwards -->
          {#each (['lw','c','rw'] as const) as pos}
            <div class="flex-1 min-w-[140px]">
              <label for="{pfx}_{pos}" class="text-rwha-muted font-mono text-xs block mb-0.5">{pos.toUpperCase()}</label>
              <select id="{pfx}_{pos}" name="{pfx}_{pos}"
                bind:value={slots[`${pfx}_${pos}` as PPKey]}
                class="w-full bg-rwha-bg border rounded px-2 py-1.5 font-mono text-xs text-rwha-text
                       focus:outline-none focus:border-rwha-amber/60 transition-colors
                       {slotClass(slots[`${pfx}_${pos}` as PPKey], dups)}">
                <option value={0}>— unset —</option>
                {#each forwards as p (p.id)}<option value={p.id}>{playerLabel(p)}</option>{/each}
              </select>
            </div>
          {/each}
          <!-- Defence -->
          {#each (['ld','rd'] as const) as pos}
            <div class="flex-1 min-w-[140px]">
              <label for="{pfx}_{pos}" class="text-rwha-muted font-mono text-xs block mb-0.5">{pos.toUpperCase()}</label>
              <select id="{pfx}_{pos}" name="{pfx}_{pos}"
                bind:value={slots[`${pfx}_${pos}` as PPKey]}
                class="w-full bg-rwha-bg border rounded px-2 py-1.5 font-mono text-xs text-rwha-text
                       focus:outline-none focus:border-rwha-amber/60 transition-colors
                       {slotClass(slots[`${pfx}_${pos}` as PPKey], dups)}">
                <option value={0}>— unset —</option>
                {#each defensemen as p (p.id)}<option value={p.id}>{playerLabel(p)}</option>{/each}
              </select>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- ── Penalty Kill ─────────────────────────────────────────────────────────── -->
  <div class="section-header">Penalty Kill (4-on-5)</div>
  <div class="card mb-4 divide-y divide-rwha-border/40">
    {#each ([
      ['PK1', 'pk1', pk1Dups],
      ['PK2', 'pk2', pk2Dups],
    ] as [string, string, Set<number>][]) as [label, pfx, dups]}
      <div class="px-4 py-3">
        <div class="text-rwha-muted font-mono text-xs mb-2">{label}</div>
        <div class="flex items-start gap-2 flex-wrap sm:flex-nowrap">
          <!-- Forwards -->
          {#each (['lf','rf'] as const) as pos}
            <div class="flex-1 min-w-[140px]">
              <label for="{pfx}_{pos}" class="text-rwha-muted font-mono text-xs block mb-0.5">{pos.toUpperCase()}</label>
              <select id="{pfx}_{pos}" name="{pfx}_{pos}"
                bind:value={slots[`${pfx}_${pos}` as PKKey]}
                class="w-full bg-rwha-bg border rounded px-2 py-1.5 font-mono text-xs text-rwha-text
                       focus:outline-none focus:border-rwha-amber/60 transition-colors
                       {slotClass(slots[`${pfx}_${pos}` as PKKey], dups)}">
                <option value={0}>— unset —</option>
                {#each forwards as p (p.id)}<option value={p.id}>{playerLabel(p)}</option>{/each}
              </select>
            </div>
          {/each}
          <!-- Defence -->
          {#each (['ld','rd'] as const) as pos}
            <div class="flex-1 min-w-[140px]">
              <label for="{pfx}_{pos}" class="text-rwha-muted font-mono text-xs block mb-0.5">{pos.toUpperCase()}</label>
              <select id="{pfx}_{pos}" name="{pfx}_{pos}"
                bind:value={slots[`${pfx}_${pos}` as PKKey]}
                class="w-full bg-rwha-bg border rounded px-2 py-1.5 font-mono text-xs text-rwha-text
                       focus:outline-none focus:border-rwha-amber/60 transition-colors
                       {slotClass(slots[`${pfx}_${pos}` as PKKey], dups)}">
                <option value={0}>— unset —</option>
                {#each defensemen as p (p.id)}<option value={p.id}>{playerLabel(p)}</option>{/each}
              </select>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- ── Penalty Kill 3-on-5 ──────────────────────────────────────────────────── -->
  <div class="section-header">Penalty Kill (3-on-5)</div>
  <div class="card mb-5">
    <div class="px-4 py-3">
      <div class="flex items-start gap-2 flex-wrap sm:flex-nowrap">
        {#each (['f1','f2'] as const) as pos}
          <div class="flex-1 min-w-[140px]">
            <label for="pk3_{pos}" class="text-rwha-muted font-mono text-xs block mb-0.5">F{pos[1]}</label>
            <select id="pk3_{pos}" name="pk3_{pos}"
              bind:value={slots[`pk3_${pos}` as PKKey]}
              class="w-full bg-rwha-bg border rounded px-2 py-1.5 font-mono text-xs text-rwha-text
                     focus:outline-none focus:border-rwha-amber/60 transition-colors
                     {slotClass(slots[`pk3_${pos}` as PKKey], pk3Dups)}">
              <option value={0}>— unset —</option>
              {#each forwards as p (p.id)}<option value={p.id}>{playerLabel(p)}</option>{/each}
            </select>
          </div>
        {/each}
        <div class="flex-1 min-w-[140px]">
          <label for="pk3_d" class="text-rwha-muted font-mono text-xs block mb-0.5">D</label>
          <select id="pk3_d" name="pk3_d"
            bind:value={slots.pk3_d}
            class="w-full bg-rwha-bg border rounded px-2 py-1.5 font-mono text-xs text-rwha-text
                   focus:outline-none focus:border-rwha-amber/60 transition-colors
                   {slotClass(slots.pk3_d, pk3Dups)}">
            <option value={0}>— unset —</option>
            {#each defensemen as p (p.id)}<option value={p.id}>{playerLabel(p)}</option>{/each}
          </select>
        </div>
        <!-- spacers to keep layout consistent on wide screens -->
        <div class="flex-1 min-w-[140px] hidden sm:block"></div>
        <div class="flex-1 min-w-[140px] hidden sm:block"></div>
      </div>
    </div>
  </div>

  <!-- Warnings -->
  {#if duplicateIds.size > 0}
    <div class="mb-3 p-3 rounded border border-rwha-red/40 bg-rwha-red/10 text-rwha-red font-mono text-xs">
      ⚠ Some players are assigned to multiple even-strength lines.
    </div>
  {/if}

  <!-- Save button -->
  <div class="flex items-center justify-end gap-3">
    {#if useComputer}
      <span class="text-xs font-mono text-rwha-muted">Saving will switch to manual lines</span>
    {/if}
    <button
      type="submit"
      class="px-6 py-2 rounded font-mono font-bold text-sm uppercase tracking-widest
             bg-rwha-amber text-rwha-bg hover:brightness-110 active:scale-95 transition-all"
    >
      {useComputer ? 'Save as Manual Lines' : 'Save Lines'}
    </button>
  </div>

</form>
