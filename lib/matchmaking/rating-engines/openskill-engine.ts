import { rating as makeRating, rate } from "openskill";
import type { RatingEngine } from "./types";

// How much a score margin scales the rating swing, via openskill's own
// marginFactor -- retune here if blowouts should move rating more/less.
const DEFAULT_MARGIN = 1;

// Handles Bayesian team-vs-team ranking (Weng-Lin/Plackett-Luce, the model
// behind both TrueSkill and OpenSkill). Used for any sport whose
// ratingAlgorithm isn't explicitly Glicko-2.
export const openskillEngine: RatingEngine = {
  id: "openskill",
  defaultRating: { mu: 25.0, sigma: 8.333 },

  rate(teams, ranks, meta) {
    const openskillTeams = teams.map((team) =>
      team.map((p) => makeRating({ mu: p.mu, sigma: p.sigma }))
    );

    // When per-team scores are available, pass them as `score` instead of
    // `rank` -- openskill derives the finishing order from score itself,
    // and (combined with `margin`) scales the mu delta by how lopsided the
    // result was, via its own marginFactor. Falls back to plain rank-only
    // updates (no margin sensitivity) when scores aren't supplied.
    const updated = meta?.scores
      ? rate(openskillTeams, { score: meta.scores, margin: meta.margin ?? DEFAULT_MARGIN })
      : rate(openskillTeams, { rank: ranks });

    return updated.map((team) => team.map((p) => ({ mu: p.mu, sigma: p.sigma })));
  },
};
