import { expect, type Page, test } from "@playwright/test";

import { runAxeScan } from "../helpers/axe";
import {
  assertFocusIndicatorContrast,
  assertUiComponentContrast,
  colorAlpha,
  getContrastRatio,
  getResolvedComputedStyle,
  toRgb,
} from "../helpers/contrast";
import { signInAsFakeGoogleUser } from "../helpers/fakeGoogleSignIn";
import { assertSharedFocusRing } from "../helpers/focusRing";
import {
  installSuggestFixture,
  SUGGEST_DELAY_MS,
  type SuggestVariant,
  TITLE_SEPARATOR,
} from "../helpers/suggestFixture";

/**
 * Spec 069 — User Story 3: the header search's accessibility and contrast
 * matrix (T033), completed by US4's T041 with the `empty` and `error` states.
 *
 * Its own file rather than more of `header-search.spec.ts` (tasks.md
 * assumption 6), following the repo's existing precedent —
 * `dark-mode-contrast.spec.ts`, `overlay-contrast.spec.ts`. The functional
 * scenarios live next door and are not touched here.
 *
 * Written before T035/T036, per Constitution Principle I. Against today's
 * panel these fail for the functional reason they exist: the field is a plain
 * `<input type="search">` with no `role="combobox"`, no `aria-expanded`, no
 * `aria-controls` and no `aria-activedescendant`; the rows are `<li>` elements
 * with an `onClick` and no `role="option"` — operable by pointer only, which
 * is a WCAG 2.1.1 failure and an `aria-required-children` violation on the
 * `role="listbox"` they sit in; and the `<p role="status">` is mounted but
 * never written to.
 *
 * Sources: spec FR-021–FR-025, SC-006, SC-007, clarifications 3 and 5;
 * contracts/header-search-ui.md §3, §4, §5 and §8; data-model.md §5;
 * tasks.md assumptions 5 (arrows do not wrap) and 6.
 */

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const THEMES = ["light", "dark"] as const;

/** Every fixture title echoes `q`, so this is also what the rows say. */
const QUERY = "iron ma";

/** contracts §3 — the field keeps today's `id`; the form keeps `role="search"`. */
const SEARCH_INPUT = "input#header-search";
const SEARCH_FORM = '[role="search"]';
/**
 * The one control that opens the search from the keyboard at *both* widths:
 * below 640 px it is the collapsed opener, from 640 px up it is the submit
 * button, which also activates a collapsed search (contracts §1).
 */
const OPENER_BUTTON = 'button[aria-label="Search"]';
/** contracts §2/§3 — the decorative backdrop; the one expanded-state signal shared by both widths. */
const BACKDROP = 'div[aria-hidden="true"].overlay-scrim';
/** contracts §3 — the panel surface, its listbox, its real rows and its skeletons. */
const PANEL = "[data-testid='header-search-panel']";
const LISTBOX = "#header-search-listbox";
const ROWS = '#header-search-listbox > li:not([aria-hidden="true"])';
const SKELETON_ROWS = '#header-search-listbox > li[aria-hidden="true"]';
/**
 * contracts §5 — scoped to the search container on purpose: `LibraryListPage`
 * renders the same `<p role="status" class="sr-only">` pattern, and an
 * unscoped selector would resolve to both.
 */
const STATUS = '[role="search"] [role="status"]';
/** contracts §3 — the error state's one control, inside the panel, outside the listbox. */
const RETRY = `${PANEL} button:has-text("Retry")`;

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

async function mockLibrary(page: Page, count = 24) {
  await page.route("**/api/library*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: Array.from({ length: count }, (_unused, i) =>
          libraryEntry(`entry-${i + 1}`, `Album ${i + 1}`),
        ),
        page: 1,
        pageSize: count,
        totalItems: count,
      }),
    });
  });
}

/** The keyboard flow ends on `/app/search`; nothing there must reach the real API. */
async function mockSearchResults(page: Page) {
  await page.route("**/api/discogs/search*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [],
        pagination: { page: 1, pages: 1, items: 0, perPage: 20 },
      }),
    });
  });
}

async function openLibrarySignedIn(
  page: Page,
  viewport: typeof PHONE,
): Promise<void> {
  await page.setViewportSize(viewport);
  await mockLibrary(page);
  await mockSearchResults(page);
  await page.goto("/");
  await signInAsFakeGoogleUser(page);
  await page.goto("/app/library");
  await expect(page.getByText("Album 1", { exact: true })).toBeVisible();
}

