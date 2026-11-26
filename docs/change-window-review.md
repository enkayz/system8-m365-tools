# Microsoft 365 Change Window Review — 1.0.0

Build date: 2026-11-26, Australia/Perth. Static route: `public/tools/change-window-review/`. **No publication, deployment, source-checkout, archive, inventory, queue, nginx or existing-tool edits are included.**

## Workflow and contract

Review a proposed tenant-admin change and its consecutive rollback allowance against each site's manually entered local working schedule. Enter one exact UTC start, execution minutes, rollback minutes, optional notes, and 1–20 sites. Review separate collision counts and dated local phase boundaries. Explicitly download every reviewed site as JSON or formula-protected review CSV, or clear the page. Any input edit, weekday change, site addition or removal withdraws results and disables exports immediately. There is no candidate-time search or recommendation.

The initial site is labelled `Site 1`, with editable `Australia/Perth`, Monday–Friday 09:00–17:00; the page explicitly says this is a default schedule, not a customer record. UTC start is blank; execution defaults to 60 and rollback to 30 minutes. Contextual input examples are explanatory only, never loaded production fixtures.

### Supported inputs

- Exact `YYYY-MM-DDTHH:mmZ`, uppercase literal `T` and `Z`, minute precision, Gregorian year **2000–2099**, validated by exact round trip. Seconds, offsets, invalid leap dates and surrounding whitespace are rejected, not repaired. The bounded modern date range avoids historical sub-minute local offsets; future browser rules remain provisional.
- Execution is a positive integer; rollback is a nonnegative integer. Combined maximum **1440** elapsed minutes. Empty numeric controls are invalid. Core accepts numeric integers only; browser number controls supply those numbers.
- **1–20 sites**. Names 1–80 characters, nonblank and without controls. Time zone identifiers up to 100 characters: `UTC` or a slash-qualified IANA identifier/alias accepted by the running browser's `Intl.DateTimeFormat`. Abbreviations such as `CST`, numeric offset strings and unsupported identifiers are rejected. Original accepted text is retained rather than repaired or silently canonicalized.
- Each site selects one or more distinct local weekdays, Monday=1 through Sunday=7. Arbitrary custom workweeks are supported. One exact `HH:mm` local interval with start strictly before end, times 00:00–23:59. No overnight, split-shift or 24:00 interval. This limitation appears immediately beside site controls.
- Optional notes up to 1000 characters. Tabs/newlines are allowed in notes; other control characters are rejected. Names and notes are validated rather than silently truncated. Unknown object fields are discarded; only selected input evidence is retained in output. Oversized/invalid plans fail closed, never as partial results.

### Calculation and outputs

Pure dependency-free `core.mjs` is shared by Node tests and the browser. The algorithm enumerates each actual elapsed UTC minute in `[start, executionEnd)` and `[executionEnd, rollbackEnd)`. For every minute it derives local Gregorian date, weekday and 24-hour clock using `Intl.DateTimeFormat`, `hourCycle: 'h23'`. A collision requires a selected local weekday and `workStart <= localTime < workEnd`. Endpoints are exclusive. Repeated DST clock minutes are separate elapsed minutes; skipped clock minutes never occur. Date rollover is evaluated per minute, not inferred from the start day.

Each site row includes the entered schedule, independent execution/rollback overlap-minute counts, neutral text flags and three dated local boundary objects: start, execution end / rollback start, rollback allowance end. Each boundary carries exact UTC ISO, local date/time, weekday and explicit numeric UTC offset, including `UTC+00:00`. Different offsets at phase boundaries remain visible. A zero rollback allowance has its own flag; it is not a statement that rollback is unnecessary. No-overlap wording is not “safe”, approved or ready.

JSON includes version, validated selected input evidence, calculation model, limits and all rows. CSV includes each site's schedule, all UTC/local boundaries, duration and collision counts, flags, notes, model and limits. It quotes every cell, doubles internal quotes, uses CRLF records and prefixes formula-like values (including whitespace-prefixed `=`, `+`, `-`, `@`, tabs/newlines) with an apostrophe. **CSV is a review export, not a tenant/import/round-trip format.** JSON retains exact accepted text. Filenames are fixed `change-window-review.json` / `.csv`, never input-controlled. Downloads happen only on explicit button action; stale or absent snapshots cannot export.

## Scope, custody and rollback

No sign-in, permissions, admin consent, Graph/API calls or additional Microsoft 365 license. No holidays, calendars, tenant/service reads, staffing availability, downtime estimate, authorization, approval, recovery validation or scheduling of Microsoft's maintenance. This tool does not make tenant changes. Obtaining/confirming schedule and change authority remains the operator's responsibility.

Inputs/results stay in page memory; no upload, local/session storage, IndexedDB, cookies, cache storage, service worker, analytics, runtime dependencies or remote fonts. Static hosting still receives ordinary asset-request metadata. Exports include internal names/schedules/notes; handle accordingly. Clear restores defaults with a blank start, one site, empty notes and no snapshot; reload starts fresh. Neither removes source records or earlier downloads or guarantees memory erasure. There is no tenant operation to reverse. For local artifact rollback, remove only the new slug and its new tests/doc; do not alter established tools. Publishing rollback belongs to the coordinator.

