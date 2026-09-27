import { expect, type Page, test } from "@playwright/test";

import { signInAsFakeGoogleUser } from "../helpers/fakeGoogleSignIn";
import { installSuggestFixture } from "../helpers/suggestFixture";

/**
 * Spec 069 — pointer presses that Safari delivers without moving focus.
 *
 * WebKit never focuses a clicked button, so the field's `focusout` carries
 * `relatedTarget: null` before the click lands. Unless the press keeps focus
 * in the field (contracts §1), the search collapses first: the expanded bar's
 * Search button re-opens instead of submitting, and Retry unmounts under the
 * pointer. Listed in the `webkit` project's `testMatch` (playwright.config.ts)
 * — chromium focuses buttons on click and cannot see this.
 */

const SEARCH_INPUT = "input#header-search";
const PANEL = "[data-testid='header-search-panel']";
const BACKDROP = 'div[aria-hidden="true"].overlay-scrim';

async function openLibrarySignedIn(
  page: Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.route("**/api/library*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], page: 1, pageSize: 20, totalItems: 0 }),
    }),
  );
  await page.goto("/");
  await signInAsFakeGoogleUser(page);
  await page.goto("/app/library");
  await expect(
    page.getByRole("button", { name: "Search", exact: true }),
  ).toBeVisible();
}

test.describe("Header search — presses that do not move focus (spec 069, WebKit)", () => {
  test("tapping Search in the expanded phone bar submits the query (375px)", async ({
    page,
  }) => {
    await installSuggestFixture(page, "empty");
    await openLibrarySignedIn(page, { width: 375, height: 812 });

    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.locator(SEARCH_INPUT)).toBeFocused();
    await page.keyboard.type("miles", { delay: 40 });

    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page).toHaveURL("/app/search?q=miles");
    await expect(page.locator(BACKDROP)).toHaveCount(0);
  });

  test("clicking Retry on a failed lookup re-issues it (1440px)", async ({
    page,
  }) => {
    const suggest = await installSuggestFixture(page, "error");
    await openLibrarySignedIn(page, { width: 1440, height: 900 });

    await page.locator(SEARCH_INPUT).click();
    await page.keyboard.type("miles", { delay: 40 });
    const retry = page.locator(PANEL).getByRole("button", { name: "Retry" });
    await expect(retry).toBeVisible();
    suggest.queries.length = 0;

    await retry.click();

    await expect.poll(() => suggest.queries).toEqual(["miles"]);
    await expect(page.locator(BACKDROP)).toBeVisible();
  });
});
