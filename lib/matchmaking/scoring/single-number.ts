import type { ScoreResult, SingleNumberRules } from "./types";

// Orients a raw score so "higher is better" always holds internally, even
// for compare:"lowest" sports (Golf) -- lets every downstream comparison,
// target, and margin check share one code path.
function orient(score: number, rules: SingleNumberRules): number {
  return rules.compare === "lowest" ? -score : score;
}

export function validateSingleNumber(
  teamIds: string[],
  scores: Record<string, number>,
  rules: SingleNumberRules
): ScoreResult {
  if (teamIds.length !== 2) {
    return { valid: false, error: "Exactly two teams are required to report a score." };
  }
  const [aId, bId] = teamIds;

  for (const id of teamIds) {
    const s = scores[id];
    if (!Number.isInteger(s) || s < 0) {
      return { valid: false, error: "Enter a valid, non-negative score for every team." };
    }
    if (rules.boundedMax != null && s > rules.boundedMax) {
      return { valid: false, error: `Score can't exceed ${rules.boundedMax}.` };
    }
  }

  const a = scores[aId];
  const b = scores[bId];
  const aOriented = orient(a, rules);
  const bOriented = orient(b, rules);

  if (aOriented === bOriented) {
    if (rules.allowDraw) {
      return { valid: true, draw: true, teamScores: { [aId]: a, [bId]: b } };
    }
    return { valid: false, error: "Scores are tied and this sport doesn't allow a draw." };
  }

  const winnerId = aOriented > bOriented ? aId : bId;
  const winnerOriented = Math.max(aOriented, bOriented);
  const loserOriented = Math.min(aOriented, bOriented);
  const margin = winnerOriented - loserOriented;

  if (rules.target != null) {
    const reachedTarget = winnerOriented >= rules.target;
    const reachedCap = rules.maxCap != null && winnerOriented >= rules.maxCap;

    if (!rules.softTarget && !reachedTarget) {
      return { valid: false, error: `The winning score doesn't reach the required ${rules.target}.` };
    }

    if (!rules.softTarget && reachedTarget && !reachedCap) {
      const requiredWinBy = rules.winBy ?? 1;
      if (margin < requiredWinBy) {
        return {
          valid: false,
          error: `Win margin must be at least ${requiredWinBy}${
            rules.maxCap ? ` (or reach ${rules.maxCap})` : ""
          }.`,
        };
      }
    }
  }

  return { valid: true, draw: false, winnerTeamId: winnerId, teamScores: { [aId]: a, [bId]: b } };
}
