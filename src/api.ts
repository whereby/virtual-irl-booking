import type { Meeting, MeetingKind } from "./types";

async function asJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const detail =
      typeof data === "object" && data && "detail" in data
        ? JSON.stringify((data as { detail: unknown }).detail)
        : (data as { error?: string }).error;
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function listMeetings(): Promise<Meeting[]> {
  return asJson<Meeting[]>(await fetch("/api/meetings"));
}

export async function getMeeting(slug: string): Promise<Meeting> {
  return asJson<Meeting>(await fetch(`/api/meetings/${encodeURIComponent(slug)}`));
}

export async function createMeeting(
  startDate: string,
  kind: MeetingKind,
): Promise<Meeting> {
  return asJson<Meeting>(
    await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, kind }),
    }),
  );
}
