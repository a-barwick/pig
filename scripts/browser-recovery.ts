import { chromium, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
const root = process.argv[2],
  projectPath = join(root, "project"),
  origin = "http://127.0.0.1:4319",
  out = "/tmp/pi-dashboard-browser";
let server: ChildProcess;
async function start() {
  server = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/test-server.ts", root],
    {
      env: { ...process.env, PORT: "4319" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await new Promise<void>((r, e) => {
    server.stdout!.on("data", (d) => {
      if (String(d).includes(origin)) r();
    });
    server.once("exit", (code) => e(Error(`server exit ${code}`)));
  });
}
async function stop() {
  const closed = new Promise<void>((r) => server.once("exit", () => r()));
  server.kill("SIGTERM");
  await closed;
}
await start();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const extension = join(projectPath, ".pi/extensions/browser-dialog.ts");
try {
  await page.goto(origin);
  await expect(page.getByText("connected", { exact: true })).toBeVisible();
  await page
    .getByLabel("Local project path")
    .fill("/this/project/does/not/exist");
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.screenshot({ path: out + "/error.png" });
  if (await page.getByLabel("Dismiss error").isVisible())
    await page.getByLabel("Dismiss error").click();
  console.log("error state checked");
  await page.getByLabel("Local project path").fill(projectPath);
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await expect(page.locator(".page-title .chip")).toHaveText("idle");
  await page.getByRole("button", { name: /Use bash twice/ }).click();
  await expect(page.locator(".transcript")).toContainText(
    "PI_EXPECTED_FAILURE",
  );
  const tool = page
    .locator(".transcript details.trace")
    .filter({ has: page.locator("summary strong", { hasText: "bash" }) })
    .first();
  await tool.locator("summary").click();
  await tool.getByRole("button", { name: "Inspect tool definition" }).click();
  await expect(page.locator("#tool-bash")).toHaveAttribute("open", "");
  await page.screenshot({ path: out + "/tools-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 760, height: 900 });
  await page.screenshot({ path: out + "/tools-half.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    760,
  );
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await page.getByRole("button", { name: /^browser-smoke/ }).click();
  await expect(page.getByLabel("SKILL.md", { exact: true })).toBeVisible();
  await page.screenshot({ path: out + "/editor-half.png", fullPage: true });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: /^Default thinking/ }),
  ).toBeVisible();
  await page.screenshot({ path: out + "/settings-half.png", fullPage: true });
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await stop();
  await expect(
    page.getByRole("button", { name: "Reconnect", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: out + "/disconnected.png", fullPage: true });
  await start();
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(page.getByText("connected", { exact: true })).toBeVisible();
  // Open and resume the same persisted real conversation after an actual process restart.
  await page.getByLabel("Local project path").fill(projectPath);
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await expect(page.locator(".page-title .chip")).toHaveText("idle");
  await page.getByRole("button", { name: /Use bash twice/ }).click();
  await expect(page.locator(".transcript")).toContainText(
    "PI_EXPECTED_FAILURE",
  );
  await expect(page.locator(".page-title .chip")).toHaveText("idle");

  await page
    .getByLabel("Message to pi")
    .fill(
      "For the browser cancellation test, call bash sleep 30 now. Do not use other tools.",
    );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.locator(".transcript .trace .chip").filter({ hasText: "running" }),
  ).toBeVisible({ timeout: 90000 });
  await page.screenshot({ path: out + "/streaming-half.png", fullPage: true });
  await page
    .getByLabel("Message to pi")
    .fill(
      "After this finishes say BROWSER_STEER and do not run another sleep.",
    );
  await page.getByRole("button", { name: "Steer", exact: true }).click();
  await expect(page.locator(".live-note")).toContainText(
    "Steering message accepted",
  );
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.locator(".page-title .chip")).toHaveText("idle", {
    timeout: 30000,
  });
  console.log("PASS browser streaming, steer and stop");
  await mkdir(join(projectPath, ".pi/extensions"), { recursive: true });
  await writeFile(
    extension,
    "export default function(pi){pi.on('session_start',async(_e,ctx)=>{await ctx.ui.input('Browser dialog acceptance','Type a response');});}",
  );
  await page.getByRole("button", { name: "＋ New conversation" }).click();
  await expect(
    page.getByRole("heading", { name: "Browser dialog acceptance" }),
  ).toBeVisible();
  await page.screenshot({ path: out + "/dialog-half.png", fullPage: true });
  await page.getByLabel("Response", { exact: true }).fill("Browser response");
  await page.getByRole("button", { name: "Submit response" }).click();
  await expect(page.locator(".page-title .chip")).toHaveText("idle");
  console.log(
    JSON.stringify({
      pass: "real tool inspection, error, responsive editor/settings, disconnect/reconnect, process restart/resume, real extension dialog",
      errors,
    }),
  );
} catch (e) {
  await page.screenshot({
    path: out + "/recovery-failure.png",
    fullPage: true,
  });
  console.log("FAILURE", String(e));
  throw e;
} finally {
  await unlink(extension).catch(() => {});
  await browser.close();
  await stop();
}
