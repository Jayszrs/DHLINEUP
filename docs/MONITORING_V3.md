# Monitoring fleet and OCC JHO

The current brief replaces the first single-model animation with a date-specific fleet explorer. Cards use white working surfaces, semantic colored text, and a quiet orange/gold outline. The main product remains DHOCC; the operational group and page are named Recap DH Line Up and DH Line Up.

Speed visualization reads the selected date from actual daily recaps. Each recorded DT has its own unit, weighted average, moving average, maximum, sample count, and date-specific report link. On October 23, 2026 the source contains 214 DTs with records. The scene pages through 12 models on wider viewports and 4 on compact viewports; search addresses all units, not just the currently rendered models. Coordinates are illustrative, not live GPS positions.

Line Up visualization shows selected-date assignments requiring follow-up, preserving each original DH/Mine/FTW value. Names, equipment codes, and detail links come from stored assignments. A negative status is not presented as proof that a driver failed to attend or submit a form. October 16 has no stored Line Up assignments; the current dataset starts October 26, so the earlier date has an honest empty state.

The OCC JHO module uses only CCTV Availability, Inventory Availability, and Inventory OCC from the user's spreadsheet. Its initial snapshot has 38 asset records, 50 known physical units, 66 CCTV dates, and 66 inventory-check dates. The daily inventory tracker has 20 device labels; a label can represent multiple physical units. Not Checked and future planned rows remain unknown and do not inflate availability. The original spreadsheet is read-only for this integration.

The OCC room is an illustrative WebGL diorama based on the supplied photograph: opposing desks, operator workstations, chairs, rear video wall, pendant lights and orange overhead framing. Pixel and smooth variants share the same source category totals. Five category hotspots lead to the corresponding inventory records. Asset identifiers shared by a PC and monitor are allowed; they represent separate records.

New forms add/edit assets and daily CCTV/device checks. Existing editor permissions, CSRF, optimistic versions and audit apply. Source imports are revision-aware and preserve manual edits. Documentation hyperlinks are extracted from the three allowed source tabs, not synthesized from display labels.

Design: ENERGY 2 / RHYTHM 2 / MOTION 2. UI/UX Pro Max's verified Data-Dense Dashboard style and shared-material Three.js guidance inform layout and performance; the user's white/gold direction takes precedence over generic palette recommendations. Antislop is applied during implementation. REA records controlled browser render evidence; interactive scenarios and responsive checks use isolated fixtures.

Reduced motion, explicit pause, offscreen/background-tab suspension, camera reset and keyboard-operable labels are supported. On WebGL failure, original report links remain usable. The OCC room renders on interaction instead of continuously consuming GPU time.
