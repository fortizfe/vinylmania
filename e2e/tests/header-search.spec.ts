import { expect, type Locator, type Page, test } from "@playwright/test";

import { signInAsFakeGoogleUser } from "../helpers/fakeGoogleSignIn";
import {
  installSuggestFixture,
  queriesShownIn,
  SUGGEST_DELAY_MS,
  TITLE_SEPARATOR,
} from "../helpers/suggestFixture";

/**
 * Spec 069 — User Story 1 (header search: activation, phone overlay,
 * non-modal behaviour, wide-layout stability, collapse paths).
 *
 * Written before the implementation (T009/T010), per Constitution
 * Principle I. Against today's header — a cramped `w-28` text field plus a
 * submit button at every width — these scenarios fail for the *functional*
 * reason they exist: there is no collapsed opener, no expansion, no
 * backdrop and no scroll lock.
 *
 * Sources: quickstart.md §3 items 1-4, contracts/header-search-ui.md §1-§3,
 * spec FR-001/FR-003/FR-005/FR-006/FR-007, SC-001/SC-008/SC-010,
 * clarification 3 (non-modal), tasks.md assumptions 1 and 2.
 *
 * User Story 2's suggestion scenarios (T020) follow at the bottom of this
 * file, against `helpers/suggestFixture.ts`. They are equally written before
 * their implementation (T026-T029) and fail today because no panel exists.
 */

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

/** The field keeps today's `id` (contracts §3 — the existing `Input`). */
const SEARCH_INPUT = "input#header-search";
/** The search form, today's `role="search"` (contracts §3). */
const SEARCH_FORM = '[role="search"]';
/**
 * The header-search backdrop: contracts §2/§3 — a `<div aria-hidden="true">`
 * carrying `.overlay-scrim`. `motion/Overlay`'s scrim also carries
 * `.overlay-scrim` but is *not* `aria-hidden` (it holds the dialog), so this
 * selector cannot collide with a modal/drawer/sheet scrim.
 */
const BACKDROP = 'div[aria-hidden="true"].overlay-scrim';

function libraryEntry(id: string, title: string) {
  return {
    id,
    discogsReleaseId: 1,
    addedAt: "2026-07-03T00:00:00.000Z",
    catalogStatus: "ok",
    release: {
      discogsId: 1,
      title,
      artists: [{ discogsArtistId: 1, name: "Test Artist" }],
      labels: [],
      formats: [],
      genres: [],
      styles: [],
      tracklist: [],
      images: [],
      discogsUrl: "https://www.discogs.com/release/1",
    },
  };
}

/** Enough rows that the page behind the overlay genuinely scrolls. */
async function mockLibrary(page: Page, count = 24) {
  await page.route("**/api/library*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: Array.from({ length: count }, (_, i) =>
          libraryEntry(`entry-${i + 1}`, `Album ${i + 1}`),
        ),
        page: 1,
        pageSize: count,
        totalItems: count,
      }),
    });
  });
}

async function mockSearchResults(page: Page) {
  await page.route("**/api/discogs/search*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            discogsId: 501,
            resultType: "release",
            title: "Stockholm",
            artist: "The Persuader",
            year: 1999,
          },
        ],
        pagination: { page: 1, pages: 1, items: 1, perPage: 20 },
      }),
    });
  });
}

/**
 * The control a collector interacts with to start searching (contracts §2):
 * below 640 px a collapsed icon button named "Search"; from 640 px up the
 * field itself, which expands on focus.
 */
function opener(page: Page, width: number): Locator {
  return width < 640
    ? page.getByRole("button", { name: "Search", exact: true })
    : page.locator(SEARCH_INPUT);
}

async function activateSearch(page: Page, width: number): Promise<void> {
  // Exactly one interaction — no second tap to place the cursor (SC-001).
  await opener(page, width).first().click();
}

