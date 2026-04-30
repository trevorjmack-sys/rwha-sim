<script lang="ts">
  import '../lib/app.css';
  import { page } from '$app/stores';

  const nav = [
    { href: '/',          label: 'Standings' },
    { href: '/scores',    label: 'Scores'    },
    { href: '/schedule',  label: 'Schedule'  },
    { href: '/teams',     label: 'Teams'     },
    { href: '/leaders',   label: 'Leaders'   },
    { href: '/power',     label: 'Power'     },
    { href: '/rosters',   label: 'Rosters'   },
  ];
</script>

<div class="min-h-screen flex flex-col">
  <!-- Top nav -->
  <header class="border-b border-rwha-border bg-rwha-surface/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 flex items-center gap-6 h-12">
      <!-- Wordmark -->
      <a href="/" class="font-mono font-bold text-rwha-amber tracking-wider text-sm shrink-0">
        RWHA SIM
      </a>

      <!-- Nav links -->
      <nav class="flex items-center gap-5">
        {#each nav as link}
          <a
            href={link.href}
            class="nav-link"
            class:active={$page.url.pathname === link.href}
          >{link.label}</a>
        {/each}
      </nav>

      <!-- Right side: GM / admin links -->
      <div class="ml-auto flex items-center gap-4">
        <a href="/gm"    class="nav-link">My Team</a>
        <a href="/admin" class="nav-link text-rwha-red">⚡ Admin</a>
      </div>
    </div>
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