## Local verification

From `/home/hermes/projects/system8-m365-daily-tools`:

```sh
python3 -m http.server 3370 --bind 127.0.0.1 --directory public
```

In another shell, use a fresh absolute evidence directory each time (exports use exclusive writes):

```sh
CHANGE_WINDOW_TOOL_URL=http://127.0.0.1:3370/tools/change-window-review/ \
CHANGE_WINDOW_EVIDENCE_DIR="$PWD/receipts/2026-11-26/build-final-evidence" \
node --test tests/change-window-*.test.mjs
```

Browser module defaults to `/home/hermes/projects/system8-m365-dashboard/node_modules/playwright`; executable defaults to `/home/hermes/projects/system8-m365-dashboard/test-results/playwright-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`. Override with `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_EXECUTABLE`. `CHANGE_WINDOW_TOOL_URL` overrides the route; `CHANGE_WINDOW_EVIDENCE_DIR` must be absolute. No installs or package changes required on this build host.

Coverage: separate phases, rollback-only collision, zero rollback, 1440-minute/20-site bounds, exclusive work/window boundaries, nonworking/custom weekdays, leap/date rollover, fractional offsets, international date line, invalid timezone/date/schedule/notes, hostile HTML and formulas, all-row exports, unknown-field exclusion, input snapshot isolation, stale-result invalidation, add/remove, clear/reload. Real Chromium viewport workflows at 320, 390 and 1440 widths exercise keyboard skip/focus/Enter, primary review, invalid input, download contents, clear and storage/network custody. Browser DST spring/fall tests use actual shipped calculation, not mocked outputs. Viewports are not physical-device or assistive-technology certification. No live-tenant validation is applicable or claimed.

## Internal evidence and handoff

All paths below are relative to the project root:

- Selection/access limits and direction contract: `receipts/2026-11-26/build-research.md`.
- Retrieved source HTML/text and URL/status manifests: `receipts/2026-11-26/build-research-raw/`.
- Incremental failing/pass logs: `receipts/2026-11-26/build-01-red.log` through `build-09-red.log`, paired `build-01-green.log` through `build-09-green.log`. Each feature was implemented only after the corresponding failure. Extra edge-case tests verify existing minute-iteration behavior (`build-04-regressions.log`), not invented red cycles.
- Mobile first-click validation bug: `build-10-regressions.log` and `build-10-focus-diagnosis.log` show focusout inserting an error above a pressed button, moving it 114px before pointerup. Error placement below actions fixes the cause; `build-10-green.log` passes. An unrelated test selector was corrected from a shrinking `:checked` locator list to stable checkbox locators; this is a harness fix, not product behavior.
- UTC boundary readability: `build-11-red.log` / `build-11-green.log`. Documentation contract: `build-12-red.log` / `build-12-green.log`.
- Final exact invocation/output: `receipts/2026-11-26/build-final.log`. Final screenshots, real exports and custody request logs: `receipts/2026-11-26/build-final-evidence/` (`build-ui-320.png`, `build-ui-390.png`, `build-ui-1440.png`, `build-export.json`, `build-export.csv`, and `build-custody-{width}.json`).
- Local design inspection/limits: `receipts/2026-11-26/build-design-review.md`. Artifact hashes: `receipts/2026-11-26/build-manifest.json`.

Research constraints: requested web.run is unavailable in this subagent; public references were actually retrieved read-only by HTTP. Google search was CAPTCHA/redirect-only; AppSource and Marketplace searches returned 403. GitHub broader repository search and three nearby public planner pages were readable. No market-wide nonexistence or novelty claim. Coordinator may complete marketplace discovery and independent exact-tree security/UX review before any publication. Impeccable launcher/detector lack execute permission on this host; no global configuration was changed. Inline design inspection is not independent release review.

### Inherited visual system (documentation-only, no global design edits)

Compared against PRODUCT.md and `public/tools/exchange-alias-claims/style.css`: navy `#142c48` shell, white task surfaces on `#f4f6f9`, text `#202b38`, help `#334b64`, action/focus blue `#0759ac`, light border `#d3dbe5`. Segoe UI/system/sans stack, 28px desktop title (25px narrow mobile), 20px section titles, 17px site headings, 16px body and 14px form/help. Flat tonal layering, 4px panel / 3px control corners, 40px control minimum, 3px visible focus outline. Responsive grids collapse at 760px and 450px; results become stacked definition lists and phase counts. No decoration, animation or shipping rasters. Global DESIGN.md is absent; creating one/sidecar is outside this isolated extension's write boundary, so no pre-existing drift is silently repaired or canonized.

## Changelog

- 1.0.0 — 2026-11-26: local UTC minute-based site impact review with separate execution/rollback collision counts, custom workweeks, explicit all-site handoff downloads, reset and stale-result withdrawal. Locally tested only; no publication or deployment included.