/**
 * The same single interaction, driven as raw pointer events at the opener's
 * viewport coordinates. Only the phone-overlay scenario below needs it — the
 * only one that measures the page's scroll position across the activation.
 *
 * It cannot use `activateSearch`'s `locator.click()`: Playwright always runs
 * `scrollIntoViewIfNeeded` before dispatching a click (`force: true` does not
 * skip it), and Chromium resolves that against the element's *in-flow* layout
 * box, ignoring the offset `position: sticky` gives the header. So with the
 * page scrolled, reaching the opener scrolls the document back to the header's
 * in-flow position — the origin — *after* the scenario has measured
 * `mainBefore` and *before* the app handles the activation. The scroll lock
 * then captures 0 and the page's position is lost through no fault of the app.
 * Measured: `scrollIntoViewIfNeeded` on the opener takes `window.scrollY` from
 * 300 to 0, while raw pointer events leave it at 300, and with the header
 * forced to `position: fixed` it stays at 300 either way.
 *
 * Nothing is relaxed here — the assertions below are correct and the behaviour
 * is real (driven this way the page freezes behind the overlay and its scroll
 * position is restored on collapse, FR-005). Raw pointer events are a *closer*
 * match to a real finger than `.click()`, not a weaker one: the browser's full
 * input pipeline — hit-testing, focus, the click event — still runs; only the
 * harness's own scrolling is left out. Please don't "fix" this back to
 * `.click()`: that is exactly what turns this scenario red.
 */
