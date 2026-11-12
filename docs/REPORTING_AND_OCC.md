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

Six illustrated colleagues use the names, NIKs, roles and confirmed character variants provided by the user. The latest visual layout is six desks (two front near the meeting table, four rear near the entrance); the spreadsheet still has eight workstation asset records and fifty known physical-inventory units. Neither inventory total is rewritten to match illustrative furniture.

Apply `node-app/database/occ-team.sql` before deploying the team profile routes. The additive private table stores only bio, manual profile status, optional team photo path and optimistic version by the six known NIKs. User identities and roles stay canonical. A uniquely matched account can supply its existing profile picture; team uploads never overwrite account photos. `/occ-team-photo` is authenticated, and profile writes require data editor permissions plus CSRF. Local multipart and existing signed photo-upload tickets are supported. Missing portraits are labelled, never synthesized.

The model factory supplies unit plates from the actual selected DT code. Its shared static geometry has no baked reference unit number. Repeated Line Up assignments for one date/unit share one visual truck while retaining each source assignment's driver, shift and detail link. Haul-truck cargo is illustrative model geometry, not a load-status observation.

## Room schedule simulation

`occ-schedule.js` owns the deterministic WIB timetable (08:00–17:00, lunch 12:00–13:00) and bounded aisle routes. `occ-activity.js` controls seated/walking rigs, unique break destinations, work monitor materials, room lighting, an illustrative floor-32 city context, and the agenda display. Reduced motion uses the destination pose rather than requiring travel animation. Manual Cuti/Tidak bertugas profiles remain hidden in the room simulation; editable profiles and source inventory remain accessible.

The room date is independent of the inventory inspection date. The backend reads existing meeting records in a seven-day window for the display, while the meeting list still shows only records overlapping the selected calendar day. No meetings, attendance records, device states or inventory rows are created by simulation controls. Meeting titles and HTTPS links come from saved records. The diorama does not imply actual attendance or real device power telemetry.

The front workstation row is physically nearer the videotron/conference area (two desks at z=3.2); the rear row is nearer the entrance (four desks at z=6.7). Office staff use a dedicated smooth, helmet-free model for seated and walking states, including all previews. Mine-driver PPE is unchanged. Canonical team desk IDs, actual uploaded portraits, and source asset counts are preserved.

## Dashboard date and asset revisions

Dashboard `work_date` filters the headline cards, checks and selected driver scene. Historical rows are retained separately for periods and the eight-day trend, always bounded by the selected date. Legacy `scene_date` links remain supported; the explicit report date takes precedence. An empty selected day never falls back to the latest nonempty date. The reset shows all dates.

`prepare-assets.js` fingerprints source scripts, styles and templates, exports the version with generated templates, and versions relative module imports in the published asset graph. Entry JS/CSS URLs carry the same version; logos, font and evidence paths remain stable. Keep the static source tree unmodified during builds.

The public Mintegra operation bundle inspected in this session uses Esri imagery plus authenticated, site-specific image overlays (`master/map-image`, image path and upper-left/lower-right coordinate bounds). The user has no overlay/KML/GeoJSON files. REA static analysis was attempted but reported heap limits on the large bundles; the concrete layer behavior was confirmed by focused, inert source inspection, not authenticated runtime access. No credentials or proprietary map imagery were copied into the app. Playback retains original GPS; missing road geometry does not authorize fabricated map matching. Reindex segment breaks whenever anomalous readings are excluded.

The Express asset handler applies the same import versioning when the platform serves source assets through the function instead of the published static directory. It resolves only JavaScript files inside the fixed frontend script root, caches transformed text per app instance, and never accepts a client-provided version as code. Production verification must compare served module content and dependency versions, not only build output.

## Day and Night Shift

Night Shift support is prepared for future input/import; the user confirmed that no Night Shift source file is available yet. Never derive Night Shift records from Day Shift assignments. Dashboard shift filters apply to cards, history, periods, the selected driver scene and links; exports already use the same shift filter. Import `fallback_shift` fills only absent/empty shift cells. Explicit D/N/Day Shift/Night Shift values in the file win.

`node backend/cli/prepare-source-shifts.js` previews classification of the user-confirmed legacy Day Shift seed rows. `--apply` backs up rows privately, locks matching records, skips identity mismatches, existing explicit shifts and unique-key conflicts, changes only unknown shift to D with an optimistic version bump, and logs the batch. It verifies all source fields and total record count are unchanged. The operation is idempotent and creates zero Night Shift records.

