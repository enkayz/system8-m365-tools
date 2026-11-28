# Exchange Forwarding Route Review

Version 1.0.0 — 2026-11-28. Static browser-local metadata review; no real-tenant verification.

Purpose: Trace routes and cycles in a supplied list of mailbox forwarding settings.

## Input contract

Custom reshaped UTF-8 CSV, not a native Exchange report/export. Header is exactly `Mailbox,ForwardTo`, in that order and case. 1–500 unique Mailbox rows; exactly two fields each. A final LF/CRLF is allowed, extra blank rows are not. Strict quoted CSV, doubled quotes, UTF-8 BOM and CRLF supported. Malformed quoting, extra columns and bare CR outside quoted fields fail closed. Files are decoded with fatal UTF-8 validation; paste is measured by UTF-8 encoded byte length. Maximum 1,048,576 bytes including a supplied BOM.

Both fields use bare ASCII dot-atom email syntax, at most 254 characters, local part at most 64 and domain labels at most 63 characters with alphanumeric boundaries and optional internal hyphens. No whitespace, SMTP: prefix, display names, quoted local parts, domain literals or non-ASCII. Format is validated before the entire address is lowercased; no trimming or token repair. Mailbox is required; an empty ForwardTo explicitly means confirmed no forwarding in this supplied data. Duplicate normalized Mailbox values always reject, even with identical targets. No DNS, existence or deliverability checks.

Before Review the user must confirm one effective mailbox-level SMTP target per row, aliases resolved to listed canonical mailbox addresses, and blank only for confirmed no forwarding. This is not automatic raw ForwardingAddress / ForwardingSmtpAddress precedence interpretation. Input acquisition, authorization, reshaping and canonicalization belong to the operator.

## Algorithm and output contract

Sort starting mailboxes by normalized ASCII address. From each, follow exact normalized targets until:
- **Listed stop**: the last node is supplied and has a blank target.
- **Unlisted target**: the last node has no supplied row. This says nothing about whether the target is external or what it does next.
- **Cycle reached**: a node repeats. The full route includes the closing repeated node. Cycle entry is that repeated node; cycle members are the intervening distinct nodes, in encounter order. Starting-mailbox membership explicitly distinguishes upstream starters from cycle members.

Links equals route entries minus one, including the closing repeated edge. A blank-target starter has zero links; a self-cycle has one. Every supplied starter gets its own full route, including shared tails. The operation rejects completely if the sum of route entries exceeds 50,000. There is no partial output or silent path truncation; reducing input scope loses context and is disclosed.

Select any listed mailbox to show which starting routes traverse it. Its own starter is excluded by default and can be explicitly included. This is route membership, not a unique-sender count or message-flow measurement. View shows the first 100 matches, with full counts. Each row has keyboard-operable full-route details and wrapping addresses. JSON and CSV always export every result independent of the filter. JSON includes normalized input and structured routes; CSV includes full routes, links, cycle members and membership. Formula-like cells beginning `= + - @ tab CR LF` receive an apostrophe before CSV quoting. JSON preserves normalized values. Both exports include scope limitations.

## Custody and permissions

No sign-in, OAuth, admin consent, API, tenant role, license or privileged action is needed for this local operation. No live tenant/email/policy access or writes. No network APIs, analytics, cookies, local/session storage, IndexedDB, caches, service worker, external fonts or runtime dependencies. Static hosting still receives ordinary page/asset request metadata. Source opens only on explicit click.

Input, parsed data and results live in page memory. Select a file to load locally, then explicitly Review; never auto-review. Invalid file reads preserve prior text but withdraw previous results. A revision ticket prevents older asynchronous reads overwriting edited text, newer files or Clear. Every input edit, confirmation change, file replacement and Clear invalidates results and exports. Filters do not alter the reviewed dataset. Clear/reload discards page state, not original files or previous downloads. Exports contain internal addresses; handle accordingly. No tenant change occurs, so there is no tenant rollback.

## Limitations

Metadata graph only, not security, readiness, actual mail-loop or delivery verdict. Exchange loop prevention and policies mean a graph cycle does not prove endless looping or mail loss. No alias resolution, group expansion, inbox rules, transport rules, contacts, delivery-copy setting or forwarding-blocked analysis. No inference beyond supplied rows. No real tenant verification claimed. Releases require independent exact-tree review and coordinator-owned integration/publication; the local tool has no deploy or tenant execution function.

## Local verification

```sh
node --test tests/forwarding-core.test.mjs
FORWARDING_TOOL_URL=http://127.0.0.1:3380/tools/forwarding-route-review/ \
FORWARDING_EVIDENCE_DIR="$PWD/receipts/2026-11-28/build-final-browser" \
node --test tests/forwarding-browser.test.mjs
```

Browser tests default to port 3379 and use the sibling programme's installed Playwright and Chromium paths; `PLAYWRIGHT_MODULE` / `PLAYWRIGHT_EXECUTABLE` override them. Evidence directory must be fresh and absolute (evidence writes are exclusive). Core tests use an existence assertion rather than an import error for the initial missing module RED. Incremental RED/GREEN logs: `receipts/2026-11-28/build-01-*` through `build-07-*`. Synthetic test inputs are isolated in tests, not preloaded in production. Captures cover real review, reverse traversal filter, details, downloads, keyboard, desktop 1440 and mobile 390/320. Custody checks instrument network and storage APIs.

## Direction contract

Operate: extend the existing System8 Fluent/M365 shell, not a new visual identity. Navy header (#142c48), white header links/focus, blue actions (#0759ac), light task surfaces, Segoe UI/system stack. Primary viewport shows purpose and editable CSV with local file option. Nearby preparation help is progressive; scope confirmation precedes Review. Results prioritize precise routes and explicit upstream-versus-cycle membership, not a decorative graph or marketing. Native disclosure details preserve keyboard behavior. Finish is bounded desktop/mobile inspection plus independent exact-tree review by the coordinator. Existing programme design and routing files remain untouched.

## Changelog

- **1.0.0 — 2026-11-28:** strict normalized CSV review, complete route/cycle tracing, route-through-mailbox selection, full JSON/formula-protected CSV exports, local file race protection and responsive local-only UI.
