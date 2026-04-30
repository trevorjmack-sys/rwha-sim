<script lang="ts">
  import '../lib/app.css';
  import { page } from '$app/stores';

  const nav = [
    { href: '/',         label: 'Standings' },
    { href: '/scores',   label: 'Scores'    },
    { href: '/schedule', label: 'Schedule'  },
    { href: '/teams',    label: 'Teams'     },
    { href: '/leaders',  label: 'Leaders'   },
    { href: '/power',    label: 'Power'     },
    { href: '/finance',  label: 'Finance'   },
    { href: '/rosters',  label: 'Rosters'   },
  ];

  let menuOpen = false;

  // Auto-close menu on navigation
  $: $page.url.pathname, menuOpen = false;

  function isActive(href: string) {
    if (href === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(href);
  }
</script>

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

      <!-- Desktop right side — hidden on mobile -->
      <div class="hidden md:flex ml-auto items-center gap-4 shrink-0">
        <a href="/gm"    class="nav-link" class:active={$page.url.pathname.startsWith('/gm')}>My Team</a>
        <a href="/admin" class="nav-link text-rwha-red">⚡ Admin</a>
      </div>

      <!-- Mobile right side: My Team + hamburger -->
      <div class="flex md:hidden ml-auto items-center gap-4">
        <a href="/gm" class="nav-link text-xs" class:active={$page.url.pathname.startsWith('/gm')}>My Team</a>

        <button
          on:click={() => menuOpen = !menuOpen}
          aria-label="{menuOpen ? 'Close menu' : 'Open menu'}"
          aria-expanded={menuOpen}
          class="flex flex-col justify-center items-center w-7 h-7 gap-[5px] text-rwha-muted
                 hover:text-rwha-amber transition-colors"
        >
          {#if menuOpen}
            <!-- X icon -->
            <span class="block w-5 h-0.5 bg-current rounded-full rotate-45 translate-y-[7px] transition-all"></span>
            <span class="block w-5 h-0.5 bg-current rounded-full opacity-0 transition-all"></span>
            <span class="block w-5 h-0.5 bg-current rounded-full -rotate-45 -translate-y-[7px] transition-all"></span>
          {:else}
            <!-- Hamburger icon -->
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
