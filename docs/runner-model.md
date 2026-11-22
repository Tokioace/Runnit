# RUNNIT runner – current profile rendering and asset provenance

## Current implementation (verified on develop 84313dbec41f; 2026-11-22)

The profile initially displays the local reference illustration `/assets/runnit-reference-runner.webp`. The `360° SCAN` control switches to a genuine rotatable 3D viewer, and can switch back to the illustration. **The 2D artwork itself does not rotate**; the stylized 3D mesh is an approximation rather than an identical reconstruction.

The 3D asset is served locally at `/assets/runnit-runner-3d.glb`. `src/components/profile/RunnerHologramModel.tsx` fetches this GLB, adjusts its skeletal pose in memory, and renders it using Google's `model-viewer` version **4.1.0**, currently loaded at runtime from `https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js`. The GLB is **not** fetched from jsDelivr in the current implementation. The renderer's executable script **is** a third-party runtime dependency and is not guaranteed to work offline. No SRI attribute is set by the loader; CDN availability, CSP, privacy implications and iPhone performance require independent review.

On loading failure or timeout, the component shows the existing local `RunnerHologram3D` fallback. This fallback is **not** proof that the full rigged 3D asset works offline. The viewer respects `prefers-reduced-motion` for automatic rotation; manual controls and actual mobile accessibility still require device testing.

The source model derives from Quaternius **Universal Base Characters – Superhero Male** (CC0 1.0 Universal), with a prepared upstream copy documented by [programasweights/avatar](https://github.com/programasweights/avatar/blob/main/ASSETS.md) at commit `a488723e3a93d73d5c562d88f8a85353c37bc721`. RUNNIT's local customized GLB includes runner-specific hair, visor, clothing, and shoes. These are artistic assets, **not** measurements or representations of a user's real body. Profile data is not used to deform the model.

Author: [Quaternius](https://quaternius.com/packs/universalbasecharacters.html) · [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) · Renderer: [model-viewer](https://modelviewer.dev/) (Apache-2.0).

## Historical implementation notes (superseded where they conflict with the current section)

## 2026-11-20: neutral standing pose and framing
The source model arrives in a horizontal-arm bind/T-pose. RUNNIT now
downloads the pinned GLB and transforms its upper-arm and forearm skeleton
**node rotations** in-browser, reconstructing a glTF/GLB Blob for model-viewer.
Original vertex meshes, skin weights, inverse bind matrices and binary chunks
are unchanged. The resulting relaxed posture has slightly separated, lowered
arms, with hands around hip height. Posing failure falls back to the original
local hologram; the unwanted T-pose is never presented as the intended result.
The vertical model frame uses 65% camera orbit and 28° vertical field of view
to use the available fixed scan panel more fully. Recheck visual framing in
iPhone Safari before merging to main.


## 2026-11-20: iPhone framing correction
The 65% camera orbit used for the previous revision cut off the avatar's
head and shoes in the fixed-height profile scan. The fixed mobile framing is
now 88% orbit with 30° field of view, and the very same distance is used after
manual rotation. This is a framing adjustment, not a geometry or layout change.
Verify the entire head-to-shoe figure on the iPhone before merging to main.


## 2026-11-20: customized RUNNIT avatar asset
The app now hosts `public/assets/runnit-runner-3d.glb` locally rather than
fetching a uniform-Cyan body from a third-party CDN. Built from the original
Quaternius *Universal Base Characters – Superhero Male* GLB prepared by
`programasweights/avatar` at commit
`a488723e3a93d73d5c562d88f8a85353c37bc721` under CC0.

The source mesh and bone weights are retained. The GLB has RUNNIT-specific
vertex colors and **real skinned accessory geometry**: brown swept/spiked
hair, electric blue wrap-around sports visor, hoodie collar, white chest R,
cyan piping, and layered sneakers. Navy short-sleeved shirt and shorts, warm
tan skin, black gloves and leggings, and shoes are colored directly on the
3D model. All elements rotate together, not as a two-dimensional overlay.
This is a stylized **approximation** of the supplied promotional character,
not a pixel-exact 3D reconstruction of the 2D illustration.

Camera orbit is 130% to leave modest headroom in the compact mobile scan.
The auto-rotation, manual 45° controls, animated scan ring, private runner
profile data and bottom nav remain unchanged. The external `model-viewer`
script is still version-pinned; the GLB itself is self-hosted for reliability.

## 2026-11-20 – Visual refinement (profile runner v2)

The first deployed asset rendered correctly from every angle, but its straight-up
hair spikes, protruding rectangular visor and oversized white shoes did not
match the supplied RUNNIT runner design. Version 2 adjusts **the actual GLB
geometry** (not a screenshot or CSS overlay): shortens and sweeps the hair
backwards, narrows the visor and frame and brings the lens closer to the
face, and reduces sneaker bulk. Shorts, their cyan seam and the dark
leggings now have clearly separate vertex-color palettes.

The compact profile layout, **130% camera orbit**, 360° controls, Supabase data
and bottom navigation are untouched. This is still a stylized approximation
rather than a one-to-one recreation of the illustration. Inspect the updated
avatar on a real iPhone, front/side/back, before merging to `main`.


## 2026-11-20 – Runner/platform alignment and shoe details (v3)

The iPhone screenshots showed the model's shoes clearly floating above the
scanner pedestal. Only the rendered model element is shifted downward by
11% of its own canvas (8% on short screens), while the scan ring, fixed
layout and shared navigation remain untouched. No camera orbit or pose changes.

The local GLB receives additional bone-skinned shoe-lace ribbons, thin cyan
side panels and subtle outsole accents, plus a less saturated shorts hem.
These accessories rotate with the runner. The original geometry and
skeletal bindings stay intact.

The physical iPhone still needs a visual check that the feet meet the
platform through the full rotation.
