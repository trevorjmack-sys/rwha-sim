<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';
  export let data: PageData;

  $: teams = data.teams;
  $: gmSet = teams.filter(t => !t.use_computer || t.scratches > 0).length;

  let msg = '';

  function savedAgo(ts: string | null): string {
    if (!ts) return '—';
    const d = new Date(ts.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return ts;
    const hrs = Math.round((Date.now() - d.getTime()) / 3_600_000);
    if (hrs < 1)  return 'just now';
    if (hrs < 48) return `${hrs} hr ago`;
    return `${Math.round(hrs / 24)} days ago`;
  }

  const done = (label: string) => () => async ({ result, update }: any) => {
    msg = result.type === 'success' ? label : 'Something went wrong';
    await update();
  };
</script>

<svelte:head><title>Admin — Lineups</title></svelte:head>

<div class="mb-6 flex items-center gap-4">
  <a href="/admin" class="text-rwha-muted hover:text-rwha-amber font-mono text-sm">← Admin</a>
  <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">Lineups</h1>
</div>

<section class="card mb-6 p-4">
  <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
    <div class="max-w-2xl">
      <p class="text-rwha-muted text-xs font-mono leading-relaxed">
        Teams on <span class="text-rwha-text">Computer</span> dress their best available players by OV,
        skipping injured players. If a GM hasn't kept his lineup current before you run games,
        hand it to the computer: this switches the team to computer lines and clears its scratches.
        The GM's saved lines are kept, so he can switch back from his Lines page.
      </p>
      <p class="text-rwha-muted text-xs font-mono mt-2">
        {gmSet === 0 ? 'Every team is on computer lineups.' : `${gmSet} of ${teams.length} teams have GM-set lines or scratches.`}
        {#if msg}<span class="text-rwha-amber ml-2">{msg}</span>{/if}
      </p>
    </div>
    <form method="POST" action="?/computerAll" use:enhance={done('All teams set to computer')}>
      <button class="px-4 py-1.5 text-sm font-mono font-bold rounded border-2 border-rwha-text text-rwha-text
                     hover:border-rwha-amber hover:text-rwha-amber transition-colors">
        🤖 All teams → Computer
      </button>
    </form>
  </div>

  <div class="overflow-x-auto">
    <table class="w-full font-mono text-sm">
      <thead>
        <tr class="text-rwha-muted text-xs uppercase tracking-wider text-left border-b border-rwha-border">
          <th class="py-2 pr-3">Team</th>
          <th class="py-2 pr-3">GM</th>
          <th class="py-2 pr-3">Lines</th>
          <th class="py-2 pr-3">GM last saved</th>
          <th class="py-2 pr-3 text-center">Scratched</th>
          <th class="py-2 pr-3 text-center">Injured</th>
          <th class="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each teams as t}
          <tr class="border-b border-rwha-border/30">
            <td class="py-1.5 pr-3 text-rwha-text">{t.name}</td>
            <td class="py-1.5 pr-3 text-rwha-muted">{t.gm_name}</td>
            <td class="py-1.5 pr-3">
              {#if t.use_computer}
                <span class="text-rwha-muted">Computer</span>
              {:else}
                <span class="text-rwha-amber">GM-set</span>
              {/if}
            </td>
            <td class="py-1.5 pr-3 text-rwha-muted text-xs">{savedAgo(t.gm_saved_at)}</td>
            <td class="py-1.5 pr-3 text-center {t.scratches ? 'text-rwha-amber' : 'text-rwha-muted'}">{t.scratches}</td>
            <td class="py-1.5 pr-3 text-center {t.injured ? 'text-rwha-red' : 'text-rwha-muted'}">{t.injured}</td>
            <td class="py-1.5 text-right">
              {#if !t.use_computer || t.scratches > 0}
                <form method="POST" action="?/computerOne" use:enhance={done(`${t.name} set to computer`)}>
                  <input type="hidden" name="team_id" value={t.id} />
                  <button class="px-2 py-0.5 text-xs rounded border border-rwha-border text-rwha-muted
                                 hover:border-rwha-amber hover:text-rwha-amber transition-colors">
                    → Computer
                  </button>
                </form>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