/**
 * Pointer activation — used by the axe and contrast scenarios, which are not
 * about the keyboard. Below 640 px the opener is the collapsed icon button,
 * from 640 px up it is the field itself (contracts §2).
 */
async function activateSearch(page: Page, width: number): Promise<void> {
  const opener =
    width < 640
      ? page.getByRole("button", { name: "Search", exact: true })
      : page.locator(SEARCH_INPUT);
  await opener.first().click();
}

/* ------------------------------------------------------------------ *
 * Scenario "keyboard-only" — SC-006, FR-021–FR-024, clarification 5.
 * ------------------------------------------------------------------ */

/**
 * Walks Tab until `selector` holds DOM focus. Doubles as the "is it reachable
 * at all" check: a control the keyboard cannot reach, and a trap that never
 * releases focus, both surface here rather than as a mystery timeout.
 */
async function tabUntil(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press("Tab");
    // A locator, not `Element.matches`, so Playwright-only selectors such as
    // `:has-text()` (RETRY) resolve too.
    const landed = await page.locator(selector).and(page.locator(":focus")).count();
    if (landed > 0) return;
  }
  throw new Error(
    `${label}: 25 Tab presses never reached "${selector}" — the control is unreachable from the keyboard, or focus is trapped before it`,
  );
}

async function expectFieldFocused(page: Page, label: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => document.activeElement?.id),
      `${label}: DOM focus`,
    )
    .toBe("header-search");
}

/**
 * contracts §3 + §4: the active option is exposed by `aria-activedescendant`
 * on the field and by `aria-selected="true"` on exactly that option — and the
 * arrow keys that moved it never moved DOM focus, which is what removes the
 * need for a focus trap (research D11).
 */
async function expectActiveOption(
  page: Page,
  index: number | null,
  label: string,
): Promise<void> {
  const field = page.locator(SEARCH_INPUT);
  const selected = page.locator(`${LISTBOX} [aria-selected="true"]`);

  if (index === null) {
    await expect(
      field,
      `${label}: no option should be active`,
    ).not.toHaveAttribute("aria-activedescendant", /.+/);
    await expect(
      selected,
      `${label}: no option should be aria-selected`,
    ).toHaveCount(0);
  } else {
    const optionId = `header-search-option-${index}`;
    await expect(field, `${label}: aria-activedescendant`).toHaveAttribute(
      "aria-activedescendant",
      optionId,
    );
    await expect(
      page.locator(`#${optionId}`),
      `${label}: option ${index} should be the selected one`,
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      selected,
      `${label}: exactly one option may be aria-selected`,
    ).toHaveCount(1);
  }

  await expectFieldFocused(
    page,
    `${label}: arrow keys must not move DOM focus`,
  );
}

