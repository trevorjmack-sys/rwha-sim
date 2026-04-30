<script lang="ts">
  import type { LayoutData } from './$types';
  import { page } from '$app/stores';
  export let data: LayoutData;

  const tabs = [
    { href: '/gm',        label: 'Overview', exact: true  },
    { href: '/gm/roster', label: 'Roster',   exact: false },
    { href: '/gm/lines',  label: 'Lines',    exact: false },
  ];
</script>

<!-- GM sub-header -->
<div class="mb-5">
  <div class="flex items-end justify-between gap-3">
    <div>
      <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">
        {data.user.teamName}
      </h1>
      <p class="text-rwha-muted text-xs font-mono mt-0.5">{data.user.email}</p>
    </div>

    <!-- Tab bar -->
    <div class="flex gap-1 font-mono text-sm">
      {#each tabs as t}
        <a
          href={t.href}
          class="px-4 py-1.5 rounded border transition-colors
                 {(t.exact ? $page.url.pathname === t.href : $page.url.pathname.startsWith(t.href))
                   ? 'border-rwha-amber bg-rwha-amber/10 text-rwha-amber'
                   : 'border-rwha-border text-rwha-muted hover:border-rwha-amber/40'}"
        >{t.label}</a>
      {/each}
    </div>
  </div>
</div>

<slot />
