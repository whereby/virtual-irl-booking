import { useEffect, useRef, useState } from "react";
import {
  useRoomConnection,
  useLocalMedia,
  VideoView,
} from "@whereby.com/browser-sdk/react";

type ConnState = "ready" | "connecting" | "off";

function IrlRecorder({ roomUrl }: { roomUrl: string }) {
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Consultation Recorder</span>
      </header>
      <MicGate roomUrl={roomUrl} />
    </div>
  );
}

// We acquire a microphone-only stream ourselves — getUserMedia({ audio: true })
// with no video key — and hand it to the SDK below. This guarantees the browser
// only ever prompts for the mic. (Letting the SDK acquire its own media prompts
// for the camera too, even with video: false.) Only once the mic is granted do
// we mount the Recorder, so useLocalMedia always receives a ready stream.
function MicGate({ roomUrl }: { roomUrl: string }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let active = true;
    let acquired: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        acquired = s;
        if (active) setStream(s);
        else s.getTracks().forEach((t) => t.stop());
      })
      .catch(() => {
        if (active) setDenied(true);
      });
    return () => {
      active = false;
      acquired?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (denied) {
    return (
      <main className="recorder">
        <div className="status-pill is-off">
          <span className="status-dot" />
          Microphone blocked
        </div>
        <p className="record-meta hint">
          Microphone unavailable — check browser permissions, then reload.
        </p>
      </main>
    );
  }

  if (!stream) {
    return (
      <main className="recorder">
        <div className="status-pill is-connecting">
          <span className="status-dot" />
          Requesting microphone…
        </div>
      </main>
    );
  }

  return <Recorder roomUrl={roomUrl} stream={stream} />;
}

function Recorder({
  roomUrl,
  stream,
}: {
  roomUrl: string;
  stream: MediaStream;
}) {
  // Drive the connection with our pre-acquired audio-only stream so the SDK
  // never calls getUserMedia itself (and so never requests the camera).
  const localMedia = useLocalMedia(stream);
  const { state, actions } = useRoomConnection(roomUrl, { localMedia });

  const {
    remoteParticipants,
    connectionStatus,
    isMicrophoneEnabled,
    liveTranscription,
    liveCaptions,
  } = state;
  const {
    joinRoom,
    leaveRoom,
    startLiveTranscription,
    stopLiveTranscription,
    startLiveCaptions,
    stopLiveCaptions,
  } = actions;

  const isConnected = connectionStatus === "connected";
  const transcriptionStatus = liveTranscription?.status;
  const isRecording = transcriptionStatus === "transcribing";
  const isPending = transcriptionStatus === "requested";
  const hasOtherParticipant = remoteParticipants.length > 0;

  // Recording can only begin when we're in the room with a live mic.
  const canRecord = isConnected && isMicrophoneEnabled;
  const blockedReason = !isConnected
    ? "Connecting to the room…"
    : !isMicrophoneEnabled
      ? "Microphone unavailable — check browser permissions."
      : null;

  useEffect(() => {
    joinRoom();
    return () => leaveRoom();
  }, [joinRoom, leaveRoom]);

  // Live elapsed timer while recording.
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isRecording) {
      startRef.current = null;
      setElapsedMs(0);
      return;
    }
    startRef.current = liveTranscription?.startedAt ?? Date.now();
    setElapsedMs(Date.now() - startRef.current);
    const id = setInterval(() => {
      if (startRef.current != null) setElapsedMs(Date.now() - startRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording, liveTranscription?.startedAt]);

  const connState: ConnState =
    connectionStatus === "connected"
      ? "ready"
      : connectionStatus === "connecting" || connectionStatus === "reconnecting"
        ? "connecting"
        : "off";

  const statusLabel =
    connState === "ready"
      ? "Ready to record"
      : connState === "connecting"
        ? "Connecting…"
        : "Disconnected";

  const buttonLabel = isRecording
    ? "Stop recording"
    : isPending
      ? "Starting…"
      : "Start recording";

  // Recent caption lines (one per sentence/utterance), shown while recording so
  // it's visible that audio is being transcribed in real time. Interim results
  // that share a resultId are collapsed to their latest text, and we only keep
  // captions from the current recording. The fixed-height box below shows the
  // most recent few; older lines scroll up out of view.
  const captionLines = (() => {
    const log = liveCaptions?.captionLog ?? [];
    if (log.length === 0) return [];
    const since = liveCaptions?.startedAt ?? 0;
    const byId = new Map<string, string>();
    for (const c of log) {
      if (c.timestamp < since) continue;
      const text = c.text.trim();
      if (text) byId.set(c.resultId, text);
    }
    return [...byId.entries()].slice(-8).map(([id, text]) => ({ id, text }));
  })();

  return (
    <main className="recorder">
      <div className={`status-pill is-${connState}`}>
        <span className="status-dot" />
        {statusLabel}
      </div>

      <div className="record-area">
        <button
          type="button"
          className={`record-button${isRecording ? " is-recording" : ""}`}
          disabled={isPending || (!isRecording && !canRecord)}
          aria-pressed={isRecording}
          aria-label={buttonLabel}
          title={!isRecording && blockedReason ? blockedReason : undefined}
          onClick={() => {
            if (isRecording) {
              stopLiveTranscription();
              stopLiveCaptions();
            } else {
              startLiveTranscription();
              // Live captions run alongside the recording purely to show a
              // rolling preview of what's being heard.
              startLiveCaptions();
            }
          }}
        >
          {isPending ? (
            <span className="spinner" aria-hidden="true" />
          ) : isRecording ? (
            <span className="stop-icon" aria-hidden="true" />
          ) : (
            <MicIcon />
          )}
        </button>

        <p className="record-label">{buttonLabel}</p>

        {isRecording ? (
          <p className="record-meta record-timer">
            <span className="rec-dot" aria-hidden="true" /> Recording ·{" "}
            {formatElapsed(elapsedMs)}
          </p>
        ) : (
          isConnected &&
          !isMicrophoneEnabled && (
            <p className="record-meta hint">{blockedReason}</p>
          )
        )}
      </div>

      {isRecording && (
        <div className="caption-strip" aria-live="polite">
          {captionLines.length === 0 ? (
            <p className="caption-placeholder">Listening…</p>
          ) : (
            captionLines.map((line, i) => (
              <p
                key={line.id}
                className={`caption-line${
                  i === captionLines.length - 1 ? " is-current" : ""
                }`}
              >
                {line.text}
              </p>
            ))
          )}
        </div>
      )}

      <p className={`participant-note${hasOtherParticipant ? " is-on" : ""}`}>
        {hasOtherParticipant ? "Other participant connected" : " "}
      </p>

      {transcriptionStatus === "error" && (
        <p className="error-banner" role="alert">
          Recording failed to start
          {liveTranscription?.error ? `: ${liveTranscription.error}` : ""}.
          {liveTranscription?.error === "not_in_a_room"
            ? " The room wasn’t fully connected — wait for “Ready”, then try again."
            : " Live transcription may not be enabled for this Whereby account/plan."}
        </p>
      )}

      {/* Audio-only: render remote participants' streams (hidden) so their audio plays. */}
      {remoteParticipants.map(
        (p) =>
          p.stream && (
            <VideoView
              key={p.id}
              stream={p.stream}
              style={{ display: "none" }}
            />
          ),
      )}
    </main>
  );
}

function MicIcon() {
  return (
    <svg
      className="mic-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M18 12a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V23h2v-3.06A8 8 0 0 0 20 12h-2Z" />
    </svg>
  );
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default IrlRecorder;
