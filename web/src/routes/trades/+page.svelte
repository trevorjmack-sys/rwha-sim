<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  function fmtDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
</script>

<svelte:head><title>Trade History — RWHA Sim</title></svelte:head>

<h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase mb-5">
  ⇄ Trade History
</h1>

{#if data.trades.length === 0}
  <div class="card p-10 text-center text-rwha-muted font-mono text-sm">
    No trades have been executed yet.
  </div>
{:else}
  <div class="space-y-3">
    {#each data.trades as trade}
      <div class="card overflow-hidden">

        <!-- Header bar -->
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-rwha-border/50">
          <div class="flex items-center gap-3">
            <span class="font-mono font-bold text-rwha-amber uppercase tracking-wider text-sm">
              {trade.team_a_name}
            </span>
            <span class="text-rwha-muted font-mono text-xs">⇄</span>
            <span class="font-mono font-bold text-rwha-amber uppercase tracking-wider text-sm">
              {trade.team_b_name}
            </span>
          </div>
          <span class="text-rwha-muted font-mono text-xs">
            {fmtDate(trade.traded_at)} · {fmtTime(trade.traded_at)}
          </span>
        </div>

        <!-- Trade details: two columns -->
        <div class="grid grid-cols-2 divide-x divide-rwha-border/50 text-xs font-mono">

          <!-- Team A sends → Team B -->
          <div class="px-4 py-3">
            <div class="text-rwha-muted mb-1">
              <span class="text-rwha-text font-semibold">{trade.team_a_name}</span> sends:
            </div>
            {#if trade.a_to_b && trade.a_to_b !== '—'}
              <ul class="space-y-0.5">
                {#each trade.a_to_b.split(', ') as item}
                  <li class="text-rwha-text">{item}</li>
                {/each}
              </ul>
            {:else}
              <span class="text-rwha-muted/50 italic">nothing</span>
            {/if}
          </div>

          <!-- Team B sends → Team A -->
          <div class="px-4 py-3">
            <div class="text-rwha-muted mb-1">
              <span class="text-rwha-text font-semibold">{trade.team_b_name}</span> sends:
            </div>
            {#if trade.b_to_a && trade.b_to_a !== '—'}
              <ul class="space-y-0.5">
                {#each trade.b_to_a.split(', ') as item}
                  <li class="text-rwha-text">{item}</li>
                {/each}
              </ul>
            {:else}
              <span class="text-rwha-muted/50 italic">nothing</span>
            {/if}
          </div>

        </div>
      </div>
    {/each}
  </div>
{/if}
