# Reporting and OCC additions

Production root is `node-app`. Run `npm test` before publishing. Existing source recaps and spreadsheet links remain unchanged.

## Database rollout

Apply `node-app/database/reporting.sql` before deploying routes that read `speed_reporting` or `occ_meetings`. Local `initialize` applies it automatically. The migration is additive and idempotent; source tables are not rewritten.

`node backend/cli/prepare-reporting.js --apply` adds these objects and rebuilds only unverified anomalous recaps from private GPS archives. Verification requires matching original counts, moving counts, speed sum and maximum before excluding speeds >=80. Incomplete source days remain pending. Quality rows apply only while original version and all source metrics match; edits/imports cannot silently reuse stale quality. Source digests are compared before/after. The same reconciliation runs after an authorized speed import.

Default summary, day, month, unit and Excel results use this validated reporting view. Source recaps remain available in the export's verification sheet. Date boundaries are inclusive; unit navigation and exports retain them. Excel detail includes every matched DT/date, irrespective of UI table slices or pagination. Raw GPS archives are never fabricated from daily totals.

## Documentation photos

`prepare-occ-photos.js <verified-download-manifest> --apply` accepts a local manifest of original files read from the OCC documentation Drive folder. It validates/rotates/resizes images using Sharp, stores WebP bytes under deterministic private upload paths, verifies checksums and maps original Drive IDs in `app_settings.occ_photos_v1`. Existing asset photo URLs and source data are preserved. Do not commit photos, downloads, credentials or manifests.

Authenticated `/occ-documentation?id=...` and `/occ-photo?id=...&index=...` resolve an asset's own manifest entry; they do not proxy arbitrary remote URLs. Assets whose original link was the shared folder show the folder gallery. Individual file links resolve their own photo. Missing photos show an explicit empty state. Neither source spreadsheet nor Drive permissions are modified.

## Meetings and team

Meetings are application records, independent of the imported spreadsheet. Store timestamps with timezone; form and display use Asia/Jakarta. Editor access, CSRF, optimistic versions and audit logs govern writes. A short transaction locking the existing bootstrap setting serializes overlap checks. No external calendar messages or invitations are sent.

Six illustrated colleagues use the names, NIKs, roles and seating provided by the user. These are visual placement labels, not attendance records or photographic likenesses. Existing eight workstation and fifty physical-inventory totals are unchanged.
