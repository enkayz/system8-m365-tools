# System8 Microsoft 365 tools

Static browser-local tools and attributed source downloads. Published archive: https://365.system8.com.au/tools/.

## SharePoint Path Budget — 1.0.0 (2026-11-22)
Compare two proposed SharePoint destination folder prefixes against one relative file-path inventory. Enter literal decoded prefixes after the hostname slash, without leading/trailing slash (for example `sites/Finance/Shared Documents`), paste or open a UTF-8 `.txt` list containing one relative FILE path per line, and check. Review signed headroom, required reductions and exact/ASCII-case/file-as-folder conflicts with related line IDs. B is optional. Export every row as JSON or formula-protected review CSV; filtering does not remove exported rows. No automatic rename, upload, filesystem scan or tenant access.

Limits: 1 MiB UTF-8 / 5,000 physical lines including blanks (one final terminator allowed); 4,096 UTF-16 code units per prefix; 50,000 related-line references before fail-closed rejection. Reduce repeated/conflicting entries and recheck the combined list; splitting alone hides cross-batch conflicts. No silent decoding, trimming or slash repair. Count = prefix + slash + relative path, excluding hostname and its following slash. Microsoft's documented 400-character decoded-path maximum is modelled with UTF-16 code units; all non-ASCII paths/prefixes require manual destination validation. Percent sequences remain literal. No comprehensive name/reserved-name, file-size, destination content/existence, desktop sync, permission or migration-readiness assessment. Shortening a prefix does not resolve listed conflicts. Obtaining an authorized inventory remains separate.

No local-tool sign-in, M365 permission, admin consent or additional license. Memory-local inputs/results; no content destinations, storage, analytics or runtime dependencies. Hosting sees normal static request metadata; deliberately opened source/reference links contact those sites. Clear/reload loses page state, not original files/downloads. Downloads contain internal paths. No tenant operation or rollback exists. Browser suite URL: `PATH_BUDGET_TOOL_URL`, default port 3362. Sources are served without transpilation/build dependencies.

## License Assignment Reconcile — 1.0.0 (2026-11-21)
Compare expected and observed Microsoft 365 user/SKU pairs for a human review handoff. Open or paste two authorized UTF-8 CSV lists, each with exactly `UserPrincipalName,SkuId` headers and one pair per row. Confirm the same tenant/scope, compare membership differences, filter rows and explicitly download normalized JSON or formula-safe review CSV. No tenant connection, Graph permissions, admin consent or product license is required for local comparison. Acquisition of exports is separately authorized and outside the tool; native exports may need local reshaping to this schema.

Each side requires 1–5,000 assignment rows and at most 1 MiB UTF-8. ASCII UPN syntax is documented in the page. UPNs are trimmed/lowercased; exact GUID SKUs are validated then lowercased; part numbers remain case-sensitive. No GUID-to-part-number mapping, empty-inventory comparison, effective-entitlement/service-plan/assignment-path/consent assessment, price or completeness claim. Duplicate pairs count once, with counts disclosed. Extra columns, malformed data and unsupported identities are rejected. CSV is a protected review export, not a round-trip or tenant import; JSON retains exact normalized identifiers.

Memory-local input/results; no content network destinations, storage, analytics, authentication or runtime dependencies. Clear/reload loses page state, not original files or previous downloads; no heap-erasure guarantee. Hosting sees ordinary asset request metadata. Downloads contain identities and require appropriate internal handling. No tenant mutation or rollback, and no real-tenant test is claimed. New browser tests use `LICENSE_TOOL_URL` (default loopback port 3361); the permission-review suite uses `TOOL_URL` (default 3359).

## Permission Change Review — 1.0.0 (2026-11-19)
Compare configured permissions in two Entra app manifests and record a review of the changes. Select local files or paste JSON snapshots for the same appId, compare, review changed entries and explicitly download the JSON packet. No sign-in, OAuth, admin consent, Graph permission or product license is required for the comparison. Obtain manifests only through an authorized customer process. Names remain unresolved. Configuration is not consent/effective access; removals do not revoke grants. Downloads retain selected IDs and reviewer notes, not arbitrary manifest fields.

Inputs and notes remain in page memory; clear/reload discards them, not original files or prior downloads. No content upload, persistence, analytics, remote font or runtime dependency. Static hosting receives ordinary asset request metadata. No tenant operations exist and no live tenant validation is claimed. Limits: 1 MiB per snapshot, 200 resource blocks, 2,000 configured entries, 2,000 characters per reason. Review decisions are notes, not approval enforcement.

## Imported query
`public/tools/redirect-uri-audit/` contains the unchanged `Audit-RedirectURIChanged.kql` and MIT license from enkayz/Sentinel-Queries at commit `96b1908558c5d5201dbf61c63cedce4c53e8f672`, originally reprise99/Sentinel-Queries. Copyright (c) 2024 reprise99. This is a source download, not a browser tenant query. Its page explains customer workspace, AuditLogs, access/licensing and coverage limits. Not run against a real workspace by this programme.

## Local verification
Node.js 22+; no production package dependencies or build/transpilation. Serve the public folder on loopback:

```sh
python3 -m http.server 3359 --bind 127.0.0.1 --directory public
node --test tests/*.test.mjs
```

Browser tests require Playwright and Chromium installed separately. Set `PLAYWRIGHT_MODULE` to the installed module directory and `PLAYWRIGHT_EXECUTABLE` to your Chromium headless-shell binary. Defaults refer to the existing sibling dashboard installation on the build host. `TOOL_URL` overrides the review tool URL for HTTPS production smoke. Test manifests are synthetic, isolated from production. Tests include exact GUID validation, malformed/oversized input, secret-field exclusion, tuple deltas/duplicates, explicit downloads, file races, keyboard flow, desktop/mobile viewports and memory/network custody. Browser viewport checks are not physical-device or real-tenant checks.

## Release and rollback
Public static files are only `public/tools/`; source tests and this README are separate from served assets. No operating receipts, internal research, customer data or credentials are published. Freeze a SHA-256 manifest of public assets, tests, this documentation and the nginx candidate before independent review. Recheck it before commit and promotion. Serve only exact reviewed routes, not a directory catchall. Static release promotion uses an immutable directory plus atomic `tools-current` symlink; the dashboard's `current` link stays untouched. Preserve the previous tools link and nginx configuration outside nginx includes; on failure restore the previous link/configuration, validate nginx and reload. The first deployment has no previous tools link: remove only the new programme-owned link and restore the pre-tools nginx config. Never remove the dashboard or relax its authentication/CSP/routes.

Copyright 2026 System8 for new programme source; all rights reserved except the separately attributed imported query under its supplied MIT license.
