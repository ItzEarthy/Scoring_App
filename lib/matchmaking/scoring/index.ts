import { getScoreConfig } from "./sport-rules";
import { validateSingleNumber } from "./single-number";
import { validateSets } from "./sets";
import type { ScoreResult, ScoreShape } from "./types";

export type { ScoreResult, ScoreShape, SportRuleConfig } from "./types";
export { getScoreConfig } from "./sport-rules";

export type RawScoreInput = {
  single?: Record<string, number>;
  sets?: Record<string, number>[];
};

export function validateAndDeriveScore(
  sport: { name: string; defaultRules: unknown },
  teamIds: string[],
  input: RawScoreInput
): ScoreResult {
  const config = getScoreConfig(sport);

  if (config.shape === "single") {
    if (!input.single) return { valid: false, error: "Missing score input." };
    return validateSingleNumber(teamIds, input.single, config.rules);
  }

  if (!input.sets) return { valid: false, error: "Missing set scores." };
  return validateSets(teamIds, input.sets, config.rules);
}

/**
 * Parses the raw FormData fields report-score-form.tsx submits for a given
 * shape: one `score:${teamId}` number field per team for "single", or a
 * single JSON-encoded `sets` field (array of {[teamId]: number} rows) for
 * "sets" -- mirroring the JSON-in-a-form-field pattern already used for
 * Sport.defaultRules in the admin sports catalog forms.
 */
export function parseScoreFormData(
  shape: ScoreShape,
  formData: FormData,
  teamIds: string[]
): { input: RawScoreInput } | { error: string } {
  if (shape === "single") {
    const single: Record<string, number> = {};
    for (const id of teamIds) {
      const raw = formData.get(`score:${id}`);
      const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
      if (!Number.isFinite(n)) {
        return { error: "Enter a score for every team." };
      }
      single[id] = n;
    }
    return { input: { single } };
  }

  const raw = formData.get("sets");
  if (typeof raw !== "string" || !raw.trim()) {
    return { error: "Enter at least one set." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid set data submitted." };
  }
  if (!Array.isArray(parsed)) {
    return { error: "Invalid set data submitted." };
  }

  const sets: Record<string, number>[] = [];
  for (const row of parsed) {
    if (typeof row !== "object" || row === null) {
      return { error: "Invalid set data submitted." };
    }
    const entry: Record<string, number> = {};
    for (const id of teamIds) {
      const v = (row as Record<string, unknown>)[id];
      if (typeof v !== "number") {
        return { error: "Invalid set data submitted." };
      }
      entry[id] = v;
    }
    sets.push(entry);
  }
  return { input: { sets } };
}
