// ── CLI entry point ──────────────────────────────────────────────────────────
//
// Usage:
//   npm run sim Bunnies vs Gladiators           (Bunnies = away, Gladiators = home)
//   npm run sim Bunnies @ Gladiators            (same — "@" reads more naturally)
//   npm run sim Bunnies @ Gladiators --seed 42
//
// Convention: `A vs B` and `A @ B` both treat the SECOND team as home.

import { loadLeague, getTeam } from './data.ts';
import { simulateGame } from './sim.ts';
import { formatBoxScore } from './format.ts';

function usage(): never {
  console.error([
    'Usage:',
    '  npm run sim <Team A> vs <Team B>',
    '  npm run sim <Team A> @ <Team B>',
    '',
    'Options:',
    '  --seed <n>   Reproducible RNG seed',
    '',
    'Examples:',
    '  npm run sim Bunnies vs Gladiators',
    '  npm run sim Bunnies @ Gladiators --seed 42',
  ].join('\n'));
  process.exit(1);
}

function parseArgs(argv: string[]): { teamA: string; teamB: string; seed?: number } {
  // Strip option flags first
  const opts: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        opts[key] = next; i++;
      } else {
        opts[key] = 'true';
      }
    } else {
      positional.push(a);
    }
  }

  // Find separator (vs / @ / "vs.")
  const sepIdx = positional.findIndex(p =>
    p.toLowerCase() === 'vs' || p === '@' || p.toLowerCase() === 'vs.');
  if (sepIdx === -1 || sepIdx === 0 || sepIdx === positional.length - 1) usage();

  const teamA = positional.slice(0, sepIdx).join(' ');
  const teamB = positional.slice(sepIdx + 1).join(' ');

  return {
    teamA, teamB,
    seed: opts.seed !== undefined ? Number(opts.seed) : undefined,
  };
}

function main() {
  const { teamA, teamB, seed } = parseArgs(process.argv.slice(2));

  const league = loadLeague();
  const away   = getTeam(league, teamA);
  const home   = getTeam(league, teamB);

  const box = simulateGame(home, away, { seed });
  console.log(formatBoxScore(box));
}

main();
