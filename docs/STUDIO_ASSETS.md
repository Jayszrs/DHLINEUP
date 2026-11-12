# DH studio visuals, 12 November 2026

The current character assets adapt Blender Studio's **Snow v4** (male) and
**Rain v3** (female). The original public pages identify both rigs as CC BY 4.0:

- https://studio.blender.org/characters/snow/v4/
- https://studio.blender.org/characters/rain/v3/

The website includes the required Blender Foundation attribution beside the
room/driver visual and in `frontend/assets/js/dh3d/studio/LICENSE.txt`.
These are illustrative avatars, not reconstructed portraits of the six staff.
The source archives and the isolated bpy conversion environment remain private
and are not shipped to Vercel.

`node-app/backend/cli/prepare-studio-characters.py` converts a locally downloaded
source `.blend` to an embedded GLB. It opens source files with scripts disabled,
retains the authored face/hair topology, evaluates surface modifiers and reduces
the film control rig to 57 deform bones, retaining independent shoulders and
finger chains. Rain's three skin UDIM tiles are packed
into one atlas. The website adds turquoise/navy clothing, fitted sleeves,
branding, hand poses and a safety helmet for mine drivers. JHO staff have no
helmet. Face/eye/hair geometry follows only the head; iris/white/pupil materials
are preserved separately. Regression tests catch accidental face-to-hand weights.

Arms use elbow-guided inverse kinematics. Profile poses rest the hands with a
gentle finger curl, while workstation poses place them at keyboard height.
Typing alternates individual fingers in short, staggered phrases, accompanied
by small wrist movements. Shoulder weights stay on the clavicles so lowering an
arm preserves the shirt silhouette. Animation uses the existing visibility,
reduced-motion and 30 fps limits.

GLBs are cached once per gender. SkeletonUtils clones independent bones per
person while buffers and materials remain shared. Fresh character instances
replace the ordinary clones inside the room prototype, preventing shared poses.
Workstation layout, names/NIKs, profile information and room schedule stay intact:
two front desks near the meeting area, four rear desks near the entrance.

The original `studio-haul-truck.js` model supplies six separately animated tyre
pivots, dual rear tyres, pressed rims, tread blocks, suspension, cabin seals,
mirrors, grille, service ladder, safety rails and closed steel bed walls. It is
an illustrative rigid hauler, not manufacturer CAD. No reference DT number is
embedded in its geometry; fleet-models applies validated identity plates from
the selected unit. Static surfaces are batched by shared finish.

`/speed-unit` places the animated truck below the daily recap, with a navigation
anchor and a preview dialog. Top speed, its witness date and averages use only
that unit's filtered valid readings. No-data periods display unknown values.
Road movement uses the filtered moving average and is explicitly illustrative.
Wheel/trackpad zoom, orbit, reset and fullscreen are supported. Animation stops
outside the viewport, in a hidden tab or with reduced motion; the render buffer
is capped at 1.6 million pixels and animation at 30 fps. Truck-only reports do
not download the character GLBs.

The brand uses the orange DH symbol and **DH** wordmark, with **Operation Command
Center** underneath. Website typography uses the supplied TT Firs Neue Bold,
including controls, chart labels and canvas signage. No unprovided Regular face
is invented. The equivalent WOFF2 is generated from the user's TTF; the original
remains a fallback. The build fingerprint includes GLB/WOFF2 bytes so geometry
and typography changes receive a new asset version.
