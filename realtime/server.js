// Minimal self-hosted WebSocket relay for live match scoreboards, the
// matchmaking queue, and per-user notifications.
//
// This process holds no database connection and makes no authorization
// decisions of its own beyond verifying the short-lived join token minted by
// the Next.js app (see lib/realtime/token.ts, which uses the same HMAC
// scheme). All mutations happen in Next.js Server Actions, which then POST
// the resulting event to this server's /broadcast endpoint for fan-out to
// every socket subscribed to that channel. That keeps a single source of
// truth (Postgres, via Prisma) and a single place with participant/auth
// checks, while this relay just does fast pub/sub over WebSocket.
//
// Rooms are keyed by `${channel}:${resourceId}`, where channel is one of:
//   - "match": resourceId is a matchId (live scoreboard)
//   - "user": resourceId is a userId (personal notification feed)
//   - "queue": resourceId is `${organizationId}:${sportId}` (queue updates)
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
function verifyJoinToken(token, channel, resourceId) {
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

  if (payload.channel !== channel) return null;
  if (payload.resourceId !== resourceId) return null;
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  return payload;
}

// roomKey ("channel:resourceId") -> Set<WebSocket>
const rooms = new Map();

function roomKeyFor(channel, resourceId) {
  return `${channel}:${resourceId}`;
}

function roomFor(roomKey) {
  let room = rooms.get(roomKey);
  if (!room) {
    room = new Set();
    rooms.set(roomKey, room);
  }
  return room;
}

function broadcast(roomKey, message) {
  const room = rooms.get(roomKey);
  if (!room || room.size === 0) return;
  const data = JSON.stringify(message);
  for (const socket of room) {
    if (socket.readyState === socket.OPEN) socket.send(data);
  }
}

function broadcastPresence(roomKey) {
  const room = rooms.get(roomKey);
  broadcast(roomKey, { type: "presence", viewers: room ? room.size : 0 });
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
        const { channel, resourceId, event } = JSON.parse(body);
        if (typeof channel !== "string" || typeof resourceId !== "string" || !event) {
          throw new Error("invalid payload");
        }
        broadcast(roomKeyFor(channel, resourceId), event);
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

  const channel = url.searchParams.get("channel");
  const resourceId = url.searchParams.get("resourceId");
  const token = url.searchParams.get("token");
  const payload = channel && resourceId ? verifyJoinToken(token, channel, resourceId) : null;

  if (!payload) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const roomKey = roomKeyFor(channel, resourceId);

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.roomKey = roomKey;
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    const room = roomFor(roomKey);
    room.add(ws);
    ws.send(JSON.stringify({ type: "presence", viewers: room.size }));
    broadcastPresence(roomKey);

    ws.on("close", () => {
      room.delete(ws);
      if (room.size === 0) rooms.delete(roomKey);
      broadcastPresence(roomKey);
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