for (const theme of THEMES) {
  for (const viewport of [PHONE, DESKTOP]) {
    const label = `${theme}, ${viewport.width}px`;

    test.describe("Header search — keyboard-only flow (spec 069 US3, SC-006)", () => {
      test(`open, type, browse, choose and dismiss on the keyboard alone, announced and exposed at every step (${label})`, async ({
        page,
      }) => {
        // One sign-in, three passes through the search and a deliberately
        // delayed lookup: comfortably more than the default per-test budget.
        test.slow();

        await page.emulateMedia({ colorScheme: theme });
        // `delayed` so the `loading` announcement is observable at all — it is
        // a state change SC-006 requires an assertion on.
        const suggest = await installSuggestFixture(page, "delayed");
        await openLibrarySignedIn(page, viewport);

        const field = page.locator(SEARCH_INPUT);
        const statusRegion = page.locator(STATUS);
        // contracts §1/§2: below 640 px the collapsed icon button opens the
        // search. From 640 px up the field is always visible and the button
        // beside it only submits, so there the field is the opener and typing
        // into it is the activation.
        const onPhone = viewport.width < 640;
        const openerSelector = onPhone ? OPENER_BUTTON : SEARCH_INPUT;
        const opener = page.locator(openerSelector);

        // ── open ─────────────────────────────────────────────────────────
        await tabUntil(page, openerSelector, label);
        if (onPhone) {
          await expect(
            opener,
            `${label}: collapsed opener state`,
          ).toHaveAttribute("aria-expanded", "false");
          // The opener is a `Button`, so it carries the shared `focusRing`
          // (contracts §4). The field's own indicator is `Input`'s
          // `focus:border-primary`, asserted further down with the helper that
          // resolves whichever of the three mechanisms a control uses.
          await assertSharedFocusRing(opener, `search opener (${label})`);

          await page.keyboard.press("Enter");
          await expect(
            page.locator(BACKDROP),
            `${label}: Enter must expand the search`,
          ).toBeVisible();
          await expect(opener).toHaveAttribute("aria-expanded", "true");
        }
        await expectFieldFocused(page, `${label}: after activation`);

        // `idle` (data-model §5): no panel, nothing active, nothing announced.
        await expect(
          page.locator(PANEL),
          `${label}: idle must not mount a panel`,
        ).toHaveCount(0);
        await expect(
          field,
          `${label}: the field must be a combobox (FR-024)`,
        ).toHaveRole("combobox");
        await expect(field).toHaveAttribute(
          "aria-controls",
          "header-search-listbox",
        );
        await expect(field).toHaveAttribute("aria-autocomplete", "list");
        await expect(field, `${label}: idle aria-expanded`).toHaveAttribute(
          "aria-expanded",
          "false",
        );
        await expect(
          field,
          `${label}: persistent accessible name (FR-024)`,
        ).toHaveAccessibleName("Search Discogs");
        await expect(
          statusRegion,
          `${label}: nothing may be announced before a lookup runs`,
        ).toHaveText("");
        await expectActiveOption(page, null, `${label}: idle`);

        // ── type → loading ───────────────────────────────────────────────
        await page.keyboard.type(QUERY, { delay: 40 });
        await expect(
          page.locator(BACKDROP),
          `${label}: the search is expanded once typing starts`,
        ).toBeVisible();
        await expect(
          statusRegion,
          `${label}: the started lookup must be announced (contracts §5)`,
        ).toHaveText("Searching…");
        await expect(page.locator(SKELETON_ROWS)).toHaveCount(5);
        await expect(field, `${label}: loading aria-expanded`).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        await expectActiveOption(page, null, `${label}: loading`);
        // Read once the border-colour transition has long settled (the field
        // has held focus since activation), so this measures the focused
        // colour and not a frame of `transition-[border-color]`.
        await assertFocusIndicatorContrast(
          page,
          field,
          `search field focus indicator (${label})`,
        );

        // ── suggestions ──────────────────────────────────────────────────
        await expect(page.locator(ROWS)).toHaveCount(5, {
          timeout: SUGGEST_DELAY_MS + 5_000,
        });
        await expect(
          statusRegion,
          `${label}: the result count must be announced (contracts §5)`,
        ).toHaveText("5 suggestions available.");

        // ── browse (contracts §4, assumption 5 — no wrap) ─────────────────
        for (const index of [0, 1, 2, 3, 4]) {
          await page.keyboard.press("ArrowDown");
          await expectActiveOption(
            page,
            index,
            `${label}: ArrowDown to ${index}`,
          );
        }
        // Past the last option there is no active one, so `Enter` can always
        // still submit the typed query (FR-022).
        await page.keyboard.press("ArrowDown");
        await expectActiveOption(
          page,
          null,
          `${label}: ArrowDown past the last option`,
        );
        // From "no active option", ArrowUp activates the last.
        await page.keyboard.press("ArrowUp");
        await expectActiveOption(
          page,
          4,
          `${label}: ArrowUp from no active option`,
        );
        for (const index of [3, 2, 1, 0]) {
          await page.keyboard.press("ArrowUp");
          await expectActiveOption(
            page,
            index,
            `${label}: ArrowUp to ${index}`,
          );
        }
        await page.keyboard.press("ArrowUp");
        await expectActiveOption(
          page,
          null,
          `${label}: ArrowUp past the first option`,
        );
        // Browsing is not a state change: the count stands (contracts §5).
        await expect(statusRegion).toHaveText("5 suggestions available.");

        // ── choose ───────────────────────────────────────────────────────
        await page.keyboard.press("ArrowDown");
        await expectActiveOption(page, 0, `${label}: back to the first option`);
        await page.keyboard.press("Enter");
        // `mixed` puts the artists first (data-model §3), and an artist opens
        // `buildSearchPath(title)` (contracts §6).
        const artistQuery = `${QUERY}${TITLE_SEPARATOR}Band 1`;
        await expect(page).toHaveURL(
          `/app/search?${new URLSearchParams({ q: artistQuery }).toString()}`,
        );
        await expect(
          page.locator(BACKDROP),
          `${label}: choosing also collapses`,
        ).toHaveCount(0);
        await expect(
          statusRegion,
          `${label}: the region is cleared on collapse (FR-015)`,
        ).toHaveText("");

        // ── reopen, then Escape twice (FR-022, FR-007) ───────────────────
        await page.goto("/app/library");
        await expect(page.getByText("Album 1", { exact: true })).toBeVisible();
        // No need to watch `loading` a second time.
        suggest.use("mixed");

        await tabUntil(page, openerSelector, `${label}: reopening`);
        if (onPhone) {
          await page.keyboard.press("Enter");
          await expect(page.locator(BACKDROP)).toBeVisible();
        }
        await page.keyboard.type(QUERY, { delay: 40 });
        await expect(page.locator(ROWS)).toHaveCount(5);
        await page.keyboard.press("ArrowDown");
        await expectActiveOption(page, 0, `${label}: reopened`);

        // Escape #1 — closes the panel, keeps the text, keeps the focus.
        await page.keyboard.press("Escape");
        await expect(
          page.locator(PANEL),
          `${label}: Escape must close the panel`,
        ).toHaveCount(0);
        await expect(
          page.locator(BACKDROP),
          `${label}: the first Escape must not collapse the search`,
        ).toBeVisible();
        await expect(
          field,
          `${label}: Escape keeps the typed text`,
        ).toHaveValue(QUERY);
        await expect(
          field,
          `${label}: panel closed aria-expanded`,
        ).toHaveAttribute("aria-expanded", "false");
        await expectActiveOption(page, null, `${label}: after Escape #1`);
        await expect(
          statusRegion,
          `${label}: cleared with the panel`,
        ).toHaveText("");

        // Escape #2 — collapses and hands focus back to the opener.
        await page.keyboard.press("Escape");
        await expect(
          page.locator(BACKDROP),
          `${label}: the second Escape collapses`,
        ).toHaveCount(0);
        await expect(
          opener,
          `${label}: focus returns to the opener`,
        ).toBeFocused();
        await expect(statusRegion).toHaveText("");

        // ── no keyboard trap, panel open, at either width (FR-021) ───────
        // Focus is already on the opener (asserted just above); tabbing to it
        // again would first Tab *away* and have to cycle the whole page. From
        // 640 px up that opener is the field, still holding the kept text:
        // Enter would submit it, so select it and type over it instead.
        await page.keyboard.press(onPhone ? "Enter" : "ControlOrMeta+A");
        await page.keyboard.type(QUERY, { delay: 40 });
        await expect(page.locator(ROWS)).toHaveCount(5);

        let escaped = false;
        for (let i = 0; i < 8; i += 1) {
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
          `${label}: Tab cycles inside the open search — focus is trapped (FR-021, clarification 3)`,
        ).toBe(true);
      });
    });
  }
}

