import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Roomix Platform Console — independent Vite app for the internal team.
// All /api/* calls are proxied to the Roomix SaaS backend so cookies
// stay first-party and we don't need CORS configured upstream.
//
// VITE_ROOMIX_API_BASE — where the SaaS API lives. Defaults to
// http://localhost:3000 for the local-dev workflow described in the
// ADR (platform-console-independent-app.md). Override per-environment
// via `.env.local` or your shell — never hard-code production URLs
// here.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const saasOrigin = env.VITE_ROOMIX_API_BASE || "http://localhost:3000";

  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        // The proxy is the only path that reaches the SaaS backend. The
        // browser stays first-party on http://localhost:5174 so cookies
        // set by the SaaS (HttpOnly, SameSite=Lax) work correctly.
        "/api": {
          target: saasOrigin,
          changeOrigin: true,
          secure: false,
          // The SaaS runs `csrfProtection(FRONTEND_ORIGIN)` on every
          // mutation. In production the apps will share a domain (or
          // sit behind a reverse proxy that pins the right Origin), so
          // the gate works naturally. In LOCAL DEV the browser sends
          // `Origin: http://localhost:5174` and the SaaS expects
          // `http://localhost:3000`. We rewrite the Origin and Referer
          // headers ONLY at the proxy boundary; the browser still sees
          // its real origin, so cookie SameSite + the browser's own CORS
          // policy continue to defend against cross-site CSRF.
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("origin", saasOrigin);
              if (proxyReq.getHeader("referer")) {
                proxyReq.setHeader("referer", saasOrigin + "/");
              }
            });
          },
        },
      },
    },
    preview: {
      port: 5174,
      strictPort: true,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      // The Console is a small bundle; raise the warning so we don't
      // get noise from the bundled Cloud Design CSS.
      chunkSizeWarningLimit: 1024,
    },
  };
});
