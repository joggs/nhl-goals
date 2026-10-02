import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path matches the GitHub Pages project URL (joggs.github.io/nhl-goals/).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? "/nhl-goals/",
});