async function tapOpener(page: Page, width: number): Promise<void> {
  const box = await opener(page, width).first().boundingBox();
  expect(box, "the search opener has no layout box to tap").not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

/** The backdrop is the one expanded-state signal shared by both widths. */
async function expectExpanded(page: Page): Promise<void> {
  await expect(page.locator(BACKDROP)).toBeVisible();
}

async function expectCollapsed(page: Page): Promise<void> {
  await expect(page.locator(BACKDROP)).toHaveCount(0);
}

async function activeElementIsSearchField(page: Page): Promise<boolean> {
  return page.evaluate(() => document.activeElement?.id === "header-search");
}

test.describe("Header search — entry point at every width (spec 069 US1, SC-001, FR-003)", () => {
  for (const viewport of [PHONE, DESKTOP]) {
    test(`one interaction reaches a focused field from /app, /app/library and /app/search at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await mockLibrary(page);
      await mockSearchResults(page);
      await page.goto("/");
      await signInAsFakeGoogleUser(page);

      for (const path of ["/app", "/app/library", "/app/search?q=stockholm"]) {
        await page.goto(path);
        await expect(page.getByRole("main")).toBeVisible();

        // Below 640 px the entry point is the collapsed icon button, which
        // must advertise its collapsed state before it is activated
        // (contracts §3, assumption 1).
        if (viewport.width < 640) {
          await expect(opener(page, viewport.width).first()).toHaveAttribute(
            "aria-expanded",
            "false",
          );
        }

        await activateSearch(page, viewport.width);

        await expect
          .poll(
            () => activeElementIsSearchField(page),
            `${path} @ ${viewport.width}px: one interaction must land DOM focus in the search field`,
          )
          .toBe(true);

        // Reset for the next screen.
        await page.keyboard.press("Escape");
        await expectCollapsed(page);
      }
    });
  }
});

test.describe("Header search — phone overlay (spec 069 US1, FR-005, SC-010)", () => {
  test("is a full-width overlay with no horizontal scroll, 44x44 targets, and the page behind frozen then restored", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await mockLibrary(page);
    await page.goto("/");
    await signInAsFakeGoogleUser(page);
    await page.goto("/app/library");
    await expect(page.getByText("Album 1", { exact: true })).toBeVisible();

    // Assumption 1: the collapsed control is a >= 44x44 button named "Search",
    // not a text field.
    const collapsed = opener(page, PHONE.width).first();
    await expect(collapsed).toBeVisible();
    await expect(collapsed).toHaveAttribute("aria-expanded", "false");
    const collapsedBox = await collapsed.boundingBox();
    expect(
      collapsedBox?.width,
      "collapsed search control width",
    ).toBeGreaterThanOrEqual(44);
    expect(
      collapsedBox?.height,
      "collapsed search control height",
    ).toBeGreaterThanOrEqual(44);
    await expect(page.locator(SEARCH_INPUT)).toBeHidden();

    // Scroll the page behind, and remember where its content sits.
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBe(300);
    const mainBefore = await page.getByRole("main").boundingBox();

    // Raw pointer events, not `activateSearch` — see `tapOpener`: a
    // `locator.click()` here would scroll the page back to the origin before
    // the app ever sees the activation, destroying what this scenario measures.
    await tapOpener(page, PHONE.width);
    await expectExpanded(page);

    // Full-width overlay, pinned below the header.
    const header = await page.locator("header").boundingBox();
    const form = await page.locator(SEARCH_FORM).boundingBox();
    expect(form, "expanded search form box").not.toBeNull();
    expect(
      form!.width,
      "the expanded search is not full width",
    ).toBeGreaterThanOrEqual(PHONE.width * 0.9);
    expect(form!.width).toBeLessThanOrEqual(PHONE.width);
    expect(
      form!.y,
      "the overlay is not pinned below the header",
    ).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1);

    // No horizontal page scroll (FR-005).
    const scrollWidth = await page.evaluate(() =>
      Math.round(document.scrollingElement?.scrollWidth ?? 0),
    );
    expect(
      scrollWidth,
      "the overlay introduced horizontal page scrolling",
    ).toBe(PHONE.width);

    // Every interactive control inside the search is >= 44x44 (SC-010).
    const interactive = page
      .locator(SEARCH_FORM)
      .locator('a, button, input, select, textarea, [role="option"]');
    const count = await interactive.count();
    expect(
      count,
      "the expanded search exposed no interactive controls",
    ).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const target = interactive.nth(i);
      if (!(await target.isVisible())) continue;
      const box = await target.boundingBox();
      const label =
        (await target.getAttribute("aria-label")) ??
        (await target.getAttribute("id"));
      expect(
        box?.width,
        `touch target width of ${label ?? `control ${i}`}`,
      ).toBeGreaterThanOrEqual(44);
      expect(
        box?.height,
        `touch target height of ${label ?? `control ${i}`}`,
      ).toBeGreaterThanOrEqual(44);
    }

    // The page behind does not move while the overlay is open. Asserted on
    // the rendered position of `<main>` rather than `window.scrollY`, because
    // a `position: fixed` scroll lock legitimately zeroes the latter.
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(200);
    const mainDuring = await page.getByRole("main").boundingBox();
    expect(
      mainDuring?.y,
      "the page scrolled behind the open overlay",
    ).toBeCloseTo(mainBefore?.y ?? 0, 0);

    // Collapsing restores the scroll position (spec edge case).
    await page.keyboard.press("Escape");
    await expectCollapsed(page);
    await expect
      .poll(
        () => page.evaluate(() => Math.round(window.scrollY)),
        "the scroll position was not restored on collapse",
      )
      .toBe(300);
  });
});

test.describe("Header search — non-modal (spec 069 US1, clarification 3)", () => {
  test("exposes no dialog, keeps <main> in the accessibility tree, and lets Tab leave (collapsing it)", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await mockLibrary(page);
    await page.goto("/");
    await signInAsFakeGoogleUser(page);
    await page.goto("/app/library");
    await expect(page.getByText("Album 1", { exact: true })).toBeVisible();

    await activateSearch(page, PHONE.width);
    await expectExpanded(page);

    // No modality: no `role="dialog"`, no `aria-modal` anywhere.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("[aria-modal]")).toHaveCount(0);

    // The rest of the page stays reachable by assistive technology:
    // `getByRole` resolves against the accessibility tree, so an
    // `aria-hidden`/`inert` page behind would drop this to 0.
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.locator("main")).not.toHaveAttribute("inert", /.*/);

    // No focus trap: tabbing off the end of the search leaves it.
    let escaped = false;
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        (selector) => Boolean(document.activeElement?.closest(selector)),
        SEARCH_FORM,
      );
      if (!inside) {
        escaped = true;
        break;
      }
    }
    expect(
      escaped,
      "Tab cycled inside the search — focus is trapped (clarification 3)",
    ).toBe(true);

    // Focus leaving the search collapses it (FR-007).
    await expectCollapsed(page);
  });
});

test.describe("Header search — wide layout stability (spec 069 US1, FR-006, SC-008)", () => {
  // `layout-shift` is a Chromium-only PerformanceObserver entry type. The
  // whole assertion is skipped elsewhere so it can never fail for the wrong
  // reason (an unsupported entry type rather than a moving layout).
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    'PerformanceObserver type "layout-shift" is Chromium-only',
  );

  test("expanding at 1440px moves nothing below the header and reports no layout shift", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await mockLibrary(page);
    await page.goto("/");
    await signInAsFakeGoogleUser(page);
    await page.goto("/app/library");
    await expect(page.getByText("Album 1", { exact: true })).toBeVisible();

    await page.evaluate(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number;
        })[]) {
          // Every entry counts, including ones flagged `hadRecentInput`:
          // the expansion is user-initiated by definition, so filtering
          // those out would make this assertion vacuous.
          w.__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.waitForTimeout(200);
    const readCls = () =>
      page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    const clsBefore = await readCls();

    const main = page.getByRole("main");
    const before = await main.boundingBox();

    await activateSearch(page, DESKTOP.width);
    await expectExpanded(page);

    // Mid-animation (`spring.sheet` is ~0.35 s).
    await page.waitForTimeout(120);
    const during = await main.boundingBox();

    // Settled.
    await page.waitForTimeout(500);
    const after = await main.boundingBox();

    await page.keyboard.press("Escape");
    await expectCollapsed(page);
    await page.waitForTimeout(500);
    const collapsed = await main.boundingBox();

    for (const [label, box] of [
      ["during expansion", during],
      ["once expanded", after],
      ["after collapsing", collapsed],
    ] as const) {
      expect(box?.x, `<main> x ${label}`).toBeCloseTo(before?.x ?? 0, 0);
      expect(box?.y, `<main> y ${label}`).toBeCloseTo(before?.y ?? 0, 0);
      expect(box?.width, `<main> width ${label}`).toBeCloseTo(
        before?.width ?? 0,
        0,
      );
      expect(box?.height, `<main> height ${label}`).toBeCloseTo(
        before?.height ?? 0,
        0,
      );
    }

    const clsAfter = await readCls();
    // Not exactly 0: research D13 animates the form's `width`, so the input and
    // the button shift their start positions by a fraction of a pixel per frame
    // and the observer records entries (~0.0004 measured). SC-008 is about the
    // content *behind* the search, which the bounding-box assertions above pin
    // to the pixel; this budget bounds the header row's own micro-movement at
    // 250x under CLS's 0.1 "good" threshold — imperceptible, but still a
    // regression guard if the width animation ever starts moving real content.
    // Exact zero would need the transform-based animation D13 rejected, which
    // the `ponytail:` marker in HeaderSearchBox.tsx names as the upgrade path.
    expect(
      clsAfter - clsBefore,
      "opening and closing the header search caused a layout shift",
    ).toBeLessThan(0.01);
  });
});

test.describe("Header search — collapse paths (spec 069 US1, FR-007)", () => {
  for (const viewport of [PHONE, DESKTOP]) {
    /**
     * contracts/header-search-ui.md §1 is the binding table here: Escape
     * (panel closed) and a backdrop activation both collapse *and* restore
     * focus to the opener via `useRestoreFocus`; a `focusout` to a target
     * outside the container only collapses — restoring focus there would
     * fight the collector, who just moved focus somewhere on purpose.
     */
    test(`Escape collapses and restores focus to the opener at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await mockLibrary(page);
      await page.goto("/");
      await signInAsFakeGoogleUser(page);
      await page.goto("/app/library");
      await expect(page.getByText("Album 1", { exact: true })).toBeVisible();

      await activateSearch(page, viewport.width);
      await expectExpanded(page);

      await page.keyboard.press("Escape");
      await expectCollapsed(page);
      await expect(opener(page, viewport.width).first()).toBeFocused();
    });

    test(`a backdrop activation collapses and restores focus to the opener at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await mockLibrary(page);
      await page.goto("/");
      await signInAsFakeGoogleUser(page);
      await page.goto("/app/library");
      await expect(page.getByText("Album 1", { exact: true })).toBeVisible();

      await activateSearch(page, viewport.width);
      await expectExpanded(page);

      // Bottom of the scrim — clear of the header and of the expanded search.
      await page.locator(BACKDROP).click({
        position: { x: viewport.width / 2, y: viewport.height - 40 },
      });
      await expectCollapsed(page);
      await expect(opener(page, viewport.width).first()).toBeFocused();
    });

    test(`focus leaving the search collapses it at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await mockLibrary(page);
      await page.goto("/");
      await signInAsFakeGoogleUser(page);
      await page.goto("/app/library");
      await expect(page.getByText("Album 1", { exact: true })).toBeVisible();

      await activateSearch(page, viewport.width);
      await expectExpanded(page);

      // Move focus to a control that is unambiguously outside the search.
      await page.getByRole("link", { name: "Vinylmania" }).focus();
      await expectCollapsed(page);
      const stillInside = await page.evaluate(
        (selector) => Boolean(document.activeElement?.closest(selector)),
        SEARCH_FORM,
      );
      expect(
        stillInside,
        "collapsing on focus-out must not pull focus back into the search",
      ).toBe(false);
    });
  }
});

