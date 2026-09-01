import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived join tokens for the realtime relay (realtime/server.js). The
 * relay has no database access and makes no authorization decisions itself
 * -- it just verifies a token signed here with REALTIME_SHARED_SECRET before
 * letting a socket join a match's room. Keep this HMAC scheme in sync with
 * verifyJoinToken() in realtime/server.js.
 */

const JOIN_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours -- long enough to cover a match

function secret(): string {
  const value = process.env.REALTIME_SHARED_SECRET;
  if (!value) throw new Error("REALTIME_SHARED_SECRET is not set");
  return value;
}

function base64Url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function mintJoinToken(matchId: string, userId: string): string {
  const payload = { matchId, userId, exp: Date.now() + JOIN_TOKEN_TTL_MS };
  const payloadPart = base64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = createHmac("sha256", secret()).update(payloadPart).digest();
  return `${payloadPart}.${base64Url(signature)}`;
}

export function verifyJoinToken(
  token: string,
  matchId: string
): { userId: string } | null {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  const expectedSig = createHmac("sha256", secret()).update(payloadPart).digest();
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(signaturePart.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length || !timingSafeEqual(providedSig, expectedSig)) {
    return null;
  }

  let payload: { matchId?: string; userId?: string; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(payloadPart, "base64").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.matchId !== matchId) return null;
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  if (typeof payload.userId !== "string") return null;

  return { userId: payload.userId };
}
