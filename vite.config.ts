import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Optional: `RATTERY_API_PROXY=https://rattery.tech npm run dev` serves the
  // UI locally against the deployed /api functions. Unset = no /api, which the
  // client treats as pre-launch and runs the demo tape.
  const env = loadEnv(mode, ".", "");
  const target = env.RATTERY_API_PROXY;
  return {
    plugins: [react(), {
      name: 'staging-noindex',
      transformIndexHtml(html: string) {
        return (process.env.VITE_STAGING ?? env.VITE_STAGING) === 'true'
          ? html.replace('<head>', '<head><meta name="robots" content="noindex,nofollow" />') : html;
      },
    }],
    server: target ? { proxy: { "/api": { target, changeOrigin: true } } } : undefined,
  };
});
