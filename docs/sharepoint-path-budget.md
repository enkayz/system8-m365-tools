# SharePoint Path Budget — 1.0.0

Internal implementation handoff, 2026-11-22. Runnable static source: `public/tools/sharepoint-path-budget/`. Not published by the builder; coordinator owns inventory, archive, source publication, deployment and independent exact-tree review.

## Purpose and direction contract

Operate mode for Microsoft 365 practitioners comparing two proposed destination prefixes against the same exported relative FILE-path list, without filesystem or tenant access. The handoff retains per-file lengths, signed headroom, required reductions and within-list conflicts that shortening a prefix cannot fix. It is not a broad migration scanner.

THESIS: two destination scenarios over one unchanged inventory, with explicit row-level handoff rather than a success score. OWN-WORLD: existing System8 Fluent shell, navy header, light task surfaces, Segoe UI/system fonts, blue actions, semantic controls and focus outlines. STORY: enter prefixes → paste/import list → check → review/filter → explicitly download. FIRST VIEWPORT: title and purpose followed immediately by paired prefix fields and one file-list editor; no preloaded synthetic data. FORM: brief-pinned code-led Operate extension; no concept tournament. FINISH: builder supplies actual tests and desktop/mobile captures; coordinator dispatches independent exact-tree review after freeze. No DESIGN.md exists in this project; incumbent visual system was read directly and is not rewritten.

## Exact input contract

- A is required; B is optional only when exactly empty. Prefixes are literal decoded server-relative destination folder paths without leading/trailing slashes, e.g. `sites/Finance/Shared Documents`. Hostname and its following slash are not counted. No full URLs, colon, query/fragment delimiters, backslashes, controls, outer whitespace, empty segments or dot/traversal segments. Prefix existence is not checked.
- Each nonempty physical line is one relative FILE path, including filename. Slash separators only. CRLF and LF line separators supported. A final terminator is allowed. Blank means exactly empty, not whitespace-only. Empty lines are counted and ignored, retaining original one-based physical line IDs for files.
- Paths reject leading/trailing slash, outer whitespace, leading drive syntax, backslash, C0/C1 controls, empty segments and `.`/`..`. Relative `#` and `?` are literal, not URLs; name validity is not assessed. Commas and quote marks are literal. There is no CSV parser, URI decoding, trimming, slash replacement, case normalization of returned values, BOM removal or repair.
- Destination prefixes are limited to 4,096 UTF-16 code units; 50,000 related-line references is a fail-closed total work/output cap. Reducing repeated/conflicting entries and rechecking the combined list is required; splitting alone can hide cross-batch conflicts. Coordinator added resource-red.log / resource-green.log before freeze.
- List maximum: 1,048,576 UTF-8 bytes and 5,000 physical lines, including blank lines, plus one final empty split token for a trailing terminator. Textarea has the same byte/line bounds as import.
- Import: local filename ending `.txt` (case-insensitive), maximum 1 MiB before reading, fatal UTF-8 decode. A BOM remains literal and is rejected as outer whitespace rather than silently removed. Parsed invalid imports preserve previous text but invalidate the previous result and block comparison until another import or a text edit.
- No broad invalid/reserved-name validation, filename-extension inference or folder/file type discovery. The supplied list is explicitly a FILE inventory; a file without an extension remains a file.

## Calculation and conflict semantics

Reference: Microsoft Learn SharePoint limits, checked directly 2026-11-22: `https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-online-service-description/sharepoint-online-limits`. Exact retrieved passage is retained in `receipts/2026-11-22/build-source-check.txt`. Microsoft's entire decoded file path including filename must not exceed 400 characters. This implementation uses JavaScript UTF-16 code units as an explicitly disclosed conservative planning convention, not a claim of complete Unicode equivalence.

For each scenario: `length = prefix.length + 1 + path.length`; `headroom = 400 - length`; `reduction = max(0, length - 400)`. 400 is within budget; 401 requires reduction 1. B absent produces null, not zero. `resolvedByB` means A exceeds 400 and B does not; it does not clear conflicts or Unicode review.

Exact duplicate paths, ASCII-case-only full-path matches and listed file-as-folder prefix conflicts carry related physical line IDs on both affected sides. Matching folds A–Z only; non-ASCII is not broadly casefolded or normalized. Every row whose path or either supplied prefix has non-ASCII code units is flagged for Unicode manual destination validation, including non-BMP/surrogate names. Conflict relationships do not depend on root length. Prefix detection uses a segment trie to avoid quadratic work on deeply nested literal paths.

`needsReview` is true for either compared over-budget scenario, any listed conflict or Unicode uncertainty. It does not mean other rows are migration-ready. Exports include all rows even when review-only filter is selected.

