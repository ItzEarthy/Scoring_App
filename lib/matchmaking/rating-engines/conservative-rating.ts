// Display-only. Never feed this back into a rating engine or persist it --
// PlayerRating.mu/.sigma must always stay each engine's native raw scale
// (Glicko-2 ~1500/350, OpenSkill ~25/8.333). This is purely a UI transform
// that shows a conservative (lower-confidence-bound) estimate instead of
// the raw mean, so a lucky early win doesn't inflate a brand-new player's
// displayed rating -- and rescales both engines onto a shared, familiar
// 4-digit range.
const GLICKO_DISPLAY_OFFSET = 200; // (mu - 2*sigma) + 200
const OPENSKILL_DISPLAY_SCALE = 40; // (mu - 3*sigma) * 40 + 1000
const OPENSKILL_DISPLAY_OFFSET = 1000;

export function conservativeRating(
  engineId: "glicko2" | "openskill",
  mu: number,
  sigma: number
): number {
  if (engineId === "glicko2") {
    return Math.round(mu - 2 * sigma + GLICKO_DISPLAY_OFFSET);
  }
  return Math.round((mu - 3 * sigma) * OPENSKILL_DISPLAY_SCALE + OPENSKILL_DISPLAY_OFFSET);
}
