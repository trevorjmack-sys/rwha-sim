<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  // ── State ──────────────────────────────────────────────────────────────────
  type GameCard = {
    gameId:     number;
    homeTeam:   string;
    awayTeam:   string;
    status:     'scheduled' | 'complete' | 'revealing' | 'revealed';
    // Only set after sim runs:
    homeGoals?: number;
    awayGoals?: number;
    finalLabel?:string;
    boxScore?:  unknown;
    goals?:     { period: number; time: string; team: string; scorer: string; assists: string[]; strength: string }[];
    goalsRevealed: number;  // how many goal lines have appeared so far
  };

  let cards: GameCard[] = data.weekGames.map(g => ({
    gameId:        g.id,
    homeTeam:      g.home_name,
    awayTeam:      g.away_name,
    status:        g.status as 'scheduled' | 'complete',
    goalsRevealed: 0,
  }));

  let running         = false;
  let batchCount      = 1;
  let message         = '';
  let playedCount     = data.playedGames;   // updated locally after each batch
  let showNextWeek    = false;              // show reload prompt when week is done

  // ── Run games ──────────────────────────────────────────────────────────────
  async function runGames(count: number) {
    running      = true;
    showNextWeek = false;
    message      = '';

    try {
      const res = await fetch('/api/admin/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });

      if (!res.ok) {
        const err = await res.json() as { message?: string };
        message = err.message ?? `Error ${res.status}`;
        return;
      }

      const { games, message: msg } = await res.json() as {
        games: { gameId: number; homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number; finalLabel: string; boxScore: any }[];
        message?: string;
      };

      if (msg) { message = msg; return; }

      playedCount += games.length;

      // Update cards with results — reveal dramatically, one game at a time
      for (const result of games) {
        const card = cards.find(c => c.gameId === result.gameId);
        if (!card) {
          cards = [...cards, {
            gameId: result.gameId, homeTeam: result.homeTeam, awayTeam: result.awayTeam,
            status: 'revealing', homeGoals: result.homeGoals, awayGoals: result.awayGoals,
            finalLabel: result.finalLabel, boxScore: result.boxScore,
            goals: result.boxScore?.goals ?? [],
            goalsRevealed: 0,
          }];
        } else {
          card.status     = 'revealing';
          card.homeGoals  = result.homeGoals;
          card.awayGoals  = result.awayGoals;
          card.finalLabel = result.finalLabel;
          card.boxScore   = result.boxScore;
          card.goals      = result.boxScore?.goals ?? [];
          card.goalsRevealed = 0;
          cards = [...cards];
        }

        // Build anticipation, then flip the score
        await delay(1400);
        const updCard = cards.find(c => c.gameId === result.gameId)!;
        updCard.status = 'revealed';
        cards = [...cards];

        // Reveal goals one by one
        await delay(600);
        const goals = updCard.goals ?? [];
        for (let i = 0; i < goals.length; i++) {
          await delay(380);
          updCard.goalsRevealed = i + 1;
          cards = [...cards];
        }

        // Pause before next game
        await delay(1000);
      }

      // If no scheduled games remain, prompt to load next week
      if (cards.every(c => c.status === 'revealed' || c.status === 'complete')) {
        showNextWeek = true;
      }

    } finally {
      running = false;
    }
  }

  function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ── Display helpers ────────────────────────────────────────────────────────
  function winnerClass(card: GameCard, side: 'home' | 'away') {
    if (card.status !== 'revealed' && card.status !== 'complete') return '';
    const h = card.homeGoals ?? 0, a = card.awayGoals ?? 0;
    if (side === 'home') return h > a ? 'text-rwha-amber' : 'text-rwha-muted';
    return a > h ? 'text-rwha-amber' : 'text-rwha-muted';
  }

  function periodLabel(p: number) {
    return p === 1 ? '1st' : p === 2 ? '2nd' : p === 3 ? '3rd' : 'OT';
  }

  $: remaining      = data.totalGames - playedCount;
  $: scheduledCards = cards.filter(c => c.status === 'scheduled');
</script>

<svelte:head><title>Admin — RWHA Sim</title></svelte:head>

<!-- ── Header bar ─────────────────────────────────────────────────────────── -->
<div class="mb-6 flex items-end justify-between gap-4">
  <div>
    <h1 class="font-mono font-bold text-rwha-amber text-lg tracking-wider uppercase">
      ⚡ Commissioner
    </h1>
    <p class="text-rwha-muted text-sm mt-0.5 font-mono">
      Week {data.currentWeek} · {playedCount}/{data.totalGames} games played · {remaining} remaining
    </p>
  </div>

  <!-- Batch selector + run button -->
  <div class="flex items-center gap-3">
    <div class="flex items-center gap-2 text-sm text-rwha-muted font-mono">
      <span>Run</span>
      {#each [1, 2, 3, 4, 5] as n}
        <button
          class="w-8 h-8 rounded border font-bold transition-colors
                 {batchCount === n
                   ? 'border-rwha-amber bg-rwha-amber/20 text-rwha-amber'
                   : 'border-rwha-border text-rwha-muted hover:border-rwha-amber/50'}"
          on:click={() => batchCount = n}
        >{n}</button>
      {/each}
      <span>game{batchCount > 1 ? 's' : ''}</span>
    </div>

    <button
      class="px-5 py-2 rounded font-mono font-bold text-sm uppercase tracking-widest transition-all
             {running || scheduledCards.length === 0
               ? 'bg-rwha-border text-rwha-muted cursor-not-allowed'
               : 'bg-rwha-amber text-rwha-bg hover:brightness-110 active:scale-95 shadow-lg shadow-rwha-amber/20'}"
      disabled={running || scheduledCards.length === 0}
      on:click={() => runGames(batchCount)}
    >
      {running ? '⏳ Simulating…' : '▶ Run Games'}
    </button>
  </div>
</div>

{#if message}
  <div class="mb-4 p-3 rounded border border-rwha-amber/40 bg-rwha-amber/10 text-rwha-amber font-mono text-sm">
    {message}
  </div>
{/if}

{#if showNextWeek}
  <div class="mb-4 p-3 rounded border border-rwha-green/40 bg-rwha-green/10 flex items-center justify-between">
    <span class="text-rwha-green font-mono text-sm">Week {data.currentWeek} complete.</span>
    <button
      class="px-4 py-1.5 rounded font-mono font-bold text-xs uppercase tracking-widest
             bg-rwha-green/20 text-rwha-green border border-rwha-green/40 hover:bg-rwha-green/30 transition-colors"
      on:click={() => window.location.reload()}
    >Load Week {data.currentWeek + 1} →</button>
  </div>
{/if}

<!-- ── Progress bar ───────────────────────────────────────────────────────── -->
<div class="mb-6">
  <div class="h-1 rounded-full bg-rwha-border overflow-hidden">
    <div
      class="h-full bg-rwha-amber rounded-full transition-all duration-500"
      style="width: {(playedCount / data.totalGames * 100).toFixed(1)}%"
    ></div>
  </div>
  <p class="text-rwha-muted text-xs font-mono mt-1 text-right">
    Season {((playedCount / data.totalGames) * 100).toFixed(0)}% complete
  </p>
</div>

<!-- ── Week game cards ─────────────────────────────────────────────────────── -->
<div class="section-header">Week {data.currentWeek} — {cards.length} games</div>

<div class="space-y-3">
  {#each cards as card (card.gameId)}
    <div class="card overflow-hidden transition-all duration-300
                {card.status === 'revealed' || card.status === 'complete' ? 'border-rwha-border' : 'border-rwha-border/50'}">

      <!-- Score row -->
      <div class="flex items-center px-4 py-3 gap-4">
        <!-- Game number -->
        <span class="text-rwha-muted font-mono text-xs w-12 shrink-0">#{card.gameId}</span>

        <!-- Home team -->
        <div class="flex-1 text-right">
          <span class="font-semibold uppercase tracking-wide {winnerClass(card, 'home')}">
            {card.homeTeam}
          </span>
        </div>

        <!-- Score / vs -->
        <div class="w-28 text-center shrink-0">
          {#if card.status === 'revealed' || card.status === 'complete'}
            <!-- Revealed score -->
            <div class="flex items-center justify-center gap-2">
              <span class="font-mono text-score-md {winnerClass(card, 'home')}">{card.homeGoals}</span>
              <span class="text-rwha-muted font-mono text-xs">–</span>
              <span class="font-mono text-score-md {winnerClass(card, 'away')}">{card.awayGoals}</span>
            </div>
            <div class="text-rwha-muted font-mono text-xs mt-0.5">
              {card.finalLabel?.replace('FINAL', '').trim() || ''}
            </div>
          {:else if card.status === 'revealing'}
            <!-- Flipping animation -->
            <div class="font-mono text-rwha-amber animate-pulse text-sm tracking-widest">
              · · ·
            </div>
          {:else}
            <!-- Not yet played -->
            <span class="text-rwha-muted font-mono text-sm">vs</span>
          {/if}
        </div>

        <!-- Away team -->
        <div class="flex-1">
          <span class="font-semibold uppercase tracking-wide {winnerClass(card, 'away')}">
            {card.awayTeam}
          </span>
        </div>

        <!-- Status badge -->
        <div class="w-16 text-right shrink-0">
          {#if card.status === 'complete' || card.status === 'revealed'}
            <span class="text-xs font-mono text-rwha-muted">FINAL</span>
          {:else if card.status === 'scheduled'}
            <span class="text-xs font-mono text-rwha-muted/50">—</span>
          {/if}
        </div>
      </div>

      <!-- Goal log (appears one by one after score is revealed) -->
      {#if (card.status === 'revealed' || card.status === 'complete') && (card.goals ?? []).length > 0}
        <div class="border-t border-rwha-border/50 px-4 pb-2 pt-2 space-y-0.5">
          {#each (card.goals ?? []).slice(0, card.status === 'complete' ? undefined : card.goalsRevealed) as goal, i}
            <div class="flex items-baseline gap-2 text-xs font-mono
                        {i < card.goalsRevealed || card.status === 'complete' ? 'opacity-100' : 'opacity-0'}
                        transition-opacity duration-200">
              <span class="text-rwha-muted w-6 text-right shrink-0">{periodLabel(goal.period)}</span>
              <span class="text-rwha-muted">{goal.time}</span>
              <span class="text-rwha-amber/80 w-12 shrink-0">{goal.team.slice(0, 3).toUpperCase()}</span>
              <span class="text-rwha-amber font-semibold">{goal.strength !== 'EV' ? `[${goal.strength}] ` : ''}{goal.scorer}</span>
              {#if goal.assists.length > 0}
                <span class="text-rwha-muted">from {goal.assists.join(', ')}</span>
              {:else}
                <span class="text-rwha-muted">unassisted</span>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Box score link (once fully revealed) -->
        {#if card.status === 'complete' || (card.status === 'revealed' && card.goalsRevealed >= (card.goals ?? []).length)}
          <div class="px-4 pb-3">
            <a href="/games/{card.gameId}"
               class="text-xs font-mono text-rwha-blue hover:text-rwha-amber transition-colors">
              Full box score →
            </a>
          </div>
        {/if}
      {/if}
    </div>
  {/each}
</div>

{#if cards.length === 0}
  <div class="card p-8 text-center text-rwha-muted font-mono text-sm">
    All games in this week are complete.
  </div>
{/if}