/* ------------------------------------------------------------------ *
 * Scenario "axe" — SC-007.
 *
 * The matrix is a table of states × the two themes × the two widths. US4's
 * T041 completes it by adding the `empty` and `error` rows to `PANEL_STATES`
 * and their names to `AXE_STATES` — two lines each, no rewrite.
 * ------------------------------------------------------------------ */

type PanelStateName = "idle" | "loading" | "suggestions" | "empty" | "error";

interface PanelStateCase {
  /** The suggest fixture variant that produces this state. */
  variant: SuggestVariant;
  /** Drives a freshly activated, empty search into this state. */
  reach: (page: Page) => Promise<void>;
}

const PANEL_STATES: Partial<Record<PanelStateName, PanelStateCase>> = {
  // data-model §5: below two edited characters the panel is not mounted at all.
  idle: {
    variant: "mixed",
    reach: async (page) => {
      await expect(page.locator(PANEL)).toHaveCount(0);
    },
  },
  loading: {
    variant: "mixed",
    reach: async (page) => {
      // Hold the lookup open for however long the scan takes. A later
      // `page.route` wins over the fixture's, and never fulfilling leaves the
      // request in flight, so `loading` cannot resolve mid-scan — where
      // `delayed`'s 1.2 s window would race an axe run and flake.
      await page.route("**/api/discogs/suggest*", () => {});
      await page.keyboard.type(QUERY, { delay: 40 });
      await expect(page.locator(SKELETON_ROWS)).toHaveCount(5);
    },
  },
  suggestions: {
    variant: "mixed",
    reach: async (page) => {
      await page.keyboard.type(QUERY, { delay: 40 });
      await expect(page.locator(ROWS)).toHaveCount(5);
    },
  },
  // T041 (US4) — contracts §3: text outside the listbox, no rows.
  empty: {
    variant: "empty",
    reach: async (page) => {
      await page.keyboard.type(QUERY, { delay: 40 });
      await expect(page.locator(PANEL)).toContainText(QUERY);
      await expect(page.locator(ROWS)).toHaveCount(0);
    },
  },
  error: {
    variant: "error",
    reach: async (page) => {
      await page.keyboard.type(QUERY, { delay: 40 });
      await expect(page.locator(RETRY)).toBeVisible();
    },
  },
};

