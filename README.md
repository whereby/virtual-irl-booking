# Virtual & IRL Consultation Booking

A small demo that lets a clinician book 30-minute consultations and generate
[Whereby](https://whereby.com) meeting links for two scenarios:

- **Virtual** — Whereby's prebuilt video experience (room prefix `demo-vid-`,
  normal transcription).
- **In real life (IRL)** — a single-device audio recorder with a record button,
  for in-person consultations (room prefix `demo-irl-`, verbatim
  transcription).

Each booking creates a real Whereby room and gets a unique in-app URL that
mirrors the room slug (e.g. `/demo-irl-<uuid>`). Opening that URL renders the
right experience in-app. A list of booked meetings lets you open a meeting or
copy the patient link.

It's a React + TypeScript + Vite app. The Whereby API key stays server-side via
a small Vite dev-server middleware — the browser only ever talks to `/api/*`.

## Prerequisites

- [Node.js](https://nodejs.org) 18+ and npm.
- A Whereby account with API access and a **Whereby API key** (a Bearer token
  for the [Whereby REST API](https://docs.whereby.com)). Live transcription must
  be enabled for your account/plan.

## Setup

```bash
npm install
cp .env.example .env
```

Then open `.env` and set your key:

```
WHEREBY_API_KEY=your-whereby-api-key-here
```

Your meeting subdomain (e.g. `your-org.whereby.com`) is **not** configured here —
Whereby derives it from the account that owns the API key and returns it in every
created room URL, so it works automatically.

## Run

```bash
npm run dev
```

Open <http://localhost:5500>. The port is pinned (`strictPort`); change it in
[`vite.config.ts`](vite.config.ts) if 5500 is taken. Stop with `Ctrl+C`.

To book on your own machine and try it:

1. Pick a date/time and a meeting type, then **Book meeting**.
2. **Open recorder** (IRL) or **Open (host)** (virtual) opens the meeting as the
   host. For virtual meetings, **Copy patient link** gives the visitor URL to
   share.

## How it works

- `POST /api/meetings` (in [`server/wherebyApiPlugin.ts`](server/wherebyApiPlugin.ts))
  creates a Whereby room with the per-type prefix and transcription preference,
  then stores the booking.
- Bookings persist to `meetings.json` in the project root, so links work across
  tabs/devices and survive restarts.
- The host URL carries a `roomKey` (required to start transcription); the plain
  room URL is the visitor link.
- The Whereby room is provisioned with a long expiry so it stays joinable for the
  demo — independent of the 30-minute appointment length shown in the UI.

## Notes

- `.env` (your API key) and `meetings.json` (your booked rooms) are gitignored —
  they're account-specific and never committed.
- This is a demo: no auth, and the API proxy runs in the Vite dev server only
  (not built for production deployment).

## Scripts

- `npm run dev` — start the app + API proxy.
- `npm run build` — type-check and build for production.
- `npm run preview` — preview the production build (no API proxy).