/* ------------------------------------------------------------------ *
 * User Story 2 — instant suggestions (T020).
 *
 * quickstart.md §3 items 5, 6, 8 and 9; spec FR-011 to FR-014, SC-002,
 * SC-004, SC-005, SC-008, SC-011; contracts/header-search-ui.md §3 and §6;
 * data-model.md §3 (artists first, then albums) and §5 (panel states).
 *
 * All of these run at 1440 px: the panel is the same component at both
 * widths and the phone overlay's own geometry is already covered above, so
 * repeating every scenario at 375 px would buy nothing but runtime (the
 * width matrix that *does* matter for the panel — the a11y and contrast one
 * — is T033's).
 * ------------------------------------------------------------------ */

/** contracts §3: the panel surface, and the rows inside its listbox. */
const PANEL = "[data-testid='header-search-panel']";
/** Real suggestion rows. The `role="option"` wiring arrives with T036. */
const ROWS = '#header-search-listbox > li:not([aria-hidden="true"])';
/** The 5 loading placeholders (contracts §3: `role="presentation"`). */
const SKELETON_ROWS = '#header-search-listbox > li[aria-hidden="true"]';

async function openLibrarySignedIn(
  page: Page,
  viewport = DESKTOP,
): Promise<void> {
  await page.setViewportSize(viewport);
  await mockLibrary(page);
  await page.goto("/");
  await signInAsFakeGoogleUser(page);
  await page.goto("/app/library");
  await expect(page.getByText("Album 1", { exact: true })).toBeVisible();
}

