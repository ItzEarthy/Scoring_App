import { openskillEngine } from "./openskill-engine";
import { glicko2Engine } from "./glicko2-engine";
import type { RatingEngine, RatingPoint } from "./types";

export type { RatingEngine, RatingPoint };

/**
 * Resolves a Sport.ratingAlgorithm string to its rating engine.
 * "glicko2" (any case) routes to Glicko-2; everything else -- "trueskill",
 * "openskill", or an unrecognized value -- falls back to the OpenSkill
 * engine, which is the app's general-purpose default.
 */
export function getRatingEngine(ratingAlgorithm: string): RatingEngine {
  return ratingAlgorithm.trim().toLowerCase() === "glicko2" ? glicko2Engine : openskillEngine;
}

export { openskillEngine, glicko2Engine };
