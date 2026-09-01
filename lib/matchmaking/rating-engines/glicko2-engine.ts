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
// Floor for a doubles teammate's post-match sigma, matching the rough order
// of magnitude of Glicko-2's own internal RD floor -- guards against a
// runaway-low sigma if a teammate started unusually confident.
const MIN_SIGMA = 30;

function runPairwise(
  ranking: Glicko2,
  playerGrid: ReturnType<Glicko2["makePlayer"]>[][],
  ranks: number[]
) {
  const matches: [ReturnType<Glicko2["makePlayer"]>, ReturnType<Glicko2["makePlayer"]>, number][] = [];
  for (let i = 0; i < playerGrid.length; i++) {
    for (let j = i + 1; j < playerGrid.length; j++) {
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
}

// Doubles (every team has exactly 2 players): each team's two ratings are
// averaged into one virtual opponent for the match calculation -- mu is a
// straight average, sigma the quadratic mean of the two (so either
// teammate's uncertainty pulls the pair's combined uncertainty up). The
// resulting single delta is then applied identically to both teammates,
// preserving each player's own pre-match baseline rather than overwriting
// both to the virtual's absolute rating.
function rateDoublesByAveraging(
  teams: RatingPoint[][],
  ranks: number[]
): RatingPoint[][] {
  const ranking = new Glicko2({ tau: TAU });

  const virtualMu = teams.map(([p1, p2]) => (p1.mu + p2.mu) / 2);
  const virtualSigma = teams.map(([p1, p2]) => Math.sqrt((p1.sigma ** 2 + p2.sigma ** 2) / 2));
  const virtualPlayers = teams.map((_, i) =>
    ranking.makePlayer(virtualMu[i], virtualSigma[i], DEFAULT_VOLATILITY)
  );

  runPairwise(
    ranking,
    virtualPlayers.map((p) => [p]),
    ranks
  );

  return teams.map((team, i) => {
    const muDelta = virtualPlayers[i].getRating() - virtualMu[i];
    const sigmaDelta = virtualPlayers[i].getRd() - virtualSigma[i];
    return team.map((p) => ({
      mu: p.mu + muDelta,
      sigma: Math.max(p.sigma + sigmaDelta, MIN_SIGMA),
    }));
  });
}

export const glicko2Engine: RatingEngine = {
  id: "glicko2",
  // Standard Glicko-2 starting point: rating 1500, RD 350 (maximum
  // uncertainty for a brand-new player).
  defaultRating: { mu: 1500, sigma: 350 },

  rate(teams, ranks) {
    if (teams.length > 0 && teams.every((t) => t.length === 2)) {
      return rateDoublesByAveraging(teams, ranks);
    }

    const ranking = new Glicko2({ tau: TAU });
    const playerGrid = teams.map((team) =>
      team.map((p: RatingPoint) => ranking.makePlayer(p.mu, p.sigma, DEFAULT_VOLATILITY))
    );

    runPairwise(ranking, playerGrid, ranks);

    return playerGrid.map((team) => team.map((p) => ({ mu: p.getRating(), sigma: p.getRd() })));
  },
};
