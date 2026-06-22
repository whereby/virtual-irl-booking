import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { WherebyProvider } from "@whereby.com/browser-sdk/react";
import "./index.css";
import "./App.css";
import BookingPage from "./routes/BookingPage";
import MeetingPage from "./routes/MeetingPage";

// NOTE: We intentionally do NOT wrap in <StrictMode>. In dev, StrictMode runs
// effects twice (mount → cleanup → mount), which makes the Whereby room
// connection fire joinRoom() → leaveRoom() → joinRoom() in quick succession.
// The server then drops the room session and live transcription fails with
// "not_in_a_room". Same dev-only workaround as the wb-mic project.
const router = createBrowserRouter([
  { path: "/", element: <BookingPage /> },
  { path: "/:slug", element: <MeetingPage /> },
]);

createRoot(document.getElementById("root")!).render(
  <WherebyProvider>
    <RouterProvider router={router} />
  </WherebyProvider>,
);
