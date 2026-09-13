import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { startBuiltServer, type StartedServer } from "./helpers/server";

const out = process.env.PI_DASHBOARD_BROWSER_OUT ?? "/tmp/pi-dashboard-browser";
await mkdir(out, { recursive: true });

// By default this script starts the actual adapter-node build. Set an origin
// (or PI_DASHBOARD_NO_SERVER=1) when inspecting an already-running process.
const requestedOrigin = process.env.PI_DASHBOARD_ORIGIN;
const external = process.env.PI_DASHBOARD_NO_SERVER === "1" || !!requestedOrigin;
let server: StartedServer | undefined;
if (!external)
  server = await startBuiltServer({
    root: process.argv[2],
    port: Number(process.env.PORT ?? 4317),
    useExistingAuth: true,
  });
const origin =
  requestedOrigin ?? server?.origin ?? `http://127.0.0.1:${process.env.PORT ?? 4317}`;

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });
  const desktopText = (await page.locator("body").innerText()).slice(0, 6500);
  await page.setViewportSize({ width: 760, height: 900 });
  await page.screenshot({ path: `${out}/half.png`, fullPage: true });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  if (errors.length) throw new Error(`Browser JavaScript errors: ${errors.join("; ")}`);
  if (scrollWidth > 760)
    throw new Error(`Workspace overflows half-window width: ${scrollWidth}px`);
  console.log(
    JSON.stringify({
      pass: "SSR page, hydration, desktop and half-window shell",
      origin,
      errors,
      scrollWidth,
      text: desktopText,
    }),
  );
} finally {
  await browser?.close();
  await server?.stop();
}
