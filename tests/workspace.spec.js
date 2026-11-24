import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
test("blank to edited and restored solid; actual exports and native reopen", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#bodycount")).toHaveText("0 bodies");
  await expect(page.locator("#stage canvas")).toBeVisible();
  await page.screenshot({ path: info.outputPath("blank.png") });
  const run = async (cmd) => {
    await page.locator("#command").fill(cmd);
    await page.locator("#apply").click();
    await expect(page.locator("#feedback")).not.toContainText(
      "Building geometry",
      { timeout: 60000 },
    );
  };
  await run(
    "Make a box that is 100 millimeters wide, 60 millimeters deep and 30 millimeters tall.",
  );
  await expect(page.locator("#bodycount")).toHaveText("1 body");
  await run("Round the corners");
  await page.getByRole("button", { name: "2 mm", exact: true }).click();
  await expect(page.locator("#feedback")).toContainText("Box ·");
  await run("Make it 10 millimeters taller");
  await expect(page.locator("#feedback")).toContainText("40 mm");
  await run("Add a 4 mm hole in each corner");
  await expect(page.locator("#feedback")).toContainText("Box ·");
  await page.locator("#undo").click();
  await expect(page.locator("#feedback")).toContainText("Undid");
  await page.locator("#redo").click();
  await expect(page.locator("#feedback")).toContainText("Restored");
  await page.reload();
  await expect(page.locator("#bodycount")).toHaveText("1 body");
  await page.screenshot({ path: info.outputPath("edited.png") });
  for (const [type, label] of [
    ["step", "STEP · Fusion solid"],
    ["stl", "STL · Triangle mesh"],
    ["3mf", "3MF · 3D printing"],
  ]) {
    await page.locator("#export").click();
    const done = page.waitForEvent("download");
    await page.getByRole("button", { name: label }).click();
    const dl = await done;
    const path = info.outputPath("part." + type);
    await dl.saveAs(path);
    const raw = await fs.readFile(path);
    if (type === "step") expect(raw.toString()).toMatch(/MANIFOLD_SOLID_BREP/);
    if (type === "stl") expect(raw.length).toBe(84 + 50 * raw.readUInt32LE(80));
    if (type === "3mf")
      expect(strFromU8(unzipSync(raw)["3D/3dmodel.model"])).toMatch(
        /<triangle v1=/,
      );
  }
  const done = page.waitForEvent("download");
  await page.locator("#save").click();
  const dl = await done;
  const file = info.outputPath("test.evercad");
  await dl.saveAs(file);
  await page.locator("#new").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#bodycount")).toHaveText("0 bodies");
  await page.locator("#upload").setInputFiles(file);
  await expect(page.locator("#bodycount")).toHaveText("1 body");
});
test("mobile, keyboard, settings and examples", async ({ page }, info) => {
  await page.goto("/");
  for (const width of [320, 375, 414, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator("#exampleslist button").first().click();
  await expect(page.locator("#command")).toBeFocused();
  await expect(page.locator("#bodycount")).toHaveText("0 bodies");
  await page.locator("#settings").click();
  await page.locator("#pref-theme").selectOption("Dark");
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: info.outputPath("mobile.png"),
    fullPage: true,
  });
  await page.locator("#paneltoggle").click();
  await expect(page.locator("#panel")).not.toBeVisible();
});
test("failed modeling preserves the last solid; STEP import preserves editable features", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.locator("#command").fill("make a 30 mm cube");
  await page.locator("#apply").click();
  await expect(page.locator("#bodycount")).toHaveText("1 body");
  await page.locator("#command").fill("round the corners by 300 mm");
  await page.locator("#apply").click();
  await expect(page.locator("#feedback")).toContainText("smaller");
  await expect(page.locator("#bodycount")).toHaveText("1 body");
  await page.locator("#export").click();
  const done = page.waitForEvent("download");
  await page.getByRole("button", { name: "STEP · Fusion solid" }).click();
  const f = info.outputPath("cube.step");
  await (await done).saveAs(f);
  await page.locator("#upload").setInputFiles(f);
  await expect(page.locator("#bodycount")).toHaveText("2 bodies", {
    timeout: 30000,
  });
  await page.locator("#command").fill("add a 3 mm hole");
  await page.locator("#apply").click();
  await expect(page.locator("#feedback")).toContainText(
    "30 mm × 30 mm × 30 mm",
  );
});
