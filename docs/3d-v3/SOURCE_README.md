# DHLINEUP 3D Studio — ready-to-integrate source pack

This package contains **source code for an actual interactive Three.js scene**, **the approved static CGI image**, and **the original character/truck design sheets**.

### Reality check
The `references/dh-hero-exact.png` is a full-res static image with the approved visual appearance. It is not a `.glb` or a rotatable model. The JavaScript procedural 3D objects are true geometry and rotatable; they approximate that look, but cannot reproduce the entire high-end image pixel-for-pixel. High-end 3D assets require detailed modeling, topology, UV/PBR textures, character rigging, lighting, and direct visual revision against the image. This pack intentionally doesn't relabel low-quality GLBs as premium assets.

### Quick start for Codex
1. Open the actual `Jayszrs/DHLINEUP` repository locally in Codex.
2. Extract this ZIP into the repository root; keep relative paths.
3. Give Codex `CODEX_PROMPT.md` (also paste the short instruction below).
4. Ask Codex to integrate into the correct existing EJS view. An example embed is supplied at `examples/embed-in-ejs.ejs`.
5. In `node-app`: `npm ci && npm run build && npm test`.
6. Test `node-app/public/dh-3d-preview.html` through the existing app's static asset server. If not mapped, ask Codex to add a local-only preview route without touching production data.

### Why this matches the repo
Existing repo's `node-app/package.json` uses `three`, and its `backend/cli/prepare-assets.js` copies `frontend/assets/js` + `frontend/assets/css` to public. This pack uses those exact target directories and imports `../vendor/three.module.js`.

### Files
```
CODEX_PROMPT.md                              Detailed integration/refinement instructions
node-app/frontend/assets/js/dh3d/
  dh-premium-models.js                       Procedural worker, truck, road model source
  dh-premium-viewer.js                       Interactive viewer incl. controls / responsive / fallback
  references/dh-hero-exact.png & .webp       The approved composition, pixel-exact as a 2D picture
  references/dh-worker-design.png            Multi-angle character reference
  references/dt2917-design.png               Multi-angle haul truck reference
  references/workers-cutout.png & .webp       Worker PNG image for 2D card compositions
  references/truck-cutout.png & .webp         Truck PNG image for 2D card compositions
node-app/frontend/assets/css/dh-premium-3d.css
node-app/public/dh-3d-preview.html
examples/embed-in-ejs.ejs
scripts/verify_bundle.py
```

### Working JavaScript API
```js
import {createWorker, createDumpTruck, createSceneContents} from './dh-premium-models.js';
const female = createWorker({gender: 'female'});
const truck = createDumpTruck({unitId: 'DT2962'});
const sceneContents = createSceneContents({mode:'all', unitId:'DT2917'});
```

```js
import {DHLineup3DViewer, mountDHLineup3D} from './dh-premium-viewer.js';
const viewer = new DHLineup3DViewer(document.querySelector('#model'), {mode:'truck',unitId:'DT2917'});
viewer.setUnit('DT2962');
viewer.setMode('workers');
viewer.destroy();
```

### Short prompt
> Read `CODEX_PROMPT.md` carefully, integrate these new files into the existing `node-app` EJS/Three.js project without replacing its current features. Static hero must match `dh-hero-exact.png` exactly; 3D procedural source is interactive but needs artistic refinement before it can be called a CGI-quality replica. Preserve the database, speed and GPS logic, and test the UI.
