"use server";

export type ReportMatchScoreState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/**
 * Placeholder action for the match-scoring form. Wires up the client form
 * end-to-end without yet touching the database or the rating engine.
 *
 * TODO: validate the caller is a match participant, branch on the org's
 * `approval_mode` (pending_confirmation vs admin_forced), persist per-participant
 * scores, and hand off to the rating recalculation in submit-match-score.ts.
 */
export async function reportMatchScoreAction(
  _prevState: ReportMatchScoreState,
  formData: FormData
): Promise<ReportMatchScoreState> {
  const matchId = formData.get("matchId");
  const winningTeamIdentifier = formData.get("winningTeamIdentifier");

  if (typeof matchId !== "string" || !matchId.trim()) {
    return { status: "error", message: "Missing match reference." };
  }

  if (typeof winningTeamIdentifier !== "string" || !winningTeamIdentifier.trim()) {
    return { status: "error", message: "Select a winner before reporting the score." };
  }

  console.log("[placeholder] reportMatchScoreAction", {
    matchId,
    winningTeamIdentifier,
    scores: Object.fromEntries(
      Array.from(formData.entries()).filter(([key]) => key.startsWith("score:"))
    ),
  });

  return {
    status: "success",
    message: "Score reported. This is a placeholder — nothing was saved yet.",
  };
}
