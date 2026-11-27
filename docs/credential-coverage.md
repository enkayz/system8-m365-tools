# Entra Credential Coverage

Find gaps and overlapping validity periods in a supplied list of Entra app credentials.

## Use

Open `/tools/credential-coverage/`, paste CSV metadata or open a UTF-8 CSV, enter an explicit UTC review horizon, then choose **Review coverage**. The page starts empty. No example or tenant data is loaded automatically.

Required CSV header, with exact spelling and order:

```csv
AppId,Kind,CredentialId,StartUtc,EndUtc
```

- `AppId` and `CredentialId`: exact hyphenated 36-character GUIDs. Validation precedes lowercasing. Whitespace, braces and other repaired forms are not accepted.
- `Kind`: exactly `secret` or `certificate`. These kinds are never combined or treated as interchangeable.
- `StartUtc` and `EndUtc`: exact minute UTC timestamps, such as `2026-11-27T00:00Z`. Years 2000–2099, real calendar dates, and start strictly before end. Date-only values, seconds and offset forms are rejected rather than converted.
- Duplicate credential IDs within one AppId/kind group block review, even when their dates differ. Reconcile duplicates in the source. The same ID in a different application or kind is a separate group.
- At least one metadata row is required; a header-only file is missing evidence, not zero coverage. Unknown columns and malformed rows block the whole review. UTF-8 BOM, quoted fields, CRLF and LF line endings are accepted. Blank records are not silently discarded.
- Bounds: up to 1000 metadata rows, 1 MiB UTF-8 text/file, a positive horizon of at most 366 elapsed days, and the same 2000–2099 minute-UTC rules for horizon dates. Credential dates may extend beyond the horizon, within the accepted year range.

Supply only non-secret metadata. Never provide secret values, access tokens, certificate bodies or private keys. Obtain metadata separately using an authorized workflow. This tool does not read a tenant or grant authority to obtain metadata.

## Results and calculation

Only supplied AppId/kind groups are reviewed. Each group is partitioned into non-zero-length windows across the entire horizon. A validity interval includes its start and excludes its end: `[start, end)`. Adjacent credentials are continuous at their shared boundary without overlapping there.

- **Gap**: zero supplied credential IDs active in that group.
- **Single credential**: one supplied ID active.
- **Overlap**: two or more distinct supplied IDs active. Overlap minutes count elapsed time once, not once per credential pair.

Windows split whenever the active ID set changes. Adjacent overlap windows can therefore have different supporting IDs. Group totals include gap, covered and overlap minutes; overlap minutes are a subset of covered minutes, not additional coverage. Each group's gap plus covered minutes equals the horizon duration. Do not sum group totals as a tenant-wide duration.

Evidence retains each original interval and its clipped boundaries. A completely outside interval has relation `outside` and null clipped boundaries, and contributes no coverage. Partly clipped and fully within rows remain distinguishable. A group with all evidence outside the horizon has a full-horizon gap; absent applications and kinds are not inferred.

The interface shows at most 100 rows in each of its group, window and evidence tables, and at most three supporting IDs per visible window. Each table discloses its full row count. Narrow screens show labelled row fields, including complete UTC dates and durations; wider tables are keyboard-focusable scroll regions.

## Downloads

Downloads require an explicit button action after a valid review:

- `entra-credential-coverage.json`: tool/version, interpretation limits, horizon, all normalized metadata, every group, full window ID sets and original/clipped evidence.
- `entra-credential-coverage.csv`: all group, window and evidence records in one rectangular table, distinguished by `RecordType`; includes horizon fields and interpretation limits. `Relation` holds a window type or evidence relation, as appropriate. Window IDs are semicolon-separated. Empty clipped fields mean outside the horizon, not an unknown zero timestamp.

CSV cells are quoted and formula-like values are apostrophe-prefixed for spreadsheet review. It is not a tenant-import format. JSON preserves normalized selected metadata. Both files contain identifiers and should be handled as internal.

Any input edit immediately withdraws results and disables both downloads. Starting a file read also discards the prior metadata; failures never fall back to it. Changing any input or clearing cancels a pending read logically so its late completion cannot replace current evidence. Clear discards text, horizon, selected file, results, errors and outstanding download object URLs. Reload starts empty. Original files and earlier downloads are unchanged; no guaranteed memory erasure is claimed.

## Interpretation and authority

This reports **metadata validity only**. It is not proof of usable credentials, actual authentication, application rollout, certificate/secret interchangeability, revocation status or an outage. No live checks, expiry alerts, background polling, authentication probes, scheduling or rotation action occur. Source completeness cannot be established here.

Permissions, sign-in, admin consent, API access and additional licensing required for the local calculation: **none**. Acquiring metadata is a separate authorized activity, outside the tool. No tenant change is performed, so there is no tenant rollback operation.

## Data custody

Inputs and results are held in this page's memory only. No uploads, content network destinations, storage persistence, analytics, remote fonts or runtime dependencies. Static hosting receives ordinary page/asset request metadata. Local file reads are limited before decoding, and invalid UTF-8 blocks import. Errors do not reflect entered rows, filenames or file-read exception details. Rendering uses text nodes, not HTML parsed from input. The page's CSP denies connections, forms, frames and unlisted resources.

## Local verification

Serve the existing `public/` directory without changing any production route:

```sh
python3 -m http.server 3377 --bind 127.0.0.1 --directory public
```

In another shell, from the project root:

```sh
CREDENTIAL_TOOL_URL=http://127.0.0.1:3377/tools/credential-coverage/ \
CREDENTIAL_EVIDENCE_DIR="$PWD/receipts/2026-11-27/build-your-fresh-run" \
node --test tests/credential-*.test.mjs
```

Use a fresh absolute evidence directory for every run; browser artifacts use exclusive writes. The browser suite imports Playwright from the sibling dashboard installation by default. `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_EXECUTABLE` override that local test installation. They are test-only dependencies; the served tool has no runtime dependencies.

Coverage includes strict schema/GUID/time validation, duplicate and size/row bounds, application/kind separation, boundary and clipping arithmetic, seeded minute-oracle comparisons, 1000 nested credentials, complete protected exports beyond display bounds, stale-result withdrawal, file failures and delayed-read cancellation, clear/reload, hostile text, desktop/mobile keyboard operation and memory/network custody checks. Browser automation is not physical-device, formal accessibility or tenant verification.

Version 1.0.0 · 27 November 2026. Publication and independent exact-tree acceptance are separate programme gates, not established by this local build.
