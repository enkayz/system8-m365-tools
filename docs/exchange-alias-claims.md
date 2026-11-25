# Exchange Alias Claim Review

Version 1.0.0 · 2026-11-25 · System8

Check proposed SMTP address claims against your current recipient list and other requests. This is a browser-local evidence review, not a tenant query, availability check, approval or execution mechanism.

## Use

1. Obtain recipient/address evidence under separate customer authority. Flatten it locally to `RecipientId,Address`, one SMTP address per row. Strip only `SMTP:`/`smtp:` prefixes from SMTP values and exclude X500 and other address types. Include all relevant authorized recipient types (including groups and mail-enabled public folders) rather than only mailboxes.
2. Prepare requested claims in the same format. Use exact stable GUIDs from the same tenant and identity scheme, not display names or mixed object identifiers.
3. Paste each CSV or choose a UTF-8 file. Confirm the tenant/identity checkbox and select **Review claims**.
4. Review independent status flags. Filter by flag or search the address/requested GUID. The view shows at most the first 100 matching pairs; explicit JSON and CSV downloads always include every unique requested pair, regardless of filters.
5. Clear the inputs/review when finished. Clear cannot erase original files or prior downloads.

Illustrative format only (not tenant data):

```csv
RecipientId,Address
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa,team@example.test
```

## Comparison semantics

Both evidence lists must have data. Exact 8-4-4-4-12 hexadecimal GUIDs and whole SMTP addresses are lowercased. No surrounding whitespace is repaired. Duplicate normalized recipient/address pairs count once; duplicate counts remain in the review and exports. Repeated planned claims for the same owner do not create a competing-owner flag.

Each unique requested pair carries independently applicable flags:

- `current-other-owner conflict`: a different current GUID owns the same address.
- `multiple-request-owner conflict`: different requesting GUIDs claim that address.
- `current-same-owner`: the requester already appears as a current owner.
- `not seen in supplied current list`: no supplied current owner for that address; not an availability decision.

A same-owner match does not suppress either conflict flag. A missing address can still have competing requests. JSON holds one owner-set record per requested address and references addresses from review rows. CSV expands owner sets for human review.

## Limits and rejected input

- Each side: 1–5000 data rows (including duplicates), at most 1,048,576 UTF-8 bytes (1 MiB). Files are bounded before reading and decoded using fatal UTF-8. Oversized pasted evidence is rejected, not clipped into an apparently valid subset.
- CSV: exactly two columns with parsed headers `RecipientId,Address` in that order; quoted cells and escaped quotes are recognized. Optional UTF-8 BOM, LF/CRLF and one final newline are accepted. Extra columns, blank rows, malformed quoting and controls are rejected. Embedded field newlines are unsupported.
- Addresses: bare ASCII dot-atom only, local part ≤64 characters and address ≤254. Dotted DNS labels ≤63 characters, ASCII alphanumeric/hyphen, no edge hyphens. Common dot-atom punctuation is accepted; no leading/trailing/consecutive local dots. International/quoted addresses, mailto links, SMTP prefixes and non-SMTP address types are rejected. This conservative subset is not a complete Exchange address validator.
- Aggregate related owner references: at most 50000, calculated as the sum over requested addresses of `unique requesting owners × (existing owners + requesting owners)`. Exceeding it fails closed before rendering or export. Split by address while preserving complete competing claims and current evidence for each reviewed address; highly contended addresses may require review outside this tool.
- Visible review: first 100 matching rows, with explicit matching and total counts. Downloads are never filtered.

## Custody, exports and permissions

No sign-in, permissions, admin consent, license, tenant API or external runtime dependencies are required for local comparison. Inventory acquisition is separate and requires customer authority; its permissions are not supplied by this tool. No tenant reads/writes, generated execution scripts, transfer ordering or rollback operation.

No content uploads, analytics, persistent storage or content network destinations. The static host receives ordinary page/asset request metadata. CSP blocks connections and form submission. Untrusted strings are rendered through textContent, not HTML. Inputs/results stay in page memory. Editing either evidence input or the checkbox invalidates the result and disables both exports. File replacement clears that side before reading; failed reads clear old evidence and the file selection. Per-side generation guards ignore completions after text edits, replacement or clear. Review is blocked while a file read is pending.

Explicit JSON includes normalized input evidence, owner sets, independent flags, duplicate counts, confirmation, version and review notice. Explicit CSV includes all requested review rows, related owners, independent flags, duplicate counts and the review notice. Every cell is quoted; formula-leading cells receive an apostrophe. CSV is a review artifact, not a machine-import or action file. Both formats contain sensitive internal IDs and SMTP addresses.

Clear resets text, file selections, checkbox, validation, filter state and result references; it does not promise physical secure memory erasure or remove downloaded/original files. Reload and closing the page discard the working state.

## Interpretation boundary

Results cannot establish tenant uniqueness or live availability. Deleted, hidden, hybrid, mail-enabled public folder, Entra-only or unexported recipients may be excluded by the supplied evidence. Exports may be stale or incomplete. No primary SMTP, accepted-domain, policy, deliverability or transfer-order assessment is made.

Microsoft reference (retrieved by programme coordinator for this build): https://learn.microsoft.com/en-us/troubleshoot/exchange/email-alias/proxy-address-being-used . The reference is not a live validation dependency.

## Local verification

From `/home/hermes/projects/system8-m365-daily-tools`:

```sh
node --test tests/alias-core.test.mjs tests/alias-contract.test.mjs
ALIAS_TOOL_URL=http://127.0.0.1:3364/tools/exchange-alias-claims/ \
ALIAS_EVIDENCE_DIR="$PWD/receipts/2026-11-25/build-review-fresh" \
node --test tests/alias-browser.test.mjs
```

Use a fresh absolute `ALIAS_EVIDENCE_DIR` for each run: download evidence uses exclusive writes. Browser tests use the incumbent dashboard Playwright installation/headless shell, with optional `PLAYWRIGHT_MODULE`/`PLAYWRIGHT_EXECUTABLE` overrides. No browser dependency is shipped. The coordinator owns the already-running local preview, independent review and release; this build does not publish anything.

## Direction contract (development only)

Operate mode. Inherit the incumbent navy Fluent-like shell, blue explicit actions, light evidence surfaces, Segoe UI/system type, semantic controls and keyboard-visible focus. Practitioners use this at a desk or on a narrow browser in ordinary office light. Two evidence columns become a single column on mobile; the comparison is the focal result, not a score. Independent flags sit beside the requested GUID and both owner sets. The first viewport leads from plain purpose and local custody directly into evidence entry. Progressive details hold syntax, authority and coverage boundaries. Completion means local tests and desktop/mobile captures with an exact-tree handoff for independent review, not publication.