## Exact JSON schema (schemaVersion 1)

Top-level fields:
- `schemaVersion`: 1; `toolVersion`: `1.0.0`; `limit`: 400.
- `countConvention`: explanatory string; `scope`: budget-only disclaimer string.
- `rootA`: exact supplied string; `rootB`: exact string or null.
- `ignoredBlankLines`: number of empty split lines (includes an empty token after a final terminator).
- `counts`: `{total, overA, overB, resolvedByB, review}`; `overB` null when B absent; others integer row counts.
- `rows`: original file order, one object per nonempty input line, retaining duplicate rows.

Row fields: `line` (one-based physical line number), `path` (exact literal string), `a` and `b` (`{length,headroom,reduction}`, B null if absent), `resolvedByB` boolean, `duplicateLines`, `caseLines`, `prefixLines` (numeric related line-ID arrays), `unicodeReview` boolean, `needsReview` boolean. No timestamps or customer-derived extra metadata are invented. JSON is two-space formatted.

CSV is CRLF, all cells double-quoted, embedded quotes doubled, header:

`line,relative_file_path,root_a,root_b,a_length,a_headroom,a_reduction,b_length,b_headroom,b_reduction,resolved_by_b,duplicate_lines,case_lines,prefix_lines,unicode_review,needs_review`

Absent B cells are empty. Related IDs use semicolons. Every cell beginning `=`, `+`, `-` or `@` is prefixed with an apostrophe (including negative signed headroom); exact original values remain in JSON. CSV is a spreadsheet-safe handoff, not a round-trip inventory import format.

## Custody, permissions and state

None: sign-in, Microsoft 365 permission, admin consent, tenant/API connection, additional local-tool license, upload, analytics, runtime dependency, browser persistence or automatic download. Ordinary static-host requests expose normal request metadata. User-opened external Learn/source links contact those destinations. Imports read only the selected local file. Downloads contain internal paths and must be handled internally. User authorization to acquire inventories remains separate.

Every input edit or fresh file selection immediately discards old results and disables exports. File reads use a monotonically increasing generation; typing in the list, replacing the file and Clear supersede old completion/rejection. Compare stays disabled during read or import error. Root changes during import invalidate results but retain the current file intent. Errors preserve editable inputs and do not display raw native read exceptions. Rendering uses textContent/createElement only; no input-composed links or innerHTML. Blob downloads occur only on explicit export clicks, and object URLs are revoked.

Clear/reload drops page-memory inputs/results only, not original files or downloads. No tenant changes occur and there is no tenant rollback.

## Out of scope

No check of all invalid/reserved names, file sizes, desktop/Windows/macOS sync limits, destination existence/content/collisions, permissions, completeness of exported inventory, Unicode collision equivalence, real-tenant acceptance or migration readiness. No auth or real-tenant verification is claimed.

## Reproduction and evidence

From project root:

```sh
python -m http.server 3362 --bind 127.0.0.1 --directory public
PATH_BUDGET_TOOL_URL=http://127.0.0.1:3362/tools/sharepoint-path-budget/ node --test tests/path-budget*.test.mjs
```

Browser tests reuse sibling dashboard Playwright and its installed Chromium executable, with no install or production runtime dependency. Browser URL is configurable using `PATH_BUDGET_TOOL_URL`.

Strict incremental cycles: `build-01-*` boundary/A-B core; `build-02-*` strict validation/physical line limits; `build-03-*` conflict/Unicode review; `build-04-*` explicit handoffs; `build-05-*` browser workflow; `build-06-*` file import/generation races; `build-07-*` literal punctuation/deep path behavior plus trie refactor. RED and GREEN are actual Node output, not constructed summaries. The complete new-tool suite is `tests/path-budget*.test.mjs`; final output is `build-final-tests.log`.

Browser assertions cover widths 1440/390/320, skip/focus navigation, keyboard-scrollable table, no body horizontal overflow, filter/all-row exports, actual downloaded JSON/CSV contents, malicious strings as text, boundary values, optional B, stale exports, clear/reload, strict UTF-8/.txt/size/row failures, file race ordering, generic read failures, no runtime errors and exact static request set with no storage/cookies/IndexedDB/cache/service worker use. Screenshots are `build-path-budget-{1440,390,320}.png`; their table position is intentionally horizontally scrolled by the keyboard test. Actual synthetic downloaded artifacts are `build-handoff.json` and `build-handoff.csv`.

No publication, Git change, inventory/archive edit or independent review was performed by this builder. Historical receipt directories and prior tool assets were not modified. Programme-wide tests and independent release review remain coordinator gates; this builder ran the entire new-tool suite, not historical browser suites that overwrite past-date screenshots.
