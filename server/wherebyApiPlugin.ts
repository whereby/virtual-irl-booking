import type { Plugin } from "vite";
import { loadEnv } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";

// Whereby Meetings REST API. The Bearer key is read from .env and never leaves
// the dev server — the browser only ever talks to our /api/* endpoints.
const WHEREBY_API = "https://api.whereby.dev/v1/meetings";
const STORE = path.resolve(process.cwd(), "meetings.json");
const MEETING_MINUTES = 30;
// The Whereby room's endDate is when the room expires (stops being joinable and
// rejects host actions like starting transcription). We keep it well clear of
// the 30-minute appointment so the room is reliably usable when you actually
// join — independent of when the meeting was scheduled. (The original wb-mic
// room used a far-future endDate for the same reason.)
const ROOM_LIFETIME_DAYS = 365;

export type MeetingKind = "virtual" | "irl";

export interface Meeting {
  slug: string;
  kind: MeetingKind;
  startDate: string; // ISO
  endDate: string; // ISO
  roomUrl: string; // visitor URL (Whereby prebuilt or our IRL recorder)
  hostRoomUrl: string | null; // host URL (carries the roomKey)
  createdAt: string; // ISO
}

// Per-kind room creation config.
//   virtual → Whereby prebuilt experience, normal transcription.
//   irl     → our recording-button experience, verbatim transcription
//             (verbatimTranscription confirmed working via the user's curl).
// NOTE: the "normal transcription" key for virtual is the one unverified detail;
// adjust here if the Whereby API rejects or ignores `transcription`.
const ROOM_CONFIG: Record<
  MeetingKind,
  { roomNamePrefix: string; roomPreferences: Record<string, boolean> }
> = {
  virtual: {
    roomNamePrefix: "andreas-vid-",
    roomPreferences: { transcription: true },
  },
  irl: {
    roomNamePrefix: "andreas-irl-",
    roomPreferences: { verbatimTranscription: true },
  },
};

function readStore(): Meeting[] {
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf8")) as Meeting[];
  } catch {
    return [];
  }
}

function writeStore(meetings: Meeting[]): void {
  fs.writeFileSync(STORE, JSON.stringify(meetings, null, 2));
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// The slug mimics the Whereby room URL path, e.g. "andreas-irl-<uuid>".
function deriveSlug(roomUrl: string): string {
  try {
    return new URL(roomUrl).pathname.replace(/^\/+/, "");
  } catch {
    return roomUrl;
  }
}

export function wherebyApiPlugin(): Plugin {
  let apiKey = "";

  return {
    name: "whereby-api",

    configResolved(config) {
      // loadEnv reads .env without the VITE_ prefix requirement — keeps the key
      // server-side (it is never injected into import.meta.env for the client).
      const env = loadEnv(config.mode, process.cwd(), "");
      apiKey = env.WHEREBY_API_KEY ?? process.env.WHEREBY_API_KEY ?? "";
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "", "http://localhost");
        if (!url.pathname.startsWith("/api/meetings")) return next();

        try {
          // GET /api/meetings → all bookings, newest first
          if (req.method === "GET" && url.pathname === "/api/meetings") {
            return sendJson(res, 200, readStore().slice().reverse());
          }

          // GET /api/meetings/:slug → one booking
          if (req.method === "GET") {
            const slug = decodeURIComponent(
              url.pathname.slice("/api/meetings/".length),
            );
            const found = readStore().find((m) => m.slug === slug);
            return found
              ? sendJson(res, 200, found)
              : sendJson(res, 404, { error: "not_found" });
          }

          // POST /api/meetings → create a Whereby room and persist the booking
          if (req.method === "POST" && url.pathname === "/api/meetings") {
            if (!apiKey) {
              return sendJson(res, 500, {
                error: "WHEREBY_API_KEY is not set. Copy .env.example to .env.",
              });
            }

            const body = await readJsonBody(req);
            const kind = body.kind as MeetingKind;
            const startDate = body.startDate as string;

            if (kind !== "virtual" && kind !== "irl") {
              return sendJson(res, 400, { error: "kind must be virtual or irl" });
            }
            const start = new Date(startDate);
            if (Number.isNaN(start.getTime())) {
              return sendJson(res, 400, { error: "invalid startDate" });
            }
            // The 30-minute appointment window we store and display.
            const end = new Date(start.getTime() + MEETING_MINUTES * 60_000);
            // The room's actual expiry — kept far in the future (and always
            // ahead of "now", even if the meeting was scheduled in the past) so
            // the room is joinable whenever it's opened. Decoupled from the
            // 30-minute appointment on purpose; a room that expires 30 min after
            // the start time rejects transcription with "forbidden".
            const roomExpiry = new Date(
              Math.max(start.getTime(), Date.now()) +
                ROOM_LIFETIME_DAYS * 24 * 60 * 60 * 1000,
            );
            const cfg = ROOM_CONFIG[kind];

            const wherebyResp = await fetch(WHEREBY_API, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                endDate: roomExpiry.toISOString(),
                roomMode: "group",
                roomNamePrefix: cfg.roomNamePrefix,
                isLocked: false,
                fields: ["hostRoomUrl"],
                roomPreferences: cfg.roomPreferences,
              }),
            });

            const data = (await wherebyResp.json()) as {
              roomUrl?: string;
              hostRoomUrl?: string;
            };
            if (!wherebyResp.ok || !data.roomUrl) {
              return sendJson(res, wherebyResp.status || 502, {
                error: "whereby_error",
                detail: data,
              });
            }

            const meeting: Meeting = {
              slug: deriveSlug(data.roomUrl),
              kind,
              startDate: start.toISOString(),
              endDate: end.toISOString(),
              roomUrl: data.roomUrl,
              hostRoomUrl: data.hostRoomUrl ?? null,
              createdAt: new Date().toISOString(),
            };

            const store = readStore();
            store.push(meeting);
            writeStore(store);

            return sendJson(res, 201, meeting);
          }

          return next();
        } catch (err) {
          return sendJson(res, 500, { error: String(err) });
        }
      });
    },
  };
}
