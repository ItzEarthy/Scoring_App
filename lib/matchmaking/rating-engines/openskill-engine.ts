import { rating as makeRating, rate } from "openskill";
import type { RatingEngine } from "./types";

// Handles Bayesian team-vs-team ranking (Weng-Lin/Plackett-Luce, the model
// behind both TrueSkill and OpenSkill). Used for any sport whose
// ratingAlgorithm isn't explicitly Glicko-2.
export const openskillEngine: RatingEngine = {
  id: "openskill",
  defaultRating: { mu: 25.0, sigma: 8.333 },

  rate(teams, ranks) {
    const openskillTeams = teams.map((team) =>
      team.map((p) => makeRating({ mu: p.mu, sigma: p.sigma }))
    );

    const updated = rate(openskillTeams, { rank: ranks });

    return updated.map((team) => team.map((p) => ({ mu: p.mu, sigma: p.sigma })));
  },
};