/**
 * Types into the already-focused field. `page.keyboard` rather than
 * `locator.pressSequentially`, which would re-run actionability (and its
 * scrolling) on every character.
 */
async function typeQuery(
  page: Page,
  text: string,
  delayMs: number,
): Promise<void> {
  await page.keyboard.type(text, { delay: delayMs });
}

/** The field's value and the panel's text, read in the same JavaScript turn. */
async function snapshot(
  page: Page,
): Promise<{ value: string; panelText: string }> {
  return page.evaluate(
    ([inputSelector, panelSelector]) => ({
      value:
        (document.querySelector(inputSelector) as HTMLInputElement | null)
          ?.value ?? "",
      panelText:
        (document.querySelector(panelSelector) as HTMLElement | null)
          ?.innerText ?? "",
    }),
    [SEARCH_INPUT, PANEL],
  );
}

test.describe("Header search — panel size stability (spec 069 US2, FR-014, SC-008)", () => {
  test("the panel is the same height while loading as it is once the suggestions land", async ({
    page,
  }) => {
    await installSuggestFixture(page, "delayed");
    await openLibrarySignedIn(page);

    await activateSearch(page, DESKTOP.width);
    await typeQuery(page, "iron ma", 40);

    // Loading: 5 skeleton rows and no options (data-model §5).
    await expect(page.locator(SKELETON_ROWS)).toHaveCount(5);
    await expect(page.locator(ROWS)).toHaveCount(0);
    const loading = await page.locator(PANEL).boundingBox();
    expect(loading, "the loading panel has no layout box").not.toBeNull();

    await expect(page.locator(ROWS)).toHaveCount(5, {
      timeout: SUGGEST_DELAY_MS + 5_000,
    });
    // The panel only ever fades (contracts §7 — it never animates size), so a
    // settle window here can only catch a violation, never manufacture one.
    await page.waitForTimeout(300);
    const loaded = await page.locator(PANEL).boundingBox();

    expect(
      loaded?.height,
      "the panel resized between loading and loaded",
    ).toBeCloseTo(loading?.height ?? 0, 0);
    expect(
      loaded?.width,
      "the panel changed width between loading and loaded",
    ).toBeCloseTo(loading?.width ?? 0, 0);
  });
});

