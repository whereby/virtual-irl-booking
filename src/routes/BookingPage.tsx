import { useEffect, useState } from "react";
import type { Meeting, MeetingKind } from "../types";
import { createMeeting, listMeetings } from "../api";

// Default the picker to the next half hour, formatted for datetime-local
// (YYYY-MM-DDTHH:mm in the browser's local time).
function defaultStart(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BookingPage() {
  const [start, setStart] = useState(defaultStart);
  const [kind, setKind] = useState<MeetingKind>("virtual");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = () => listMeetings().then(setMeetings).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // datetime-local has no timezone; treat it as local and send ISO.
      await createMeeting(new Date(start).toISOString(), kind);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyPatientLink(slug: string) {
    const url = `${window.location.origin}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(slug);
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1800);
    } catch {
      window.prompt("Copy the patient link:", url);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Consultation Booking</span>
      </header>

      <main className="booking">
        <section className="card">
          <h2>Book a 30-minute consultation</h2>
          <form className="book-form" onSubmit={book}>
            <label className="field">
              <span className="field-label">Date &amp; time</span>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </label>

            <fieldset className="kind-toggle">
              <legend className="field-label">Meeting type</legend>
              <label className={`kind-option${kind === "virtual" ? " is-on" : ""}`}>
                <input
                  type="radio"
                  name="kind"
                  value="virtual"
                  checked={kind === "virtual"}
                  onChange={() => setKind("virtual")}
                />
                <span className="kind-title">Virtual</span>
                <span className="kind-desc">
                  Whereby prebuilt video · normal transcription
                </span>
              </label>
              <label className={`kind-option${kind === "irl" ? " is-on" : ""}`}>
                <input
                  type="radio"
                  name="kind"
                  value="irl"
                  checked={kind === "irl"}
                  onChange={() => setKind("irl")}
                />
                <span className="kind-title">In real life</span>
                <span className="kind-desc">
                  Recording button · verbatim transcription
                </span>
              </label>
            </fieldset>

            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Booking…" : "Book meeting"}
            </button>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>

        <section className="card">
          <h2>Booked meetings</h2>
          {meetings.length === 0 ? (
            <p className="empty">No meetings booked yet.</p>
          ) : (
            <ul className="meeting-list">
              {meetings.map((m) => (
                <li key={m.slug} className="meeting-row">
                  <div className="meeting-main">
                    <span className={`badge badge-${m.kind}`}>
                      {m.kind === "virtual" ? "Virtual" : "IRL"}
                    </span>
                    <span className="meeting-when">{formatWhen(m.startDate)}</span>
                    <span className="meeting-slug">{m.slug}</span>
                  </div>
                  <div className="meeting-actions">
                    <a
                      className="action"
                      href={`/${m.slug}?role=host`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {m.kind === "irl" ? "Open recorder" : "Open (host)"}
                    </a>
                    {/* IRL is in-person — one device records, so there is no
                        separate patient link to share. */}
                    {m.kind === "virtual" && (
                      <button
                        className="action"
                        type="button"
                        onClick={() => copyPatientLink(m.slug)}
                      >
                        {copied === m.slug ? "Copied!" : "Copy patient link"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default BookingPage;
