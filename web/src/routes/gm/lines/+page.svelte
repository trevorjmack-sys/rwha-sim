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
  type FwdKey = 'f1_lw'|'f1_c'|'f1_rw'|'f2_lw'|'f2_c'|'f2_rw'|'f3_lw'|'f3_c'|'f3_rw'|'f4_lw'|'f4_c'|'f4_rw';
  type DefKey = 'd1_ld'|'d1_rd'|'d2_ld'|'d2_rd'|'d3_ld'|'d3_rd';
  type GoalKey = 'starter'|'backup';
  type SlotKey = FwdKey | DefKey | GoalKey;

  function initSlots(): Record<SlotKey, number> {
    const sl = data.storedLines;
    const blank = 0;
    return {
      f1_lw: sl?.forwards[0]?.[0] ?? blank, f1_c: sl?.forwards[0]?.[1] ?? blank, f1_rw: sl?.forwards[0]?.[2] ?? blank,
      f2_lw: sl?.forwards[1]?.[0] ?? blank, f2_c: sl?.forwards[1]?.[1] ?? blank, f2_rw: sl?.forwards[1]?.[2] ?? blank,
      f3_lw: sl?.forwards[2]?.[0] ?? blank, f3_c: sl?.forwards[2]?.[1] ?? blank, f3_rw: sl?.forwards[2]?.[2] ?? blank,
      f4_lw: sl?.forwards[3]?.[0] ?? blank, f4_c: sl?.forwards[3]?.[1] ?? blank, f4_rw: sl?.forwards[3]?.[2] ?? blank,
      d1_ld: sl?.defense[0]?.[0] ?? blank,  d1_rd: sl?.defense[0]?.[1] ?? blank,
      d2_ld: sl?.defense[1]?.[0] ?? blank,  d2_rd: sl?.defense[1]?.[1] ?? blank,
      d3_ld: sl?.defense[2]?.[0] ?? blank,  d3_rd: sl?.defense[2]?.[1] ?? blank,
      starter: sl?.starter_id ?? blank,
      backup:  sl?.backup_id  ?? blank,
    };
  }

  let slots = initSlots();
  let useComputer = data.useComputer;

  // Highlight if a player is used more than once
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

  function playerLabel(p: typeof data.players[0]) {
    const inj = p.injured_games_remaining > 0 ? ' ⚠' : '';
    return `${p.name} (${p.ov})${inj}`;
  }

  function slotClass(id: number) {
    if (id === 0) return 'border-rwha-red/50';
    if (duplicateIds.has(id)) return 'border-rwha-red';
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
    <div class="font-semibold text-sm text-rwha-text">Computer Lines</div>
    <div class="text-xs font-mono text-rwha-muted mt-0.5">
      Let the sim auto-assign lines based on OV rating
    </div>
  </div>

  <form method="POST" action="?/setComputer" use:enhance={({ formData }) => {
    useComputer = formData.get('useComputer') === '1';
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

{#if useComputer}
  <div class="card p-6 text-center text-rwha-muted font-mono text-sm">
    The simulator will automatically set your lines based on player OV ratings.
    <br/><span class="text-xs mt-1 block">Toggle off to set custom lines.</span>
  </div>
{:else}

<!-- ── Manual lines form ─────────────────────────────────────────────────────── -->
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

  <!-- Warnings -->
  {#if duplicateIds.size > 0}
    <div class="mb-3 p-3 rounded border border-rwha-red/40 bg-rwha-red/10 text-rwha-red font-mono text-xs">
      ⚠ Some players are assigned to multiple lines.
    </div>
  {/if}

  <!-- Save button -->
  <div class="flex justify-end">
    <button
      type="submit"
      class="px-6 py-2 rounded font-mono font-bold text-sm uppercase tracking-widest
             bg-rwha-amber text-rwha-bg hover:brightness-110 active:scale-95 transition-all"
    >
      Save Lines
    </button>
  </div>

</form>
{/if}
