# System8 Microsoft 365 tools

Static browser-local tools and attributed source downloads. Published archive: https://365.system8.com.au/tools/.

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