The room has 10 conference microphones (four left, four right, two across the middle) and six hanging speakers above the conference area. Workstation previews and scene geometry contain no microphones. Staff keep the canonical six identities and desk ordering. Office character models use a rounded clay style inspired by the supplied raster reference, not an imported GLB or a real portrait; the three female variants are illustrative. JHO staff remain helmet-free.

When orienting a cloned Three.js object, set all Euler axes together (`orientCharacter`), because quaternion-to-Euler decomposition can leave x/z at ±π. Setting only y to π on that clone can face the staff away from the monitor. Regression checks cover both initial layout and work/walk/meeting controller behavior.

Mouse wheel and Ctrl-wheel trackpad gestures are handled inside the 3D viewport. Main/preview render buffers are capped at 2.4/3 megapixels; previews render animated states at 30 fps and suspend when hidden or reduced motion is active. Cached geometry/materials and baked static furniture remain shared.

The shared crew-character factory now supplies an original animated-feature style for both office staff and mine drivers. It keeps eye rigs outside the static head bake to support per-clone blinking, while cached buffers/materials stay shared. Office staff remain helmet-free; mine drivers retain white safety helmets, with a radio/crossed-arm pose for the male reference and a tablet pose for the female reference. No real portrait, staff identity, attendance data or source record changes with this visual revision.


The 12 November 2026 revision uses the user-supplied DHLINEUP_3D_CODEX_V3 source for worker and truck geometry. Staff 1–4 occupy the four rear desks; staff 5–6 occupy the two front desks, following the red numbers on the supplied screenshot. JHO people remain helmet-free and retain real profile links, schedule motion and independent rigs. All visible DT plates use the actual validated unit, never the reference image ID. The authenticated `/3d-preview` page is a visual-only demo with an explicit example number and the unchanged approved static reference.


The character refinement adds a dedicated `dh-premium-characters.js` factory, preserving the source-pack API. Faces, hair, eyelids, uniform surfaces and ergonomic mesh chairs are remodeled; office work and relaxed portrait poses use separate cached rigs. Work hands reach the keyboard, portrait hands rest on the lap. The profile viewer defaults to a closer face/torso view with a full-body toggle and a toolbar below the canvas. Six identities, physical desk ordering, source inventory, source images and real profile/photo linkage remain unchanged. Tiny surfaces use lower tessellation and shared finish groups; model-budget and work/portrait wrist-position regressions are covered by tests.


## CCTV daily reporting (12 November 2026)

The dedicated `/occ-cctv` dashboard reads numeric daily reports for ACP, KCP, BCP, BPP, HO and SSCP. Source: CCTV Availability All Site, spreadsheet `1HuqMh0XZyCknIT-2w4hcpVq14Yb10_O76CevWwJu7rE`, Sheet1 (`gid=2101606077`). The verified import covers 31 July through 12 November 2026: 568 site/day rows. SSCP has 62 missing days before October; these remain unknown, never fabricated as zero or 100%. The original totals, down/ON counts, percentage labels and Remarks are retained even where camera names and down counts disagree. Such rows have a visible verification note. Offline duration and evidence absent in the source remain empty.

New reports use unique camera names to derive down, ON = total - down and availability = ON / total. Availability below 60% is marked poor. Duration is independently entered per camera (0?1440 minutes/day), not used to invent a time-weighted availability formula. Editing a historical count requires an explicit recalculation checkbox; the source snapshot and audit history stay retained. Report versions prevent stale overwrites. Changing site/date requires loading that report before saving.

Authenticated evidence accepts validated PNG/JPEG/WebP images (5 MB) and MP4/WebM media (20 MB), at most four attachments per camera and twenty per report. Supabase remains private. Upload tickets are bound to the current editor and consumed once. Viewing evidence requires report access; video can use byte ranges locally and short-lived signed URLs in Supabase. Evidence is hosted in the website, with no Drive redirect. Spreadsheet imports never overwrite existing site/day reports.

Six independent site charts appear above history, with a 60% reference and source-value tooltips. Date/site filters apply to history and full Excel exports; camera search refines history/export details. Latest-day counts and period-weighted availability are labelled separately. The shared SVG chart component also covers Line Up daily trends, weighted speed averages, OCC inventory check coverage and HO CCTV history. Missing readings stay unknown. Charts support pointer inspection, keyboard arrows, responsive sizing and multi-series visibility without a chart framework.

Import CLI: `node backend/cli/import-cctv.js <source.json>` validates without database writes; append `--apply` with the database environment to import idempotently. The package contains matching `spreadsheetId`, formatted `values` and unformatted `raw_values` from the same Sheet1 range; importing does not modify Google Sheets.
