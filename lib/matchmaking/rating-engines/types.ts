export type RatingPoint = { mu: number; sigma: number };

export interface RatingEngine {
  readonly id: string;
  readonly defaultRating: RatingPoint;
  /**
   * teams[i] is the roster for the i-th team, ranks[i] its finishing
   * position (1 = winner). Returns updated {mu, sigma} in the same
   * team/player order as the input.
   */
  rate(teams: RatingPoint[][], ranks: number[]): RatingPoint[][];
}
