// ── Season CLI entry point ────────────────────────────────────────────────────
//
// Simulates a full RWHA regular season and prints standings + leaders.
//
// Usage:
//   npm run season                     # random seed
//   npm run season -- --seed 42        # reproducible
//   npm run season -- --seed 42 --quiet  # suppress progress dots

import { loadLeague } from './data.ts';
import { simulateSeason } from './season.ts';
import { formatSeason } from './season-format.ts';

function parseArgs(argv: string[]): { seed?: number; quiet: boolean } {
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key  = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        opts[key] = next; i++;
      } else {
        opts[key] = 'true';
      }
    }
  }
  return {
    seed:  opts.seed !== undefined ? Number(opts.seed) : undefined,
    quiet: opts.quiet === 'true',
  };
}

function main() {
  const { seed, quiet } = parseArgs(process.argv.slice(2));

  const league = loadLeague();

  if (!quiet) {
    const totalTeams = league.teams.size;
    process.stderr.write(
      `Simulating RWHA season — ${totalTeams} teams, seed ${seed ?? 'random'}…\n`,
    );
  }

  const results = simulateSeason(league, {
    seed,
    verbose: !quiet,
  });

  const report = formatSeason(results);
  console.log(report);

  // Quick summary to stderr
  if (!quiet) {
    const gp = results.standings[0]?.gp ?? 0;
    process.stderr.write(
      `Done — ${results.schedule.length} games simulated (${gp} GP per team)\n`,
    );
  }
}

main();
