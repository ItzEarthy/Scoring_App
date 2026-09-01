// Minimal self-hosted WebSocket relay for live match scoreboards.
//
// This process holds no database connection and makes no authorization
// decisions of its own beyond verifying the short-lived join token minted by
// the Next.js app (see lib/realtime/token.ts, which uses the same HMAC
// scheme). All score mutations happen in Next.js Server Actions, which then
// POST the resulting event to this server's /broadcast endpoint for fan-out
// to every socket subscribed to that match. That keeps a single source of
// truth (Postgres, via Prisma) and a single place with participant/auth
// checks, while this relay just does fast pub/sub over WebSocket.
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 3001);
const SHARED_SECRET = process.env.REALTIME_SHARED_SECRET;

if (!SHARED_SECRET) {
  console.error("REALTIME_SHARED_SECRET is required");
  process.exit(1);
}

function base64UrlDecode(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

/** Verifies a join token minted by lib/realtime/token.ts. */
function verifyJoinToken(token, matchId) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  const expectedSig = createHmac("sha256", SHARED_SECRET).update(payloadPart).digest();
  let providedSig;
  try {
    providedSig = base64UrlDecode(signaturePart);
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length || !timingSafeEqual(providedSig, expectedSig)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart).toString("utf8"));
  } catch {
    return null;
  }

  if (payload.matchId !== matchId) return null;
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  return payload;
}

// matchId -> Set<WebSocket>
const rooms = new Map();

function roomFor(matchId) {
  let room = rooms.get(matchId);
  if (!room) {
    room = new Set();
    rooms.set(matchId, room);
  }
  return room;
}

function broadcast(matchId, message) {
  const room = rooms.get(matchId);
  if (!room || room.size === 0) return;
  const data = JSON.stringify(message);
  for (const socket of room) {
    if (socket.readyState === socket.OPEN) socket.send(data);
  }
}

function broadcastPresence(matchId) {
  const room = rooms.get(matchId);
  broadcast(matchId, { type: "presence", viewers: room ? room.size : 0 });
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  if (req.method === "POST" && url.pathname === "/broadcast") {
    const authHeader = req.headers["x-internal-secret"];
    if (authHeader !== SHARED_SECRET) {
      res.writeHead(401).end();
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { matchId, event } = JSON.parse(body);
        if (typeof matchId !== "string" || !event) throw new Error("invalid payload");
        broadcast(matchId, event);
        res.writeHead(204).end();
      } catch {
        res.writeHead(400).end();
      }
    });
    return;
  }

  res.writeHead(404).end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const matchId = url.searchParams.get("matchId");
  const token = url.searchParams.get("token");
  const payload = matchId ? verifyJoinToken(token, matchId) : null;

  if (!payload) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.matchId = matchId;
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const room = roomFor(matchId);
    room.add(ws);
    ws.send(JSON.stringify({ type: "presence", viewers: room.size }));
    broadcastPresence(matchId);

    ws.on("close", () => {
      room.delete(ws);
      if (room.size === 0) rooms.delete(matchId);
      broadcastPresence(matchId);
    });

    ws.on("error", () => ws.terminate());
  });
});

// Drop dead connections (e.g. phones that lost the network without a clean
// close) so room/viewer counts stay accurate.
const heartbeat = setInterval(() => {
  for (const room of rooms.values()) {
    for (const ws of room) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }
}, 30_000);

server.on("close", () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`realtime relay listening on :${PORT}`);
});
