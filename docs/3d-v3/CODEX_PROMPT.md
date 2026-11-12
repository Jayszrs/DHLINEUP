# Current integration brief — 12 November 2026

The owner’s latest message and annotated screenshot take precedence over the supplied pack’s older defaults:
- Six JHO workstation desks: two front near the meeting table, four rear near the entrance.
- Follow the red numbers: rear left to right 1 Fassel, 2 Yasmine, 3 Shafira, 4 Marchyla; front left to right 5 Gregorio, 6 Jaelani. Preserve each supplied NIK, role, gender and real profile linkage.
- Office staff are helmet-free, face their PCs, and retain the existing work/break/meeting simulation. Mining workers keep white helmets.
- Integrate the pack's actual procedural source through the current shared factories and viewers. Refine smooth bodies, faces, seated/walking joints and truck surfaces. Do not replace GPS/data logic.
- Unit plates follow the validated actual DT on the canopy, grille and both sides; no fallback reference number on live models.
- Keep zoom, preview and fullscreen. No pause-animation buttons. Respect reduced motion and offscreen/hidden rendering suspension.
- Original reference images are preserved byte-for-byte; web delivery uses WebP. They are static artwork, and the rotating procedural models are not a 1:1 CGI reconstruction.
- No data, schema, permission, source spreadsheet or profile-photo changes are part of this integration.

The original supplied prompt follows for provenance. Deployment follows the owner’s authorization in the active conversation.

---

# CODEX TASK — DHLINEUP PREMIUM 3D VISUAL INTEGRATION

Repository: https://github.com/Jayszrs/DHLINEUP
Production application: `node-app/` (Node.js 22 + Express + EJS + vanilla JS/CSS + Three.js, data in Supabase/PostgreSQL). This repo already has an asset pipeline. Do NOT build an isolated React/Vite replacement.

## Input files
The user supplied `DHLINEUP_3D_CODEX_V3.zip`. Extract its content into repo root while preserving paths. No existing application files are overwritten by this package; new code is under:

- `node-app/frontend/assets/js/dh3d/dh-premium-models.js`
- `node-app/frontend/assets/js/dh3d/dh-premium-viewer.js`
- `node-app/frontend/assets/js/dh3d/references/*`
- `node-app/frontend/assets/css/dh-premium-3d.css`
- `node-app/public/dh-3d-preview.html`
- `examples/embed-in-ejs.ejs`

## Nonnegotiable visual requirements
1. **Preserve the visual look of the supplied CGI reference.** The image `references/dh-hero-exact.png` is the user-approved artistic target. Use it directly as the hero/marketing image wherever the requirement is to look **pixel-perfect like the reference**. Use `dh-hero-exact.webp` for efficient web delivery; PNG fallback. The separate design sheets define the worker uniforms, feminine/masculine appearances, helmet logo, proportions and vehicle surfaces.
2. **A textured image is not a true 3D model.** The delivered `dh-premium-models.js` creates editable *procedural* 3D objects. They are interactive but NOT automatically identical to the high-detail studio CGI picture. Do not call them photorealistic or claim that they match 1:1. Refine procedural geometry/materials/cab/tires/payload/face, or preferably commission/author proper artist-grade `.blend`/`.glb` meshes with UV/PBR materials if a pixel-perfect 360° result is required.
3. The truck needs yellow Caterpillar-777-class style, DH logo, green dynamic `DT####` plates, gray heavy tire tread, dark cabin with reflections, warm yellow rails and steps, detailed ore payload, front grille, illumination, and raised yellow dump body. Do not present the model as dimensionally exact CAD or claim it is an official CAT model.
4. Workers must have animated-film-inspired smooth stylization and expressive faces, blue-turquoise APD with silver reflective bands, deep navy trousers, laced boots, white DH-marked hardhats. Female worker holds tablet; male worker has radio and crossed forearms. **Do not change uniform to green.**
5. Build a clean premium UI: generous whitespace, soft studio light, shadows, restrained navy/blue/yellow accent, responsive layout, dark-mode compatibility.

## Integration plan
1. Inspect the current `node-app/frontend/views`, shared layouts, GPS/recap module, `node-app/frontend/assets`, and the builder `node-app/backend/cli/prepare-assets.js`. Confirm actual variable names; do NOT assume a unit number field or make up a route.
2. Preserve existing functioning Three.js viewer logic if one already exists. Decide whether to add this module as an optional card on the dashboard / operator view / DT speed detail / GPS viewer, without replacing working GPS or current visualization. Prefer a small incremental integration rather than a sweeping redesign.
3. Place `<section data-dh3d data-mode="truck" data-unit="...">` in an appropriate template. Refer to `examples/embed-in-ejs.ejs`. Escape and validate the dynamic unit number with EJS. Don't hardcode `DT2917` in pages for other units.
4. Add `/assets/css/dh-premium-3d.css` and the JS module `/assets/js/dh3d/dh-premium-viewer.js` once per target page. The existing asset builder copies `frontend/assets/js` and `frontend/assets/css` into public, and prepares `js/vendor/three.module.js`; preserve that behavior.
5. If implementing a premium hero on the dashboard, use the original approved `dh-hero-exact.webp` or `dh-hero-exact.png`. It is a static illustration and the shown DT2917 is NOT live database/GPS data. Provide accurate alt text.
6. Load WebGL lazily if possible; don't block the existing dashboard charts or speed tables. Keep mobile FPS manageable (cap DPR 2), respect `prefers-reduced-motion`, provide proper canvas fallback and helpful accessible labels.
7. Implement user-friendly orbit/zoom, truck/worker/both selection, reset camera, and auto-rotate. Existing source provides a working foundation. Support changes of actual `DT` unit numbers, avoiding hardcoded plate strings.
8. If the user wants 3D GLB delivered, convert/refine geometry and materials into true `.glb` files using Blender/Three GLTFExporter and **visually verify** front, side, and rear views against design sheets. Don't substitute a promotional PNG or reuse rejected old low-poly GLBs as the finished model.
9. Do not modify SQL schema, auth, roles, NIK, profile photos, evidence buckets, Supabase records, import/export, speed analytics, GPS data, or role permissions. Never invent speed/GPS readings. No production writes or secrets.
10. Run `cd node-app && npm ci && npm run build && npm test`. If tests need protected credentials, say so, and at least run build and browser checks. Verify no JS console errors, preview URL works, mobile layout, and light/dark UI. Don't commit or push without owner approval.

## Acceptance criteria
- Actual repo code is integrated; not a separate unrelated application.
- Model displays smoothly and can be rotated using mouse/touch, with a readable dynamic DT plate.
- Approved CGI image stays visually exact when used as a static hero.
- No existing data or functionality regresses.
- State plainly that the supplied procedural scene is a starting model, not a perfect recreation of the high-end CGI render. If strict likeness requested, continue 3D modeling/refinement until visually reviewed.

## Deliverables
- Source commit-ready files in the actual Node app; optimized image assets; README; screenshot comparisons of viewer versus the included reference at 3 angles; test results; list of files changed.