test.describe("Header search — three interactions to a record (spec 069 US2, SC-002, FR-012)", () => {
  const QUERY = "iron ma";

  test("activate, type, choose an album suggestion opens that record", async ({
    page,
  }) => {
    await installSuggestFixture(page, "mixed");
    await openLibrarySignedIn(page);

    // 1 — activate.
    await activateSearch(page, DESKTOP.width);
    // 2 — type.
    await typeQuery(page, QUERY, 40);
    await expect(page.locator(ROWS)).toHaveCount(5);

    // 3 — choose. The kind label is visible text (FR-011), never colour
    // alone, so it is also how a collector picks an album row out.
    const album = page
      .locator(ROWS)
      .filter({ hasText: /\bAlbum\b/ })
      .first();
    await expect(album).toBeVisible();
    await album.click();

    // contracts §6: `master` → /app/masters/:id, `release` → /app/releases/:id.
    await expect(page).toHaveURL(/\/app\/(?:releases|masters)\/\d+$/);
    // Choosing also collapses the search.
    await expectCollapsed(page);
  });

  test("activate, type, choose an artist suggestion opens the full results for that name", async ({
    page,
  }) => {
    await installSuggestFixture(page, "mixed");
    await openLibrarySignedIn(page);

    await activateSearch(page, DESKTOP.width);
    await typeQuery(page, QUERY, 40);
    await expect(page.locator(ROWS)).toHaveCount(5);

    const artist = page
      .locator(ROWS)
      .filter({ hasText: /\bArtist\b/ })
      .first();
    await expect(artist).toBeVisible();
    await artist.click();

    // The app has no artist screen (FR-012): the destination is
    // `buildSearchPath(title)`, built here the way that helper builds it —
    // `URLSearchParams`, so the encoding cannot drift between the two.
    const expected = `${QUERY}${TITLE_SEPARATOR}Band 1`;
    await expect(page).toHaveURL(
      `/app/search?${new URLSearchParams({ q: expected }).toString()}`,
    );
    await expectCollapsed(page);
  });
});