const AXE_STATES: PanelStateName[] = [
  "idle",
  "loading",
  "suggestions",
  "empty",
  "error",
];

test.describe("Header search — WCAG 2.1 AA automated scan (spec 069 US3, SC-007)", () => {
  for (const theme of THEMES) {
    for (const viewport of [PHONE, DESKTOP]) {
      for (const stateName of AXE_STATES) {
        const state = PANEL_STATES[stateName];
        if (!state) continue;

        test(`no violations in the ${stateName} state (${theme}, ${viewport.width}px)`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme: theme });
          await installSuggestFixture(page, state.variant);
          await openLibrarySignedIn(page, viewport);

          await activateSearch(page, viewport.width);
          await expect(page.locator(BACKDROP)).toBeVisible();
          await expectFieldFocused(
            page,
            `${stateName} (${theme}, ${viewport.width}px)`,
          );
          await state.reach(page);

          const seriousOrCritical = await runAxeScan(page);
          expect(
            seriousOrCritical,
            `${stateName} state (${theme}, ${viewport.width}px): ${JSON.stringify(seriousOrCritical, null, 2)}`,
          ).toEqual([]);
        });
      }
    }
  }
});

/* ------------------------------------------------------------------ *
 * Scenario "empty and error announced, Retry operable" — T041 (US4).
 *
 * contracts §5 strings exactly, FR-023 (polite, replacing not stacking),
 * contracts §4 (`Tab` goes into the panel when it holds Retry), FR-005's
 * 44x44 target floor. Theme-independent, so light only; both widths because
 * the Tab order differs (collapsed opener vs. inline submit button).
 * ------------------------------------------------------------------ */

const MIN_TARGET = 44;

test.describe("Header search — empty and error states for assistive tech (spec 069 US4, FR-023)", () => {
  for (const viewport of [PHONE, DESKTOP]) {
    const label = `${viewport.width}px`;

    test(`announces the empty and error states verbatim and keeps a 44x44 Retry reachable by Tab (${label})`, async ({
      page,
    }) => {
      const suggest = await installSuggestFixture(page, "empty");
      await openLibrarySignedIn(page, viewport);

      await activateSearch(page, viewport.width);
      await expect(page.locator(BACKDROP)).toBeVisible();
      await expectFieldFocused(page, label);

      const statusRegion = page.locator(STATUS);

      // ── empty ────────────────────────────────────────────────────────
      await page.keyboard.type(QUERY, { delay: 40 });
      await expect(
        statusRegion,
        `${label}: empty-state announcement (contracts §5)`,
      ).toHaveText(`No suggestions for “${QUERY}”.`);

      // ── error — a new query, so the region must *replace* the empty text ──
      suggest.use("error");
      const failing = `${QUERY}x`;
      await page.keyboard.type("x");
      await expect(
        statusRegion,
        `${label}: error announcement (contracts §5)`,
      ).toHaveText("Suggestions are unavailable. Retry is available.");
      expect(suggest.queries.at(-1)).toBe(failing);
      await expect(
        page.locator(`${PANEL} [role="alert"]`),
        `${label}: never role="alert"`,
      ).toHaveCount(0);

      // ── Retry: reachable by Tab from the field, and a 44x44 target ───
      await expectFieldFocused(page, `${label}: before tabbing to Retry`);
      await tabUntil(page, RETRY, `${label}: Retry`);
      const box = await page.locator(RETRY).boundingBox();
      expect(box, `${label}: Retry has no layout box`).not.toBeNull();
      expect(box!.width, `${label}: Retry width`).toBeGreaterThanOrEqual(
        MIN_TARGET,
      );
      expect(box!.height, `${label}: Retry height`).toBeGreaterThanOrEqual(
        MIN_TARGET,
      );
      // Tabbing into the panel must not have collapsed the search (contracts §4).
      await expect(
        page.locator(BACKDROP),
        `${label}: Tab to Retry collapsed the search`,
      ).toBeVisible();
    });
  }
});

