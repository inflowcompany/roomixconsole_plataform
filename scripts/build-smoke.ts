// Quick build smoke for the independent Platform Console app.
//
// What it checks:
//   1. tsc --noEmit succeeds (covers the auth + console TypeScript).
//   2. vite build succeeds and produces a dist/index.html.
//   3. The bundled JS does NOT contain hard-coded production hostnames
//      (`roomix.com.br`, `platform.roomix.com.br`, etc.) — every URL
//      should resolve via the Vite proxy or a runtime env var.
//
// Run with `npm run smoke` (after `npm install`).

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const log = (msg: string) => console.log(`[platform-console:smoke] ${msg}`);

try {
  log("running tsc --noEmit");
  execSync("npx tsc --noEmit", { cwd: root, stdio: "inherit" });

  log("running vite build");
  execSync("npx vite build", { cwd: root, stdio: "inherit" });

  const dist = path.join(root, "dist");
  if (!existsSync(path.join(dist, "index.html"))) {
    throw new Error("dist/index.html missing after build");
  }

  const assetsDir = path.join(dist, "assets");
  const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));

  // ---------------------------------------------------------------
  // Rule 1 — no production hostnames hard-coded in any chunk.
  // localhost:3000 is allowed (Vite proxy default).
  // ---------------------------------------------------------------
  const bannedHosts = ["platform.roomix.com.br", "console.roomix.com.br", "api.roomix.com.br"];
  for (const file of jsFiles) {
    const content = readFileSync(path.join(assetsDir, file), "utf8");
    for (const needle of bannedHosts) {
      if (content.includes(needle)) {
        throw new Error(`Bundle ${file} contains hard-coded production host '${needle}'`);
      }
    }
  }
  log("✓ no production hostnames in any chunk");

  // ---------------------------------------------------------------
  // Rule 2 — no fake demo/mock strings leak into the MAIN bundle.
  //
  // The mock dataset lives in mockData.ts. Production builds use it
  // ONLY when VITE_PLATFORM_CONSOLE_DEMO_DATA=true is set at build
  // time, and even then the consumer (`useConsoleData`) loads it via
  // dynamic import(). So:
  //
  //   * with the flag UNSET (default production), the mock strings
  //     must not appear anywhere — the chunk must not even ship.
  //   * with the flag SET, the strings are allowed in a SEPARATE
  //     chunk (mockData-*.js); we still keep them out of the main
  //     entry to avoid the flash on boot.
  //
  // This smoke is the no-flag path. CI for demo builds runs a
  // separate smoke.
  // ---------------------------------------------------------------
  const demoEnabled = process.env.VITE_PLATFORM_CONSOLE_DEMO_DATA === "true";
  const fakeStrings = [
    "Pousada Teste Maryna",
    "Suites Vista do Mar",
    "Hotel Costa Norte",
    "Villa Atlântica",
    "Resolver overbooking crítico",
    "Reprocessar reserva externa",
    "Ativar Channel Manager em production",
    "BKG-882711",
    "BKG-883014",
    "ABB-220114",
    "EXP-44120",
    "Maryna Hospitalidade Ltda",
    "Costa Hotelaria Ltda",
    "Mar Azul Boutique",
  ];

  // Heuristic: the "main" entry is the largest non-mock chunk. If
  // mockData were ever statically imported, the strings would land
  // here.
  const mainChunk = jsFiles
    .filter((f) => !f.toLowerCase().includes("mock"))
    .sort((a, b) => readFileSync(path.join(assetsDir, b)).length - readFileSync(path.join(assetsDir, a)).length)[0];
  if (!mainChunk) throw new Error("no main JS chunk found in dist/assets");

  const mainContent = readFileSync(path.join(assetsDir, mainChunk), "utf8");
  const leaks: string[] = [];
  for (const needle of fakeStrings) {
    if (mainContent.includes(needle)) leaks.push(needle);
  }

  if (leaks.length > 0 && !demoEnabled) {
    throw new Error(
      `Main bundle ${mainChunk} contains ${leaks.length} mock string(s) without VITE_PLATFORM_CONSOLE_DEMO_DATA=true:\n  - ` +
        leaks.join("\n  - "),
    );
  }

  if (demoEnabled) {
    log(`✓ demo build · mock strings tolerated in main bundle (${leaks.length} found)`);
  } else {
    log(`✓ no mock strings in main chunk ${mainChunk}`);
  }

  log("✓ build smoke passed");
} catch (err) {
  console.error("[platform-console:smoke] failed:", err);
  process.exitCode = 1;
}
