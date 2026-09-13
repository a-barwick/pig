import { chromium, expect, type Page } from "@playwright/test";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { startBuiltServer, type StartedServer } from "./helpers/server";
const rootArg = process.argv[2];
if (!rootArg)
  throw new Error("Usage: pnpm exec tsx scripts/browser-recovery.ts <root>");
const root = rootArg,
  projectPath = join(root, "project"),
  port = Number(process.env.PORT ?? 4319),
  origin = `http://127.0.0.1:${port}`,
  out = process.env.PI_DASHBOARD_BROWSER_OUT ?? "/tmp/pi-dashboard-browser";
await mkdir(out, { recursive: true });
let server: StartedServer;
async function start() {
  server = await startBuiltServer({
    root,
    port,
    useExistingAuth: true,
    timeoutMs: 90_000,
  });
}
async function stop() {
  await server.stop();
}
await start();
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let page: Page | undefined;
const errors: string[] = [];
const extension = join(projectPath, ".pi/extensions/browser-dialog.ts");
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId:'Pacific/Auckland' });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on('console', message => { if (/hydration_/i.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(path => localStorage.setItem('pi.recentProjects', JSON.stringify([path])), projectPath);
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
  // Make recovery runnable on a fresh isolated root as well as after the
  // creation flow. The latter leaves the existing revision untouched.
  const skillsLoaded = page.waitForResponse(response => response.url().includes('/trpc/skills') && response.ok());
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await skillsLoaded;
  await expect(page.getByRole('button',{name:'New project skill'})).toBeEnabled();
  if ((await page.getByRole("button", { name: /^browser-smoke/ }).count()) === 0) {
    await page.getByRole("button", { name: "New project skill" }).click();
    await page.getByLabel("Name", { exact: true }).fill("browser-smoke");
    await page
      .getByLabel("Description", { exact: true })
      .fill("Explicit browser recovery test.");
    await page
      .getByLabel("Instructions", { exact: true })
      .fill("Reply with BROWSER_RECOVERY_SKILL_OK.");
    await page.getByRole("button", { name: "Review actual diff" }).click();
    await page.getByRole("button", { name: "Save revision", exact: true }).click();
    await expect(
      page.getByText("Saved to disk. Not applied to the current conversation."),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  const savedTools = page.getByRole("button", { name: /Use bash twice/ });
  if (await savedTools.count()) await savedTools.first().click();
  else {
    await page.getByLabel('Message to pi').fill('Use bash twice: first run printf PI_TOOL_OK; then run a separate bash command that prints PI_EXPECTED_FAILURE to stderr and exits 7. Report their results briefly. Do not modify files.');
    await page.getByRole('button', {name:'Send',exact:true}).click();
  }
  await expect(page.locator('.page-title .chip')).toHaveText('idle',{timeout:120000});
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
  const beforeRefresh = (await (await page.request.get(origin + '/trpc/state')).json()).result.data;
  const serverHtml = await (await page.request.get(origin)).text();
  expect(serverHtml).toContain('PI_TOOL_OK');
  await page.reload();
  await expect(page.getByText('connected',{exact:true})).toBeVisible();
  const afterRefresh = (await (await page.request.get(origin + '/trpc/state')).json()).result.data;
  expect(afterRefresh.sessionId).toBe(beforeRefresh.sessionId);
  expect(afterRefresh.messages).toEqual(beforeRefresh.messages);
  await expect(page.locator('.session-list time').first()).toBeVisible();
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
  await page.getByRole('button',{name:'Skills',exact:true}).click();
  await page.getByRole('button',{name:/^browser-smoke/}).click();
  const recoveryEditor = page.getByLabel('SKILL.md',{exact:true});
  const savedEditorText = await recoveryEditor.inputValue();
  const workbenchDraft = savedEditorText + '\nUnsaved migration workbench draft\n';
  await recoveryEditor.fill(workbenchDraft);
  await page.getByLabel('Message to pi').fill('Unsent migration recovery draft');
  await stop();
  await expect(
    page.getByRole("button", { name: "Reconnect", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: out + "/disconnected.png", fullPage: true });
  await start();
  await page.getByRole("button", { name: "Reconnect", exact: true }).click();
  await expect(page.getByText("connected", { exact: true })).toBeVisible();
  await expect(page.getByLabel('Message to pi')).toHaveValue('Unsent migration recovery draft');
  await expect(recoveryEditor).toHaveValue(workbenchDraft);
  await expect(page.getByRole('button',{name:'Send',exact:true})).toBeDisabled();
  await page.getByLabel('Message to pi').fill('');
  await recoveryEditor.fill(savedEditorText);
  await page.getByRole('button',{name:'Conversation',exact:true}).click();
  // Open and resume the same persisted real conversation after an actual process restart.
  await page.getByLabel("Local project path").fill(projectPath);
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await expect(page.locator(".page-title .chip")).toHaveText("idle");
  await page.getByRole("button", { name: /Use bash twice/ }).first().click();
  await expect(page.locator(".transcript")).toContainText(
    "PI_EXPECTED_FAILURE",
  );
  await expect(page.locator(".page-title .chip")).toHaveText("idle");
  expect(errors).toEqual([]);

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
  await page.getByLabel('Message to pi').fill('For the shutdown test, call bash sleep 30 now. Do not use other tools.');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('.transcript .trace .chip').filter({hasText:'running'})).toBeVisible({timeout:90000});
  const stoppingAt = Date.now();
  await stop();
  expect(Date.now() - stoppingAt).toBeLessThan(8000);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      pass: "real tool inspection, error, responsive editor/settings, disconnect/reconnect, process restart/resume, real extension dialog",
      errors,
      shutdownDuringTool: true,
    }),
  );
} catch (e) {
  if (page)
    await page.screenshot({
      path: out + "/recovery-failure.png",
      fullPage: true,
    });
  console.log("FAILURE", String(e));
  throw e;
} finally {
  await unlink(extension).catch(() => {});
  await browser?.close();
  await stop();
}
