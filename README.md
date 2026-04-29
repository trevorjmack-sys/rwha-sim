# RWHA Sim

Hockey simulator for the Republik World Hockey Association — a private 22-team fantasy league.

Spiritual successor to STHS (Simon Tremblay Hockey Simulator), built as a TypeScript webapp specifically for the RWHA. Uses the existing STHS-derived player ratings (`CK`, `FG`, `DI`, `SK`, `ST`, `EN`, `DU`, `PH`, `FO`, `PA`, `SC`, `DF`, `PS`, `EX`, `LD`, `PO`, `MO`) as inputs.

## Roadmap

| Phase | Scope | Target |
|-------|-------|--------|
| **1. Sim engine MVP** | CLI tool: simulate a single game between two RWHA teams, output STHS-style box score | May 2026 |
| **2. Season sim** | 82-game schedule generator, full-season batch runs, NHL-realism validation | June 2026 |
| **3. Webapp** | Cloudflare Workers + D1, SvelteKit frontend, GM auth (Cloudflare Access), weekly batch sims, line management | August 2026 |
| **4. Off-season tooling** | Free agency, draft, roster validation | September 2026 |

## Stack

- **TypeScript** + **Vitest** (pure-Node engine, runs anywhere)
- **Cloudflare Workers + D1** (Phase 3 — hosted sim runner & SQLite)
- **SvelteKit** on Cloudflare Pages (Phase 3 — public stats site + GM app)
- **Cloudflare Access** (Phase 3 — magic-link auth, free up to 50 users)

## Sim model (Phase 1)

Event-coarse: per-game faceoff aggregate → SOG → goals/saves → assists → hits/blocks/PIM. Driven entirely by STHS attribute weights. Calibration target: NHL-realistic distributions (avg ~6 goals/game, league-wide SV% ~.905, top scorer ~120 pts).

| Attribute | Drives |
|-----------|--------|
| `CK` | Hits per game |
| `FG` | Fight engagement & outcome |
| `DI` | PIM rate |
| `SK` | Skating modifier (everywhere) |
| `ST` | Strength tiebreaker |
| `EN` | TOI realization |
| `DU` | Injury risk (stubbed) |
| `PH` | SOG generation, PP weighting |
| `FO` | Faceoff results |
| `PA` | Assist attribution |
| `SC` | Goal scorer attribution |
| `DF` | SOG suppression, shot blocks, PK weighting |
| `PS` | Penalty shot results |
| `EX` | Veteran late-game bonus |
| `LD` | Captain / OT / playoff bonus |
| `MO` | In-game performance multiplier |

Goalie attributes (`SK, AG, EN, DU, SZ, RB, RT, SC, HS, PH, PS, EX, LD, PO, MO`) collapse into a composite save rating in Phase 1; we'll decompose later.

## Tuning defaults

- OT format: 5-min 3v3 → 3-shooter SO → sudden death (NHL standard)
- Fight rate: ~0.5/game league-wide
- Penalty rate: ~3.0 PP opportunities per team per game
- Plus/minus: tracked properly (on-ice when goals scored)
- TOI by line slot: L1=20, L2=17, L3=14, L4=10, D1=24, D2=21, D3=16 (scaled by `EN`)

## Usage

```bash
npm install

# Random seed each run
npm run sim Bunnies vs Gladiators

# Reproducible — note the `--` so npm doesn't eat the flag
npm run sim -- Bunnies vs Gladiators --seed 42

# Or use the @ separator if you prefer
npm run sim Bunnies @ Gladiators

npm test                              # run the test suite
```

## License

Private — RWHA league internal use only.
