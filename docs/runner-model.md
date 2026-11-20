# Runner profile – third-party 3D character (experimental)

The 360° avatar tries to load the rigged **Superhero Male** character from
[Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)
under **CC0 1.0 Universal**, including commercial use.

The prepared GLB is distributed by
[programasweights/avatar](https://github.com/programasweights/avatar/blob/main/ASSETS.md)
at the immutable commit \`a488723e3a93d73d5c562d88f8a85353c37bc721\`.
It preserves original geometry and skeletal data, replaces materials with a
single jade material, and contains no external images. RUNNIT overrides its
material to translucent cyan during rendering.

The custom element renderer is Google's [model-viewer](https://modelviewer.dev/),
version **4.1.0** (Apache-2.0).

**Current prototype limitation:** the viewer and GLB are fetched at runtime
from Google and jsDelivr. No third-party script, GLB, or dependency was added to
the npm lockfile. The local 3D canvas is retained as the fallback when remote
loading fails. This is not guaranteed offline; self-hosting and runtime smoke
testing are required before a production release.

The mesh is an **illustration** and does not show the user's real appearance,
body dimensions or medical measurements. Editing profile data must never
implicitly modify the 3D character measurements.

Official author: Quaternius / @Quaternius.
Source pack: https://quaternius.com/packs/universalbasecharacters.html
License: https://creativecommons.org/publicdomain/zero/1.0/


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
