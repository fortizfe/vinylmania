# Your collection in figures

Your library shows your records one card at a time. **Collection stats** (shown
in the app as **Mi colección en cifras**) shows the whole collection at once:
how many records you own, how they break down by decade, genre, style and
label, which artists you own the most of, how the collection has grown over
time, and an estimate of what it's all worth today.

Everything on this page is built from your **Discogs collection** — the same
data your library uses. Nothing here is a separate list you maintain by hand.

The page has two blocks:

- **Collection statistics** — counts and breakdowns, built entirely from data
  the app already has once your library has loaded. It needs no extra loading.
- **Estimated market value** — a running estimate of your collection's worth,
  based on Discogs price suggestions. It calculates in the background while you
  read the statistics.

## Before you start: link your Discogs account

Collection stats works only when your Discogs account is linked to Vinylmania —
the same link the library and wishlist use. You set it up once from your
profile.

If your account isn't linked, opening **Collection stats** shows a "Link your
Discogs account" message with a **Go to your profile** button instead of any
stats. Follow it, link your account, then come back.

If you once linked Discogs but later removed Vinylmania's access from your
Discogs settings, you'll see "Your Discogs link is no longer valid" instead.
Re-link from your profile to continue.

**The estimated market value block needs one more thing:** your Discogs
**seller settings** must be completed on your Discogs profile. This is separate
from linking your account — it's the setup Discogs asks for before it will give
out price suggestions. If it's missing, the statistics block still works
normally and the value block shows a short notice, "Estimated value needs your
Discogs seller settings", explaining what to complete on discogs.com. Nothing
is broken; the rest of the page is unaffected.

## Finding Collection stats

Open **Collection stats** from the top navigation. It sits next to **My
library** and **My wishlist**, on desktop and in the mobile menu.

If your Discogs collection is empty, the page says so plainly ("Your Discogs
collection has no records yet") rather than showing an error.

## Block 1 — Collection statistics

This block appears as soon as your library data is ready. It makes no new
requests to Discogs.

### Total records

At the top, **Records in your collection** shows how many records you own, and
**Most-present artist** shows the one artist who appears on the most of them,
with the record count.

The most-present artist is worked out one artist per record — the first
credited (primary) artist of each release. Compilations credited to "Various
Artists" are left out of this particular stat, though they still count towards
your total and every other breakdown.

### Breakdowns by decade, genre, style and label

Four lists — **By decade**, **By genre**, **By style** and **By label** — each
show a count per bucket, ordered from most to least.

- **By decade** is shown in full. Records with no year on Discogs are grouped
  under **Año desconocido** ("unknown year") but still count in your total.
- **By genre**, **By style** and **By label** show the top dozen or so buckets,
  with the rest collapsed into an expandable **Otros (N)** row you can open to
  see the full tally.

A record can sit in more than one genre, style or label bucket at once — a
release with two genres is counted under both. So the numbers in one of these
lists can add up to more than your total record count. That's expected, not a
mistake.

### Top artists

**Top artists** lists the artists you own the most records by, ranked, with the
leader marked **Most present**. Same rule as above: one artist per record,
"Various Artists" excluded.

### Growth over time

The **Growth over time** chart shows how your collection has built up, month by
month. A toggle switches between two views:

- **Per period** — how many records you added in each month.
- **Cumulative** — your total collection size as it grew over time.

This chart uses the **real date each record entered your Discogs collection** —
the date Discogs recorded, not anything Vinylmania made up. So a record you
added straight on discogs.com, and never touched in Vinylmania, is counted in
the month you added it there.

Below the chart there's a text version of the same data for screen readers.

## Block 2 — Estimated market value

This block estimates what your collection is worth today.

### What the estimate is

For each record, Vinylmania asks Discogs for its **price suggestions by
condition** and picks the figure for the **media condition you recorded** for
your copy. A record you graded VG+ is valued at the VG+ suggestion; a Mint copy
at the Mint suggestion. The collection total is the sum of the per-record
estimates that could be worked out.

Every amount on the screen — the total, the highlights, the full breakdown — is
shown in **one currency: the one you've configured in your Discogs account**
(the same currency Discogs uses for seller prices). There's no currency picker
and no conversion; the figures are simply whatever Discogs returns in your
account's currency.

### It calculates on its own — and you can walk away

You don't press anything to start the valuation. It begins automatically when
you open the page and fills in progressively as each record's estimate comes
back. A progress bar shows how far along it is, and the total updates as it
goes. The statistics block above stays fully usable the whole time.

For a large collection the first run can take a while. If so, you'll see a calm
note telling you it's fine to close the page and come back later — the progress
is saved, and picking the page up again continues from where it left off rather
than starting over. Re-opening within about a week reuses the prices already
fetched, so it finishes quickly and without hammering Discogs again.

### What leads the block

The block leads with the total and a **"most valuable records"** highlight list
(your top few by estimated value, each with its condition). The full
record-by-record breakdown isn't shown by default — open it with **Ver todos**
("see all"), which brings up a per-disc breakdown dialog.

### Why some records aren't counted in the value

The total is an estimate **over part of your collection**, and it says so. The
coverage label under the total reads, for example, **"estimado sobre 42 de 50
discos"** — estimated over 42 of 50 records. A record is left out of the value
when either:

- **Discogs has no market data for that pressing** — rare editions or records
  with no recorded sales. There's simply no suggestion to use.
- **You haven't recorded a media condition for your copy.** The estimate is
  condition-specific, so without a grade there's nothing to look up. Vinylmania
  never guesses a condition on your behalf. Record the condition on that
  release's detail page and it'll be included next time.

Records left out don't cause an error — they're just not in the sum, and the
coverage label tells you how many.

### If Discogs can't be reached

If Discogs doesn't return price data this time, the value block shows a
non-blocking message ("We couldn't estimate your collection's value right now")
with a button to try again. The statistics block is unaffected. If only some
records failed, the total for the rest is still shown, with a count of the ones
to retry.

## How the data stays in sync

Collection stats reads the same synced copy of your Discogs collection that the
library uses. If you've already opened your library this session, the stats use
that data straight away. Otherwise, opening the page syncs your collection
first, the same way the library does — roughly a five-minute freshness window,
no heavier fetch.

## Not included yet

These are planned for a later version and aren't available now:

- Alerts when a record's estimated value changes
- A history of how your collection's value has moved over time
- Exporting or downloading the report
- Comparing your collection, or its value, with other collectors
