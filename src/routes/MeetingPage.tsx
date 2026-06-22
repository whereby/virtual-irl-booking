import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import type { Meeting } from "../types";
import { getMeeting } from "../api";
import VirtualMeeting from "../components/VirtualMeeting";
import IrlRecorder from "../components/IrlRecorder";

function MeetingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get("role") === "host";

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );

  useEffect(() => {
    if (!slug) return;
    getMeeting(slug)
      .then((m) => {
        setMeeting(m);
        setStatus("ready");
      })
      .catch(() => setStatus("missing"));
  }, [slug]);

  if (status === "loading") {
    return <CenteredNote text="Loading meeting…" />;
  }
  if (status === "missing" || !meeting) {
    return (
      <CenteredNote text="This meeting link doesn’t exist.">
        <Link className="action" to="/">
          Back to booking
        </Link>
      </CenteredNote>
    );
  }

  // Host gets the URL carrying the roomKey; visitor (patient) gets the plain URL.
  const roomUrl =
    isHost && meeting.hostRoomUrl ? meeting.hostRoomUrl : meeting.roomUrl;

  return meeting.kind === "virtual" ? (
    <VirtualMeeting url={roomUrl} />
  ) : (
    <IrlRecorder roomUrl={roomUrl} />
  );
}

function CenteredNote({
  text,
  children,
}: {
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="app">
      <main className="recorder">
        <p className="record-label">{text}</p>
        {children}
      </main>
    </div>
  );
}

export default MeetingPage;
