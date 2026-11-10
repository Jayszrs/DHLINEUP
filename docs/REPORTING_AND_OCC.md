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

Six illustrated colleagues use the names, NIKs, roles and confirmed character variants provided by the user. The latest visual layout is seven desks (three front, four rear); the spreadsheet still has eight workstation asset records and fifty known physical-inventory units. Neither inventory total is rewritten to match illustrative furniture.

Apply `node-app/database/occ-team.sql` before deploying the team profile routes. The additive private table stores only bio, manual profile status, optional team photo path and optimistic version by the six known NIKs. User identities and roles stay canonical. A uniquely matched account can supply its existing profile picture; team uploads never overwrite account photos. `/occ-team-photo` is authenticated, and profile writes require data editor permissions plus CSRF. Local multipart and existing signed photo-upload tickets are supported. Missing portraits are labelled, never synthesized.

The model factory supplies unit plates from the actual selected DT code. Its shared static geometry has no baked reference unit number. Repeated Line Up assignments for one date/unit share one visual truck while retaining each source assignment's driver, shift and detail link. Haul-truck cargo is illustrative model geometry, not a load-status observation.

## Room schedule simulation

`occ-schedule.js` owns the deterministic WIB timetable (08:00–17:00, lunch 12:00–13:00) and bounded aisle routes. `occ-activity.js` controls seated/walking rigs, unique break destinations, work monitor materials, room lighting, an illustrative floor-32 city context, and the agenda display. Reduced motion uses the destination pose rather than requiring travel animation. Manual Cuti/Tidak bertugas profiles remain hidden in the room simulation; editable profiles and source inventory remain accessible.

The room date is independent of the inventory inspection date. The backend reads existing meeting records in a seven-day window for the display, while the meeting list still shows only records overlapping the selected calendar day. No meetings, attendance records, device states or inventory rows are created by simulation controls. Meeting titles and HTTPS links come from saved records. The diorama does not imply actual attendance or real device power telemetry.
