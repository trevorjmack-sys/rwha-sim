<script lang="ts">
  import '../lib/app.css';
  import { page } from '$app/stores';
  import type { LayoutData } from './$types';
  export let data: LayoutData;

  const nav = [
    { href: '/',         label: 'Standings' },
    { href: '/scores',   label: 'Scores'    },
    { href: '/schedule', label: 'Schedule'  },
    { href: '/leaders',  label: 'Leaders'   },
    { href: '/power',    label: 'Power'     },
    { href: '/finance',  label: 'Finance'   },
    { href: '/rosters',   label: 'Rosters'    },
    { href: '/prospects', label: 'Prospects'  },
    { href: '/trades',    label: 'Trades'     },
    { href: '/playoffs', label: 'Playoffs'   },
  ];

  let menuOpen    = false;
  let teamsOpen   = false;
  let mTeamsOpen  = false;  // mobile teams sub-list

  // Auto-close everything on navigation
  $: $page.url.pathname, menuOpen = false, teamsOpen = false, mTeamsOpen = false;

  function isActive(href: string) {
    if (href === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(href);
  }

  $: teamsActive = $page.url.pathname.startsWith('/teams');

  $: teamNames = data.teamNames ?? [];
  $: myTeamLabel = data.user?.teamName ?? 'My Team';
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <script async src="https://analytics.umami.is/script.js" data-website-id="a606c91c-965a-49fb-aad4-9d4a6a47c480"></script>
</svelte:head>

<div class="min-h-screen flex flex-col">
  <!-- ── Header ──────────────────────────────────────────────────────────────── -->
  <header class="border-b border-rwha-border bg-rwha-surface/95 backdrop-blur sticky top-0 z-50">

    <!-- Main bar -->
    <div class="max-w-6xl mx-auto px-4 flex items-center gap-6 h-12">

      <!-- Wordmark -->
      <a href="/" class="font-mono font-bold text-rwha-amber tracking-wider text-sm shrink-0">
        RWHA SIM
      </a>

      <!-- Desktop nav — hidden on mobile -->
      <nav class="hidden md:flex items-center gap-5 overflow-x-auto">
        {#each nav as link}
          <a
            href={link.href}
            class="nav-link shrink-0"
            class:active={isActive(link.href)}
          >{link.label}</a>
        {/each}
      </nav>

      <!-- Teams dropdown — sibling of nav so overflow-x-auto doesn't clip it -->
      <div class="hidden md:block relative shrink-0">
        <button
          class="nav-link flex items-center gap-1"
          class:active={teamsActive}
          on:click={() => teamsOpen = !teamsOpen}
        >
          Teams
          <span class="text-[10px] opacity-60 ml-0.5">{teamsOpen ? '▴' : '▾'}</span>
        </button>

        {#if teamsOpen}
          <!-- Backdrop -->
          <button
            class="fixed inset-0 cursor-default"
            style="z-index: 49;"
            tabindex="-1"
            aria-hidden="true"
            on:click={() => teamsOpen = false}
          />
          <!-- Dropdown panel -->
          <div class="absolute top-full left-0 mt-1 bg-rwha-surface border border-rwha-border
                      rounded shadow-xl py-1 min-w-[200px]"
               style="z-index: 50;">
            <div class="grid grid-cols-2">
              {#each teamNames as name}
                <a href="/teams/{name.toLowerCase()}"
                   class="px-3 py-1 font-mono text-xs transition-colors
                          {$page.url.pathname === `/teams/${name.toLowerCase()}`
                            ? 'text-rwha-amber bg-rwha-amber/5'
                            : 'text-rwha-muted hover:text-rwha-amber hover:bg-rwha-amber/5'}">
                  {name}
                </a>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Desktop right side — hidden on mobile -->
      <div class="hidden md:flex ml-auto items-center gap-4 shrink-0">
        <a href="/gm"    class="nav-link" class:active={$page.url.pathname.startsWith('/gm')}>{myTeamLabel}</a>
        <a href="/admin" class="nav-link text-rwha-red">⚡ Admin</a>
      </div>

      <!-- Mobile right side: My Team + hamburger -->
      <div class="flex md:hidden ml-auto items-center gap-4">
        <a href="/gm" class="nav-link text-xs" class:active={$page.url.pathname.startsWith('/gm')}>{myTeamLabel}</a>

        <button
          on:click={() => menuOpen = !menuOpen}
          aria-label="{menuOpen ? 'Close menu' : 'Open menu'}"
          aria-expanded={menuOpen}
          class="flex flex-col justify-center items-center w-7 h-7 gap-[5px] text-rwha-muted
                 hover:text-rwha-amber transition-colors"
        >
          {#if menuOpen}
            <span class="block w-5 h-0.5 bg-current rounded-full rotate-45 translate-y-[7px] transition-all"></span>
            <span class="block w-5 h-0.5 bg-current rounded-full opacity-0 transition-all"></span>
            <span class="block w-5 h-0.5 bg-current rounded-full -rotate-45 -translate-y-[7px] transition-all"></span>
          {:else}
            <span class="block w-5 h-0.5 bg-current rounded-full transition-all"></span>
            <span class="block w-5 h-0.5 bg-current rounded-full transition-all"></span>
            <span class="block w-5 h-0.5 bg-current rounded-full transition-all"></span>
          {/if}
        </button>
      </div>
    </div>

    <!-- Mobile dropdown menu -->
    {#if menuOpen}
      <div class="md:hidden border-t border-rwha-border bg-rwha-surface">
        <nav class="max-w-6xl mx-auto px-4 py-1 flex flex-col">
          {#each nav as link}
            <a
              href={link.href}
              class="py-3 border-b border-rwha-border/30 font-mono text-sm transition-colors
                     {isActive(link.href) ? 'text-rwha-amber' : 'text-rwha-muted hover:text-rwha-text'}"
            >{link.label}</a>
          {/each}

          <!-- Mobile Teams section -->
          <button
            on:click={() => mTeamsOpen = !mTeamsOpen}
            class="py-3 border-b border-rwha-border/30 font-mono text-sm text-left flex items-center justify-between
                   {teamsActive ? 'text-rwha-amber' : 'text-rwha-muted hover:text-rwha-text'} transition-colors"
          >
            <span>Teams</span>
            <span class="text-xs opacity-60 transition-transform duration-150 {mTeamsOpen ? 'rotate-180' : ''}">▾</span>
          </button>

          {#if mTeamsOpen}
            <div class="grid grid-cols-3 gap-x-2 py-2 border-b border-rwha-border/30">
              {#each teamNames as name}
                <a href="/teams/{name.toLowerCase()}"
                   class="py-1.5 font-mono text-xs transition-colors truncate
                          {$page.url.pathname === `/teams/${name.toLowerCase()}`
                            ? 'text-rwha-amber'
                            : 'text-rwha-muted hover:text-rwha-text'}">
                  {name}
                </a>
              {/each}
            </div>
          {/if}

          <a href="/gm" class="py-3 border-b border-rwha-border/30 font-mono text-sm transition-colors
                     {$page.url.pathname.startsWith('/gm') ? 'text-rwha-amber' : 'text-rwha-muted hover:text-rwha-text'}"
          >{myTeamLabel}</a>
          <a href="/admin" class="py-3 font-mono text-sm text-rwha-red">⚡ Admin</a>
        </nav>
      </div>
    {/if}
  </header>

  <!-- Page content -->
  <main class="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
    <slot />
  </main>

  <!-- Footer -->
  <footer class="border-t border-rwha-border py-4 text-center text-rwha-muted text-xs font-mono">
    RWHA SIM · Private league · Season 2025-26
  </footer>
</div>
