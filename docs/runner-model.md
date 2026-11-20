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
