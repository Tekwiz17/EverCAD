# EverCAD

Imagine it. Describe it. Make it.

EverCAD is a browser-based workspace for building editable mechanical parts with plain English. A first visit or **New** opens an empty grid. Selecting an example fills the command field. **Create model** builds it. Returning to the same browser restores the last successfully saved project.

## Try it

1. Enter “Make a box that is 100 millimeters wide, 60 millimeters deep and 30 millimeters tall.”
2. Enter “Round the corners” and choose a radius.
3. Enter “Make it 10 millimeters taller.”
4. Enter “Add a 4 mm hole in each corner.”
5. Use Undo and Redo, then Export → STEP to take the solid into another CAD application.

Use **Save** for an editable, portable .evercad file. It preserves parameters, feature order, body names, positions, visibility and the command log. Browser local storage is device-, browser- and origin-specific. Undo/redo snapshots last for the current session. Save a file before clearing browser data or replacing a project. The status bar reports local save failures.

## Controls

Drag to orbit, right-drag to pan, and scroll or pinch to zoom. Keyboard users can focus the viewport and press the arrow keys to orbit or +/− to zoom. The view menu and cube provide standard views. The toolbar offers pan, orbit, fit/reset and dimension readout. Click a face to select its body. Face identification is for inspection. Modeling features use the part's local XY plane, with Z up. Dimensions are part parameters, in the chosen display units.

Advanced mode exposes body selection, naming, dimensions, coordinates, rotation, visibility, duplication, deletion and feature removal. Compatible feature geometry rebuilds when earlier body dimensions change. Settings include relative change percentage, text size, contrast, light/dark appearance, display units and perspective projection. Device keyboard dictation can be used in the normal text field. The app requests no microphone access.

## Modeling vocabulary

The registry contains 33 parameterized part families. Browse Examples for dimensions and phrases. These include a mounting bracket, rounded tray, drawer organizer, enclosure, pot, washer, spacer, flange, pulley, wheel, prism, cone, torus and wedge. Different families expose different parameters. Rectangular parts accept width, depth and height. Cylindrical bodies link width and depth. Spheres link all three.

| Try saying | Effect |
| --- | --- |
| Make a box 80 by 50 by 20 | Create a solid, in millimeters |
| Make a 2 inch cube | Convert input units to millimeters |
| Add a hole | Ask for diameter |
| Add a 5 mm blind hole 3 mm deep | Cut a top-facing blind hole |
| Cut a 12 mm pocket | Cut a square central opening |
| Add a 10 mm boss 4 mm deep | Add a cylindrical boss above the top |
| Add 5 holes of 3 mm in a line | Cut a centered linear pattern |
| Drill 6 holes of 2 mm around a circle | Cut a circular pattern centered on the part |
| Round the top edges by 1 mm | Fillet edges in the top plane |
| Chamfer the top edges by 1 mm | Bevel top edges |
| Shell it with 2 mm walls | Open the top and hollow a compatible solid |
| Double its height | Edit the selected body's base parameter |
| Move it 10 mm left | Translate the body in X |
| Rotate it 30 degrees | Rotate about the local Z axis |
| Make a plate 80 by 50 by 6; add a 3 mm hole in each corner | Commit a multi-operation transaction |

Default example dimensions are shown in the searchable library. Unqualified measurements use millimeters. “A little” uses the configurable relative percentage. A center hole cuts through the nominal body height unless a depth is given. Corner patterns use centers at ±32% of the width and depth. Unsupported requests and failed geometry return feedback and retain the last valid project. There is no general-purpose language model. Freehand sketches, arbitrary-face machining, native Fusion timelines, threads and constraint solving are outside this release.

## Files and geometry

- **STEP** exports exact OpenCascade boundary representation and reimports it for a solid-content check before download. Fusion receives solids; use the native project file for EverCAD's editing history.
- **STL** exports binary triangles in millimeter coordinates. STL does not declare units.
- **3MF** exports a millimeter model inside an Open Packaging Conventions ZIP with a build item for each visible body. It carries geometry rather than slicer presets.
- **Open** accepts native projects and individual single-solid STEP files up to 1.5 MB. STEP imports are centered locally and placed next to existing parts. They support added features and transforms, with fixed imported base dimensions. STL and 3MF import are not implemented.

## Run and test

Use Node.js 24, then run the following from the repository root.

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium-headless-shell
npm run e2e
```

Set CHROMIUM_PATH to use an existing compatible Chromium executable. Browser tests use the production build. They exercise the blank workspace, commands and clarifications, history, failed requests, local restoration, file downloads, native reopen, STEP import, keyboard interactions, appearance and responsive bounds. Unit tests include 100,800 generated dimension combinations and real-kernel checks for every registered template. Browser automation currently targets Chromium. Manual Safari, Firefox, screen-reader and Autodesk Fusion verification remain outstanding.

## Architecture and hosting

Vite builds static ES modules, a worker and a locally served WebAssembly kernel. Three.js renders the scene. Replicad drives OpenCascade solids. The kernel loads only when a solid is needed. Each operation validates a candidate project, rebuilds it in an isolated worker, then commits only after geometry succeeds. Terminating the worker on completion, timeout or cancellation releases the WASM heap. Workers are recreated per operation, trading speed on larger projects for bounded memory. File generation occurs in the browser. There are no accounts, analytics, API keys, runtime AI, database or serverless functions.

The client guards against excessive geometry work with bounded dimensions, body and feature counts and a 90-second operation timeout. Project storage depends on available browser space. Vercel configuration uses static hosting with immutable caching for hashed assets. Vercel Hobby is intended for personal noncommercial use and has usage quotas. The first geometry operation downloads approximately 7.3 MB of compressed WASM.

To extend EverCAD, add a named family and default parameters in src/model.js, implement its solid in src/geometry.js, and add parsing rules in src/language.js. Test geometry and language together. Unmatched command segments must reject the entire transaction.

Bundled dependency licenses are published at /THIRD-PARTY-NOTICES.txt. Replicad uses MIT, the separately loaded replicad-opencascadejs WASM package uses LGPL-2.1-only, Three.js and fflate use MIT and the icon set carries its upstream license notices.

- [Replicad library documentation](https://replicad.pages.dev/docs/use-as-a-library/)
- [Replicad and kernel build source](https://github.com/sgenoud/replicad)
- [Vercel Hobby plan and limits](https://vercel.com/docs/plans/hobby)
