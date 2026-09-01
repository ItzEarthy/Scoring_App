import type { ScoreResult, SetsRules } from "./types";

export function validateSets(
  teamIds: string[],
  rows: Record<string, number>[],
  rules: SetsRules
): ScoreResult {
  if (teamIds.length !== 2) {
    return { valid: false, error: "Exactly two teams are required to report a score." };
  }
  const [aId, bId] = teamIds;
  const maxRows = 2 * rules.setsToWin - 1;

  if (rows.length === 0) {
    return { valid: false, error: "Enter at least one set." };
  }
  if (rows.length > maxRows) {
    return { valid: false, error: `No more than ${maxRows} sets are possible.` };
  }

  let aSets = 0;
  let bSets = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const a = row[aId];
    const b = row[bId];

    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      return { valid: false, error: `Set ${i + 1}: enter valid, non-negative scores for both sides.` };
    }
    if (aSets >= rules.setsToWin || bSets >= rules.setsToWin) {
      return { valid: false, error: "Extra set rows were submitted after the match was already decided." };
    }
    if (a === b) {
      return { valid: false, error: `Set ${i + 1}: scores can't be tied.` };
    }

    const isDecider = i === maxRows - 1;
    const target = isDecider && rules.deciderTarget != null ? rules.deciderTarget : rules.setTarget;
    const winner: "a" | "b" = a > b ? "a" : "b";
    const winnerScore = winner === "a" ? a : b;
    const loserScore = winner === "a" ? b : a;
    const reachedTarget = winnerScore >= target;
    const reachedCap = rules.maxCap != null && winnerScore >= rules.maxCap;

    if (!reachedTarget) {
      return { valid: false, error: `Set ${i + 1}: the winning score must reach ${target}.` };
    }
    if (!reachedCap && winnerScore - loserScore < rules.winBy) {
      return {
        valid: false,
        error: `Set ${i + 1}: win margin must be at least ${rules.winBy}${
          rules.maxCap ? ` (or reach ${rules.maxCap})` : ""
        }.`,
      };
    }

    if (winner === "a") aSets++;
    else bSets++;
  }

  if (aSets !== rules.setsToWin && bSets !== rules.setsToWin) {
    return {
      valid: false,
      error: `Match incomplete -- no side has won the required ${rules.setsToWin} sets yet.`,
    };
  }

  const winnerTeamId = aSets === rules.setsToWin ? aId : bId;
  return { valid: true, draw: false, winnerTeamId, teamScores: { [aId]: aSets, [bId]: bSets } };
}