test.describe("Header search — quota shape (spec 069 US2, SC-011, FR-011)", () => {
  test("an artists-only result set with 6 hits still fills the panel to 5", async ({
    page,
  }) => {
    await installSuggestFixture(page, "artists");
    await openLibrarySignedIn(page);

    await activateSearch(page, DESKTOP.width);
    await typeQuery(page, "iron ma", 40);

    const rows = page.locator(ROWS);
    await expect(
      rows,
      "one kind filling every slot must still reach 5 rows",
    ).toHaveCount(5);
    for (let i = 0; i < 5; i += 1) {
      await expect(rows.nth(i), `row ${i} kind label`).toHaveText(/\bArtist\b/);
      await expect(
        rows.nth(i),
        `row ${i} must not claim to be an album`,
      ).not.toHaveText(/\bAlbum\b/);
    }
  });

  test("a mixed result set shows 2 artists and then 3 albums, in that order", async ({
    page,
  }) => {
    await installSuggestFixture(page, "mixed");
    await openLibrarySignedIn(page);

    await activateSearch(page, DESKTOP.width);
    await typeQuery(page, "iron ma", 40);

    const rows = page.locator(ROWS);
    await expect(rows).toHaveCount(5);
    // data-model §3 step 4: artists first, albums after — the order is the
    // endpoint's, and the panel must not re-sort or group it.
    for (const [index, kind] of [
      "Artist",
      "Artist",
      "Album",
      "Album",
      "Album",
    ].entries()) {
      await expect(
        rows.nth(index),
        `row ${index} should be an ${kind}`,
      ).toHaveText(new RegExp(`\\b${kind}\\b`));
    }
  });
});

