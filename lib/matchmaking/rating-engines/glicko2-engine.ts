import { Glicko2 } from "glicko2";
import type { RatingEngine, RatingPoint } from "./types";

// Glicko-2 has no native notion of a "team" — it rates one player against
// one opponent. To support the same team-vs-team match shape as the
// OpenSkill engine, every player on team A is scored against every player
// on team B as an individual pairwise game with the match's outcome, then
// Glicko-2's batch update is run once over all of those games together
// (this is the standard "everyone played everyone" workaround for
// extending Glicko-2 to group matches). Volatility isn't persisted in the
// ledger (mu/sigma only, matching PlayerRating), so every call starts each
// player from the same default volatility rather than carrying it forward.
const DEFAULT_VOLATILITY = 0.06;
const TAU = 0.5;

export const glicko2Engine: RatingEngine = {
  id: "glicko2",
  // Standard Glicko-2 starting point: rating 1500, RD 350 (maximum
  // uncertainty for a brand-new player).
  defaultRating: { mu: 1500, sigma: 350 },

  rate(teams, ranks) {
    const ranking = new Glicko2({ tau: TAU });

    const playerGrid = teams.map((team) =>
      team.map((p: RatingPoint) => ranking.makePlayer(p.mu, p.sigma, DEFAULT_VOLATILITY))
    );

    const matches: [ReturnType<Glicko2["makePlayer"]>, ReturnType<Glicko2["makePlayer"]>, number][] = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const result = ranks[i] === ranks[j] ? 0.5 : ranks[i] < ranks[j] ? 1 : 0;
        for (const p1 of playerGrid[i]) {
          for (const p2 of playerGrid[j]) {
            matches.push([p1, p2, result]);
          }
        }
      }
    }

    if (matches.length > 0) {
      ranking.updateRatings(matches);
    }

    return playerGrid.map((team) => team.map((p) => ({ mu: p.getRating(), sigma: p.getRd() })));
  },
};
