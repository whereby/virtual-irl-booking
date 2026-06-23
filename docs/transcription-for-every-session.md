# One platform, every session: transcription for online *and* in-person consultations

*Audience: engineering leadership.*
**TL;DR —** With a single Whereby room, a few SDK calls, and no extra infrastructure, you can capture and transcribe **in-person** sessions using the exact same real-time stack that powers your online meetings.

## The idea

Most video platforms stop at the screen. But a lot of high-value conversations — a doctor and a patient, a therapist and a client, an advisor and a customer — happen in the *same room*. They still need a record: a transcript, a summary, a searchable history.

The insight behind this build: **a Whereby room doesn't have to be a "meeting."** It can be a session pipeline. Point a single device at a room, capture audio, turn on transcription. No second participant, no remote call — just the room's real-time and transcription infrastructure doing the work.

That means one platform covers both modalities:

- **Online** consultations → the prebuilt UI (`<whereby-embed>`): full video, live transcription.
- **In real life (IRL)** consultations → the SDK: audio-only, one participant, verbatim transcription.

Same rooms, same API, same transcription engine. Different front door.

## What we built

A small React app where a clinician books a 30-minute consultation and picks the type:

- **Virtual** → generates host + guest links into the Whereby prebuilt experience.
- **IRL** → opens a single screen with one big record button — for the device sitting on the desk between clinician and patient.

Both are backed by rooms created through the Whereby REST API. The only meaningful differences are which front-end you mount and which transcription preference you set at creation.

## The IRL mechanic

Three moves.

**1. Create a room, flagged for verbatim transcription.** Server-side, so the API key never reaches the browser.

```bash
curl https://api.whereby.dev/v1/meetings \
  -H "Authorization: Bearer $WHEREBY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "endDate": "2027-01-01T00:00:00Z",
        "roomMode": "group",
        "roomNamePrefix": "clinic-irl-",
        "fields": ["hostRoomUrl"],
        "roomPreferences": { "verbatimTranscription": true }
      }'
```

The response returns a `roomUrl` and a `hostRoomUrl`. The latter carries a `roomKey` that grants **host** privileges — required to start transcription.

**2. Join with a single audio-only participant.** This is the device in the room. We acquire a mic-only stream ourselves (so the browser never asks for the camera) and hand it to the SDK:

```tsx
// micOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true })
const localMedia = useLocalMedia(micOnlyStream);
const { state, actions } = useRoomConnection(hostRoomUrl, { localMedia });

useEffect(() => {
  actions.joinRoom();
  return actions.leaveRoom;
}, []);
```

Because the room only ever has **one** participant, there's no second party to bill for and no video to ship — you're using the room purely as a real-time audio + transcription channel.

**3. Record, and show it's working.** One button starts verbatim transcription (the record) and live captions (the on-screen proof that audio is flowing):

```tsx
// on press
actions.startLiveTranscription(); // the verbatim record
actions.startLiveCaptions();       // a rolling, human-visible preview

// render the last few caption lines under the button
state.liveCaptions?.captionLog.slice(-4).map((c) => c.text);
```

That's the whole trick. No bespoke audio pipeline, no third-party speech-to-text integration, no separate billing system. The same engine that captions your online meetings now captions the room.

## Why this matters

For a platform business, this is leverage. You already operate the hard parts — real-time media, a transcription engine, a global edge. Exposing them through **two surfaces** — prebuilt UI for online, SDK for in-person — lets a single customer serve *their* customers across both worlds with one integration and one data model.

Concretely, a healthcare or coaching customer can run remote sessions in the prebuilt UI **and** capture in-person sessions with the SDK recorder — and get transcripts for **all** of them, in the same format, from the same provider. The transcript becomes the unifying artifact: feed it into notes, summaries, search, or compliance, regardless of where the conversation physically happened.

In-person conversations have been a blind spot for video platforms. They don't have to be.

## The shape of the integration

- **One server endpoint** creates rooms (keeping the API key server-side) and sets the per-type transcription preference.
- **Two front-ends:** `<whereby-embed>` for virtual; a ~150-line SDK component for IRL.
- **Rooms double as session URLs.** Each booking gets a slug that mirrors the room; opening it mounts the right experience.

A few notes worth carrying into production:

- The **host URL's `roomKey`** is what authorizes transcription — connect with that, not the guest URL.
- Give the room a **generous `endDate`** so it's joinable whenever the session actually runs; keep it independent of the appointment length.
- For IRL, **acquire the microphone stream yourself** so the browser prompts for the mic only — never the camera.

## Bottom line

With a room, a single participant, and a transcription flag, the same infrastructure that runs your online meetings turns real-world sessions into structured, searchable records — and gives your customers one provider for every conversation, on screen or in the room.
