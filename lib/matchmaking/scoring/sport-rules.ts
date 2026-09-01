import type { SportRuleConfig } from "./types";

type RawRules = Record<string, unknown>;

function num(rules: RawRules, key: string): number | undefined {
  const v = rules[key];
  return typeof v === "number" ? v : undefined;
}

function bool(rules: RawRules, key: string): boolean {
  return rules[key] === true;
}

function setsToWinFromBestOf(rules: RawRules, fallbackBestOf: number): number {
  const explicit = num(rules, "setsToWin");
  if (explicit != null) return explicit;
  const bestOf = num(rules, "bestOf") ?? fallbackBestOf;
  return Math.ceil(bestOf / 2);
}

// One extractor per base sport name (doubles variants share their singles
// counterpart's rules -- see getScoreConfig). Reads live values out of the
// sport's own `defaultRules` JSON rather than hardcoding numbers here, so
// editing a sport's rules in the admin catalog UI takes effect immediately.
const EXTRACTORS: Record<string, (r: RawRules) => SportRuleConfig> = {
  // --- Sets-shaped: racquet sports scored in sets/games, plus Volleyball ---
  Tennis: (r) => {
    const tiebreakerAt = num(r, "tiebreakerAt");
    return {
      shape: "sets",
      rules: {
        setTarget: num(r, "gamesPerSet") ?? 6,
        winBy: 2,
        setsToWin: num(r, "setsToWin") ?? 2,
        maxCap: tiebreakerAt != null ? tiebreakerAt + 1 : undefined,
      },
    };
  },
  "Table Tennis": (r) => ({
    shape: "sets",
    rules: {
      setTarget: num(r, "pointsToWin") ?? 11,
      winBy: num(r, "winBy") ?? 2,
      setsToWin: setsToWinFromBestOf(r, 5),
    },
  }),
  Squash: (r) => ({
    shape: "sets",
    rules: {
      setTarget: num(r, "pointsToWin") ?? 11,
      winBy: 2,
      setsToWin: setsToWinFromBestOf(r, 5),
    },
  }),
  Badminton: (r) => ({
    shape: "sets",
    rules: {
      setTarget: num(r, "pointsToWin") ?? 21,
      winBy: 2,
      setsToWin: setsToWinFromBestOf(r, 3),
      maxCap: num(r, "capAt"),
    },
  }),
  Volleyball: (r) => ({
    shape: "sets",
    rules: {
      setTarget: num(r, "pointsPerSet") ?? 25,
      winBy: 2,
      setsToWin: num(r, "setsToWin") ?? 3,
      deciderTarget: num(r, "tiebreakerPoints"),
    },
  }),

  // --- Single-number: one cumulative score per team ---
  Racquetball: (r) => ({
    shape: "single",
    rules: { compare: "highest", target: num(r, "pointsToWin") ?? 15, winBy: 1, allowDraw: false },
  }),
  Pickleball: (r) => ({
    shape: "single",
    rules: {
      compare: "highest",
      target: num(r, "pointsToWin") ?? 11,
      winBy: num(r, "winBy") ?? 2,
      allowDraw: false,
    },
  }),
  Billiards: (r) => ({
    shape: "single",
    rules: { compare: "highest", target: num(r, "racesTo") ?? 5, winBy: 1, allowDraw: false },
  }),
  Snooker: (r) => ({
    shape: "single",
    rules: { compare: "highest", target: num(r, "framesToWin") ?? 3, winBy: 1, allowDraw: false },
  }),
  Darts: (r) => ({
    shape: "single",
    rules: { compare: "highest", target: num(r, "legsToWin") ?? 3, winBy: 1, allowDraw: false },
  }),
  Golf: () => ({
    shape: "single",
    rules: { compare: "lowest", allowDraw: false },
  }),
  Bowling: () => ({
    shape: "single",
    rules: { compare: "highest", boundedMax: 300, allowDraw: false },
  }),
  Foosball: (r) => ({
    shape: "single",
    rules: { compare: "highest", target: num(r, "pointsToWin") ?? 5, winBy: 1, allowDraw: false },
  }),
  "Air Hockey": (r) => ({
    shape: "single",
    rules: {
      compare: "highest",
      target: num(r, "pointsToWin") ?? 7,
      winBy: 1,
      softTarget: true,
      allowDraw: false,
    },
  }),
  Shuffleboard: (r) => ({
    shape: "single",
    rules: {
      compare: "highest",
      target: num(r, "pointsToWin") ?? 15,
      winBy: 1,
      softTarget: true,
      allowDraw: false,
    },
  }),
  Cornhole: (r) => ({
    shape: "single",
    rules: { compare: "highest", target: num(r, "pointsToWin") ?? 21, winBy: 1, allowDraw: false },
  }),
  Spikeball: (r) => ({
    shape: "single",
    rules: {
      compare: "highest",
      target: num(r, "pointsToWin") ?? 21,
      winBy: num(r, "winBy") ?? 2,
      allowDraw: false,
    },
  }),
  Basketball: (r) => ({
    shape: "single",
    rules: { compare: "highest", allowDraw: bool(r, "allowDraw") },
  }),
  Soccer: (r) => ({
    shape: "single",
    rules: { compare: "highest", allowDraw: bool(r, "allowDraw") },
  }),
  Softball: (r) => ({
    shape: "single",
    rules: { compare: "highest", allowDraw: bool(r, "allowDraw") },
  }),
};

export function getScoreConfig(sport: { name: string; defaultRules: unknown }): SportRuleConfig {
  const baseName = sport.name.replace(/ - Doubles$/, "");
  const rules = (sport.defaultRules ?? {}) as RawRules;
  const extractor = EXTRACTORS[baseName];

  if (!extractor) {
    // Fallback for any custom sport an admin adds outside the seeded
    // catalog: highest cumulative score wins, no target enforced, no draw.
    return { shape: "single", rules: { compare: "highest", allowDraw: false } };
  }
  return extractor(rules);
}
