export type RatingPoint = { mu: number; sigma: number };

/**
 * Optional per-team score data, winner-first-ordered to match `teams`/`ranks`.
 * Engines that support margin-of-victory weighting (OpenSkill) use `scores`
 * to move rating more for a blowout than a narrow win; engines that don't
 * (Glicko-2) ignore it.
 */
export type RatingMeta = { scores?: number[]; margin?: number };

export interface RatingEngine {
  readonly id: string;
  readonly defaultRating: RatingPoint;
  /**
   * teams[i] is the roster for the i-th team, ranks[i] its finishing
   * position (1 = winner, ties allowed for draws). Returns updated
   * {mu, sigma} in the same team/player order as the input.
   */
  rate(teams: RatingPoint[][], ranks: number[], meta?: RatingMeta): RatingPoint[][];
}
