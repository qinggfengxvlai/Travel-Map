import { test, expect } from "@playwright/test";

function failOnBrowserErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.log(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(message.text());
      console.log(`console.error: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    const resourceType = response.request().resourceType();
    if (response.status() >= 400 && ["document", "script", "stylesheet", "xhr", "fetch"].includes(resourceType)) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  return () => expect(errors, errors.join("\n")).toEqual([]);
}

async function addRoutePlace(page, query) {
  await page.locator("#citySearch").fill(query);
  const result = page.locator(".search-result.city").first();
  await expect(result).toBeVisible();
  await result.click();
}

test("map becomes usable before optional summaries finish", async ({ page }) => {
  const assertNoBrowserErrors = failOnBrowserErrors(page);
  let releaseDeferred;
  const gate = new Promise((resolve) => { releaseDeferred = resolve; });

  await page.route(/(counties-summary|wechat-food-summary)\.json/, async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "map");
  await expect(page.locator("#travelMap .leaflet-overlay-pane canvas")).toBeVisible();
  await expect(page.locator("#cityCount")).toHaveText("371");
  await expect(page.locator("#citySearch")).toBeEnabled();

  releaseDeferred();
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "complete");
  assertNoBrowserErrors();
});

test("route planning editing and every import/export path remain available", async ({ page }) => {
  const assertNoBrowserErrors = failOnBrowserErrors(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", /map|complete/);

  await addRoutePlace(page, "北京");
  await addRoutePlace(page, "上海");
  await expect(page.locator("#routeCount")).toHaveText("1");

  await page.locator("#tripNameInput").fill("性能回归行程");
  await page.locator("#tripNameInput").dispatchEvent("change");
  await page.locator('[data-pace="relaxed"]').click();
  await expect(page.locator('[data-pace="relaxed"]')).toHaveClass(/active/);

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.locator("#exportTripFileBtn").click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  await page.locator("#tripImportInput").setInputFiles(jsonPath);
  await expect(page.locator("#routeCount")).toHaveText("1");

  for (const selector of ["#exportMarkdownBtn", "#exportHtmlBtn"]) {
    const downloadPromise = page.waitForEvent("download");
    await page.locator(selector).click();
    const download = await downloadPromise;
    expect(await download.createReadStream()).toBeTruthy();
  }

  await page.locator("#undoBtn").click();
  await expect(page.locator("#routeCount")).toHaveText("0");
  assertNoBrowserErrors();
});

test("deferred county food and city detail features hydrate completely", async ({ page }) => {
  const assertNoBrowserErrors = failOnBrowserErrors(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "complete");

  await page.locator("#citySearch").fill("福清");
  const county = page.locator(".search-result.county").first();
  await expect(county).toBeVisible();
  await county.click();
  await expect(page.locator("#exitCityViewBtn")).toBeVisible();
  await expect(page.locator("#foodArticleList .food-card").first()).toBeVisible();
  await expect(page.locator("#travelMap .leaflet-overlay-pane canvas")).toBeVisible();

  await page.locator("#exitCityViewBtn").click();
  await expect(page.locator("#exitCityViewBtn")).toBeHidden();
  assertNoBrowserErrors();
});
