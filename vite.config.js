import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/job-crm",
  server: {
    port: 3000,
    open: true,
  },
});
