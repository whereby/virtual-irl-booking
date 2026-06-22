import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { wherebyApiPlugin } from "./server/wherebyApiPlugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wherebyApiPlugin()],
  server: {
    port: 5500,
    strictPort: true,
  },
});