/* ------------------------------------------------------------------ *
 * Scenario "contrast" — FR-025, contracts/header-search-ui.md §8.
 *
 * §8's point is that only two *surfaces* are new: the expanded field and the
 * panel, both now floating over the backdrop. Everything inside the panel is
 * the app's existing Card pairing and is deliberately not recomputed here
 * (T034 covers the panel's own rows in dark mode).
 *
 * §8 row 2 names "field and panel border against the scrim behind them". The
 * panel really does sit on the scrim, so its border is measured against it.
 * The field does not: HeaderSearchBox pins the expanded phone bar on the
 * header's own opaque surface precisely so the field never sits on a
 * translucent layer (apple-design §12 — no two stacked translucent layers).
 * That invariant is what is asserted for the field: the surface behind it is
 * opaque, so its text pairing (row 1) is a real 4.5:1 and not a composite
 * over a blurred scrim.
 * ------------------------------------------------------------------ */

const WCAG_AA_TEXT = 4.5;

test.describe("Header search — expanded field and panel contrast (spec 069 US3, FR-025)", () => {
  for (const theme of THEMES) {
    for (const viewport of [PHONE, DESKTOP]) {
      const label = `${theme}, ${viewport.width}px`;

      test(`the expanded field and the floating panel clear contracts §8 (${label})`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: theme });
        await installSuggestFixture(page, "mixed");
        await openLibrarySignedIn(page, viewport);

        await activateSearch(page, viewport.width);
        await expect(page.locator(BACKDROP)).toBeVisible();
        await expectFieldFocused(page, label);
        // Real text in the field, and the panel up, so both new surfaces are
        // on screen at once.
        await page.keyboard.type(QUERY, { delay: 40 });
        await expect(page.locator(ROWS)).toHaveCount(5);

        const field = page.locator(SEARCH_INPUT);
        const scrim = page.locator(BACKDROP);
        const panel = page.locator(PANEL);

        // §8 row 1 — field text over the expanded field's own background.
        const [textColor, fieldBg] = await Promise.all([
          getResolvedComputedStyle(field, "color"),
          getResolvedComputedStyle(field, "backgroundColor"),
        ]);
        expect(
          await colorAlpha(page, fieldBg),
          `${label}: the expanded field's background ${fieldBg} is translucent — its text would be read against the blurred scrim (contracts §8)`,
        ).toBeGreaterThanOrEqual(0.99);

        const [fg, bg] = await Promise.all([
          toRgb(page, textColor),
          toRgb(page, fieldBg),
        ]);
        const fieldRatio = getContrastRatio(fg, bg);
        expect(
          fieldRatio,
          `${label}: field text ${textColor} on the expanded field ${fieldBg} is ${fieldRatio.toFixed(2)}:1 (< ${WCAG_AA_TEXT}:1)`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);

        // §8 row 2, the field half — the field never touches the scrim: the
        // surface between the two is opaque (the expanded bar below 640 px,
        // the header itself above it).
        const behindField =
          viewport.width < 640
            ? page.locator(SEARCH_FORM)
            : page.getByRole("banner");
        const behindFieldBg = await getResolvedComputedStyle(
          behindField,
          "backgroundColor",
        );
        expect(
          await colorAlpha(page, behindFieldBg),
          `${label}: the surface carrying the expanded field is ${behindFieldBg} — translucent, so the field is stacked straight on the blurred scrim (contracts §8)`,
        ).toBeGreaterThanOrEqual(0.99);

        // §8 row 2, the panel half — the panel *is* on the scrim, so its
        // boundary is a real WCAG 1.4.11 pairing against it.
        await assertUiComponentContrast(
          page,
          panel,
          scrim,
          `${label}: panel border on the scrim`,
        );
      });
    }
  }
});
