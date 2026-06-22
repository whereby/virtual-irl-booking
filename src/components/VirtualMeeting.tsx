// Importing the embed entrypoint registers the <whereby-embed> custom element
// and its JSX types. This renders Whereby's full prebuilt meeting experience.
import "@whereby.com/browser-sdk/embed";

function VirtualMeeting({ url }: { url: string }) {
  return (
    <whereby-embed
      room={url}
      style={{ width: "100%", height: "100svh", border: "0", display: "block" }}
    />
  );
}

export default VirtualMeeting;
