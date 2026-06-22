export type MeetingKind = "virtual" | "irl";

export interface Meeting {
  slug: string;
  kind: MeetingKind;
  startDate: string; // ISO
  endDate: string; // ISO
  roomUrl: string; // visitor URL
  hostRoomUrl: string | null; // host URL (carries the roomKey)
  createdAt: string; // ISO
}
