// Every seeded sport's scoring format reduces to one of two shapes: a
// single cumulative number per team (most sports), or a sequence of
// discrete set/game rows (racquet sports scored in sets, volleyball).

export type ScoreShape = "single" | "sets";

export type SingleNumberRules = {
  compare: "highest" | "lowest"; // Golf = lowest strokes wins, everything else = highest
  target?: number; // pointsToWin / racesTo / framesToWin / legsToWin -- absent for open-ended sports (Basketball, Soccer, Softball, Golf, Bowling)
  winBy?: number; // required margin once target is reached; default 1 when target is set
  maxCap?: number; // e.g. Badminton's capAt -- winBy is waived once this is reached
  boundedMax?: number; // e.g. Bowling's 300 -- reject scores above this
  softTarget?: boolean; // e.g. Air Hockey/Shuffleboard -- time/frame-limited, match can end before reaching target
  allowDraw: boolean; // only Soccer allows a tied final score
};

export type SetsRules = {
  setTarget: number; // gamesPerSet / pointsPerSet
  winBy: number; // required margin to win a set
  setsToWin: number; // derived from bestOf when the sport only specifies that
  deciderTarget?: number; // tiebreakerAt / tiebreakerPoints -- overrides setTarget for the final possible set only
  maxCap?: number; // e.g. Badminton's capAt
};

export type SportRuleConfig =
  | { shape: "single"; rules: SingleNumberRules }
  | { shape: "sets"; rules: SetsRules };

export type ScoreResult =
  | { valid: true; draw: true; teamScores: Record<string, number> }
  | { valid: true; draw: false; winnerTeamId: string; teamScores: Record<string, number> }
  | { valid: false; error: string };