test.describe("Header search — lookup counting (spec 069 US2, SC-004, SC-005, FR-010, FR-013)", () => {
  test("typing a 10-character query at normal speed costs at most 3 lookups", async ({
    page,
  }) => {
    const suggest = await installSuggestFixture(page, "mixed");
    await openLibrarySignedIn(page);

    await activateSearch(page, DESKTOP.width);
    // ~110 ms between keystrokes is a brisk but ordinary typing speed, well
    // inside the 300 ms pause FR-010 debounces on.
    await typeQuery(page, "iron maide", 110);

    await expect(
      page.locator(ROWS),
      "the typed query produced no suggestions",
    ).toHaveCount(5);
    expect(
      suggest.queries.length,
      `typing 10 characters issued ${suggest.queries.length} lookups (SC-004 allows 3): ${suggest.queries.join(" | ")}`,
    ).toBeLessThanOrEqual(3);
    expect(
      suggest.queries.at(-1),
      "the last lookup must be for the whole typed query",
    ).toBe("iron maide");
  });

  test("a 20-keystroke type-and-delete run never shows rows for anything but the current text", async ({
    page,
  }) => {
    await installSuggestFixture(page, "mixed");
    await openLibrarySignedIn(page);

    await activateSearch(page, DESKTOP.width);

    // 11 characters typed, then 9 deleted: 20 keystrokes, ending on "ir".
    const stale: string[] = [];
    const checkCurrent = async () => {
      const { value, panelText } = await snapshot(page);
      for (const shown of queriesShownIn(panelText)) {
        if (shown !== value.trim())
          stale.push(`field "${value}" showed rows for "${shown}"`);
      }
    };

    for (const character of "iron maiden") {
      await page.keyboard.press(character === " " ? "Space" : character);
      await checkCurrent();
    }
    for (let i = 0; i < 9; i += 1) {
      await page.keyboard.press("Backspace");
      await checkCurrent();
    }

    // The run only proves something once the panel is actually rendering
    // rows: without this the loop above passes vacuously against an app that
    // has no panel at all.
    await expect(page.locator(ROWS)).toHaveCount(5);
    const settled = await snapshot(page);
    expect(
      settled.value,
      "the type-and-delete run did not end where it should",
    ).toBe("ir");
    expect(
      queriesShownIn(settled.panelText),
      "the settled rows belong to a superseded query",
    ).toEqual(Array(5).fill("ir"));

    expect(
      stale,
      `stale suggestion lists rendered during the run (SC-005 allows 0)`,
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * User Story 4 — empty and error states (T040).
 *
 * quickstart.md §3 item 10; spec FR-018, FR-019, FR-020, SC-009, US4
 * scenarios 1-3; contracts/header-search-ui.md §3 (empty and error sit in
 * the panel, outside the listbox; the error carries a "Retry" button and is
 * not `role="alert"`). The exact announcement strings are T041's, next door.
 *
 * Written before T042/T043, per Constitution Principle I. Against today's
 * panel these fail because it only knows `idle | loading | suggestions`: a
 * zero-result lookup renders an empty listbox that names nothing, and a
 * failed lookup renders no message and no Retry.
 * ------------------------------------------------------------------ */

test.describe("Header search — empty and error states (spec 069 US4, FR-018, FR-019, SC-009)", () => {
  const QUERY = "zzqx nothing";

  test("a query with zero matches shows an empty state naming the typed text", async ({
    page,
  }) => {
    await installSuggestFixture(page, "empty");
    await openLibrarySignedIn(page);

    await activateSearch(page, DESKTOP.width);
    await typeQuery(page, QUERY, 40);

    const panel = page.locator(PANEL);
    // FR-018 / edge case "No matches": the empty state, not an empty panel.
    // The fixture echoes nothing back for `empty`, so the only place the typed
    // text can come from is the empty state itself.
    await expect(
      panel,
      "the empty state must name the searched text (FR-018)",
    ).toContainText(QUERY);
    await expect(page.locator(ROWS)).toHaveCount(0);
    await expect(
      page.locator(SKELETON_ROWS),
      "the empty state is not a loading panel",
    ).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: "Retry" }),
      "nothing failed",
    ).toHaveCount(0);
  });

  test("a failed lookup shows the error with Retry, and Retry re-runs the same query exactly once", async ({
    page,
  }) => {
    const suggest = await installSuggestFixture(page, "error");
    await openLibrarySignedIn(page);

    await activateSearch(page, DESKTOP.width);
    await typeQuery(page, QUERY, 40);

    const panel = page.locator(PANEL);
    const retry = panel.getByRole("button", { name: "Retry" });
    await expect(
      retry,
      "the error state must offer an accessible Retry (FR-019)",
    ).toBeVisible();
    await expect(page.locator(ROWS)).toHaveCount(0);
    // FR-023: polite, never an interrupting alert (contracts §3).
    await expect(page.locator(`${PANEL} [role="alert"]`)).toHaveCount(0);
    expect(
      suggest.queries.at(-1),
      "the failed lookup was not for the typed query",
    ).toBe(QUERY);

    // US4 #3: Retry looks the same query up again and returns to `loading`.
    // `delayed` keeps the loading panel on screen long enough to observe.
    suggest.use("delayed");
    suggest.queries.length = 0;
    await retry.click();

    await expect(
      page.locator(SKELETON_ROWS),
      "Retry must return the panel to the loading state",
    ).toHaveCount(5);
    await expect(page.locator(ROWS)).toHaveCount(5, {
      timeout: SUGGEST_DELAY_MS + 5_000,
    });
    expect(
      suggest.queries,
      `Retry must issue exactly one lookup for the same q: ${suggest.queries.join(" | ")}`,
    ).toEqual([QUERY]);
    // The rows on screen are the retried query's, not anything stale.
    expect(queriesShownIn(await panel.innerText())).toEqual(
      Array(5).fill(QUERY),
    );
  });

  test("with the lookup failing, submitting the typed query reaches the results screen on every attempt", async ({
    page,
  }) => {
    // Five full activate-type-fail-submit round trips on one sign-in.
    test.slow();

    await installSuggestFixture(page, "error");
    await mockSearchResults(page);
    await openLibrarySignedIn(page);

    const ATTEMPTS = 5;
    const expectedUrl = `/app/search?${new URLSearchParams({ q: QUERY }).toString()}`;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        // Back to a screen whose field is empty: from /app/search the field
        // would be pre-filled and activation runs no lookup (FR-004).
        await page.goto("/app/library");
        await expect(page.getByText("Album 1", { exact: true })).toBeVisible();
      }

      await activateSearch(page, DESKTOP.width);
      await typeQuery(page, QUERY, 40);
      // SC-009 is about submitting *while* the failure is displayed.
      await expect(
        page.locator(PANEL).getByRole("button", { name: "Retry" }),
        `attempt ${attempt}: the lookup failure is not shown`,
      ).toBeVisible();

      await page.keyboard.press("Enter");
      await expect(
        page,
        `attempt ${attempt}: submit did not reach the results`,
      ).toHaveURL(expectedUrl);
      await expectCollapsed(page);
    }
  });
});
