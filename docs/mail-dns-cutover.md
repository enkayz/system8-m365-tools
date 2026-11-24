# Mail DNS Cutover Worksheet

Version 1.0.0 — publication date 2026-11-24. Local implementation began 2026-11-23; the interrupted cycle was not published or backdated.

Prepare a multi-RRset DNS cutover handoff using one planned cutover and user-entered TTL-lowering evidence. This is not a DNS checker, migration executor, propagation guarantee, readiness verdict or decommission planner.

## Run locally

From `/home/hermes/projects/system8-m365-daily-tools`:

```sh
python3 -m http.server 3363 --bind 127.0.0.1 --directory public
```

Open `http://127.0.0.1:3363/tools/mail-dns-cutover/`. ES modules require HTTP serving; opening index.html as a file is not the supported workflow. Static HTML/CSS/ESM; no build step or runtime dependencies. Stop the preview server to remove local availability. No deployment, tenant operation or rollback operation is performed.

## Workflow

1. Enter the common cutover as ISO date/time with seconds and explicit `Z` or numeric offset.
2. Enter one RRset per DNS name/type pair, old and new whole-second TTLs, and optionally the actual lowering time.
3. Only enter that actual time if it represents the lower TTL being visible on **ALL authoritative servers**. The tool cannot establish or verify this evidence.
4. Add/remove RRsets as needed. Calculate explicitly. Review each row and unverified/shortfall counts.
5. Download all rows as JSON or protected CSV using the explicit buttons. Any input edit, type change, addition or removal invalidates the result and disables downloads until recalculated.
6. Clear the worksheet or close/reload the page when finished. This does not erase originals or earlier exports and does not undo DNS changes.

Production fields start empty, with example placeholders only; record type defaults to MX. Test data is isolated to tests and internal build receipts.

## Exact model

For each row, `C` is common cutover, `O` is old TTL, `N` is new TTL, and `L` is the actual fully-authoritative lowering timestamp. TTLs are seconds.

- Planned lower-by: `C − O`.
- With entered evidence: old-cache expiry `L + O`.
- Lead-time shortfall seconds: `max(0, L + O − C)`.
- Modeled TTL-honouring cache window end: `max(C + N, L + O)`.
- Without `L`: status **Unverified**, planned deadline only; actual lowering, old-cache expiry, shortfall and modeled end are JSON `null`. The review uses Unknown / Not asserted, not zero.
- Entered evidence without a shortfall is labelled **Entered lowering evidence**, never ready or complete. It is still unverified by DNS lookup.

No current-time readiness check is performed. An entered timestamp may be a planned scenario within the common cutover constraint; the user is responsible for its truth. Serve-stale, resolver TTL floors, provider replication, SMTP retries and queued mail are not modeled. No DNS lookup, record-value validation, MX-priority check or authoritative-server check is performed. A modeled window end is not proof of global expiry or when services can be retired.

## Validation and bounds

- 1–100 RRsets; sparse/malformed input is rejected by the core.
- MX, TXT and CNAME only, explicit uppercase types.
- Name: 253 ASCII characters excluding optional final dot, at most 63 per label; letters, digits, hyphens and underscores, no leading/trailing hyphens. Underscores support DNS owner names such as DKIM service labels; this is not a hostname-only validator. Use punycode if required; the tool does not convert Unicode.
- Names canonicalize to lowercase without a final dot. Duplicate normalized name/type identities are rejected; different types at the same name are allowed, without assessing DNS semantic compatibility.
- TTL: 0–2147483647 seconds, decimal whole numbers only, at most ten input characters. New TTL cannot exceed old TTL. Empty, signed, whitespace-padded, fractional and exponent notation are rejected.
- ISO input: four-digit years 0001–9999, `YYYY-MM-DDTHH:mm:ss[.SSS]Z` or explicit `±HH:mm` offset. Fractional seconds may contain 1–3 digits. Strict calendar/leap-year validation; no date-only, local-zone inference, 24:00 or leap seconds. Date inputs are bounded to 35 characters. Lowering after cutover is rejected. Calculations may produce ISO dates outside the four-digit input-year range at extreme boundaries.
- Field validation appears after leaving a nonempty field; complete and cross-field validation occurs on Calculate. Errors are text-only and focusable; controls carry accessible labels and keyboard-visible focus. Results are a semantic table inside a keyboard-focusable horizontally scrollable region. On narrow screens scroll the results region, not the whole page.

## Export contract

JSON includes version, assumptions, normalized common cutover, unverifiedCount, shortfallCount and all rows. Each row includes only selected fields: name, type, oldTTLseconds, newTTLseconds, actualLowered, plannedLowerBy, oldCacheExpiry, modeledWindowEnd, shortfallSeconds and status. Unknown input properties are discarded.

CSV has a header plus one row per RRset, all cells quoted, embedded quotes doubled, CRLF row delimiters, and assumption text repeated on every record. It includes version and cutover per row; JSON additionally carries aggregate counts. Nulls are blank CSV cells, with explicit Unverified status. Formula-like prefixes (`=`, `+`, `-`, `@`, including leading whitespace) and leading tab/newline characters receive an apostrophe prefix before quoting. This is defensive spreadsheet handling, not a claim that every downstream parser is safe. Review exports before use.

Exports contain internal DNS names and timing evidence. Treat them as internal operational material. No secrets or record values are requested.

## Permissions, custody and network

- Required permissions: none. Admin consent: none. Authentication: none. API requirement: none. Microsoft 365 license requirement for this worksheet: none.
- Tenant access/writes: none. No upload, import, fetch, analytics, remote fonts or storage APIs. Page state is memory-only. Downloads are explicit local browser operations.
- The page CSP denies content connections and form submission; modules and styles are same-origin assets. Static hosting still receives ordinary page/asset request metadata. There are no content network destinations.
- Inputs and outputs use DOM textContent / safe form properties, not interpolated HTML. No DNS input is included in URLs.
- Clear/reload is not secure erasure, deletion of downloads/originals, or DNS rollback. User/browser/OS download retention remains outside this tool.

## Source

- `public/tools/mail-dns-cutover/index.html` — restrained System8 Fluent-style shell, model/custody details, source/version/changelog.
- `public/tools/mail-dns-cutover/core.mjs` — pure dependency-free ESM calculations, validation and export serialization.
- `public/tools/mail-dns-cutover/app.mjs` — memory-only structured row workflow, explicit calculation/download/clear, error handling and stale invalidation.
- `public/tools/mail-dns-cutover/style.css` — navy shell, blue actions, system fonts, responsive forms and scrollable results.

## Verification

```sh
node --test tests/dns-core.test.mjs
node --test tests/dns-core.test.mjs tests/dns-browser.test.mjs
```

Browser tests default to `DNS_TOOL_URL=http://127.0.0.1:3363/tools/mail-dns-cutover/`. They use Playwright from sibling `/home/hermes/projects/system8-m365-dashboard/node_modules/playwright` and Chromium headless shell from sibling `test-results/playwright-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`. Override with `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_EXECUTABLE`. No browser install or network access is needed when these prerequisites exist.

Browser regression prerequisites and URL overrides are documented in the repository README. Tests use synthetic `.test` names only; no live DNS or tenant checks are implied. Operational release evidence is retained separately, outside the public source tree.

