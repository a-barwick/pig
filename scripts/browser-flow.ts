import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
const root = process.argv[2];
const projectPath = join(root, "project");
const out = "/tmp/pi-dashboard-browser";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4318");
  await expect(page.getByText("connected", { exact: true })).toBeVisible();
  await page.getByLabel("Local project path").fill(projectPath);
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await expect(page.getByLabel("Message to pi")).toBeVisible();
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await page.getByRole("button", { name: "New project skill" }).click();
  await page.getByLabel("Name", { exact: true }).fill("browser-smoke");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Explicit browser acceptance test.");
  await page
    .getByLabel("Instructions", { exact: true })
    .fill("Reply with BROWSER_SKILL_OK.");
  await expect(
    page.getByText("Unsaved draft", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review actual diff" }).click();
  await expect(page.getByLabel("Skill diff")).toContainText("BROWSER_SKILL_OK");
  await page.screenshot({ path: out + "/draft-desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Save revision", exact: true })
    .click();
  await expect(
    page.getByText("Saved to disk. Not applied to the current conversation."),
  ).toBeVisible();
  const editor = page.getByLabel("SKILL.md", { exact: true });
  const original = await editor.inputValue();
  await editor.fill(
    original.replace("BROWSER_SKILL_OK", "BROWSER_REVISION_OK"),
  );
  await writeFile(
    join(projectPath, ".pi/skills/browser-smoke/SKILL.md"),
    original + "\nExternal browser conflict\n",
  );
  await page.getByRole("button", { name: "Review actual diff" }).click();
  await page
    .getByRole("button", { name: "Save revision", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("changed outside");
  await expect(editor).toHaveValue(
    original.replace("BROWSER_SKILL_OK", "BROWSER_REVISION_OK"),
  );
  await page.screenshot({ path: out + "/conflict.png", fullPage: true });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reload saved files" }).click();
  await expect(editor).toHaveValue(/External browser conflict/);
  await editor.fill(
    (await editor.inputValue()).replace(
      "BROWSER_SKILL_OK",
      "BROWSER_REVISION_OK",
    ),
  );
  await page.getByRole("button", { name: "Review actual diff" }).click();
  await page
    .getByRole("button", { name: "Save revision", exact: true })
    .click();
  await expect(
    page.getByText("Saved to disk. Not applied to the current conversation."),
  ).toBeVisible();
  await page.getByLabel("Trial prompt").fill("Follow this saved skill now.");
  await page.getByRole("button", { name: "Start fresh trial" }).click();
  await expect(page.locator(".transcript")).toContainText(
    "BROWSER_REVISION_OK",
    { timeout: 120000 },
  );
  await expect(page.locator(".page-title .chip")).toHaveText("idle", {
    timeout: 120000,
  });
  await page.screenshot({ path: out + "/trial-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 760, height: 900 });
  await page.screenshot({ path: out + "/trial-half.png", fullPage: true });
  console.log(
    JSON.stringify({
      errors,
      scrollWidth: await page.evaluate(
        () => document.documentElement.scrollWidth,
      ),
      text: (await page.locator("body").innerText()).slice(-5500),
    }),
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: /^Default thinking/ }),
  ).toBeVisible();
  await page.screenshot({ path: out + "/settings-half.png", fullPage: true });
  console.log(
    "PASS browser creation, diff, saved revision, outside-edit draft preservation, trial and responsive settings",
  );
} catch (e) {
  await page.screenshot({ path: out + "/failure.png", fullPage: true });
  console.log((await page.locator("body").innerText()).slice(-4500));
  throw e;
} finally {
  await browser.close();
}
