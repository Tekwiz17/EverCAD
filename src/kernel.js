import init from "replicad-opencascadejs";
import wasm from "replicad-opencascadejs/wasm?url";
import {
  setOC,
  exportSTEP,
  makeCompound,
  measureVolume,
  importSTEP,
} from "replicad";
import { zipSync, strToU8 } from "fflate";
import { solid } from "./geometry.js";
import { validate } from "./model.js";
async function importedSolid(source) {
  const shape = await importSTEP(new Blob([source]));
  if (shape.solids.length !== 1)
    throw Error("Choose a STEP file containing one closed solid.");
  const [lo, hi] = shape.boundingBox.bounds;
  return {
    shape: shape.translate(-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]),
    dimensions: hi.map((v, i) => Number((v - lo[i]).toFixed(5))),
  };
}
let ready;
function threeMF(meshes) {
  const file = (s) => strToU8(s),
    objects = meshes.map(({ vertices, triangles }, i) => {
      const pts = [],
        faces = [],
        indices = [],
        lookup = new Map();
      for (let j = 0; j < vertices.length; j += 3) {
        const v = vertices.slice(j, j + 3),
          key = v.map((n) => n.toFixed(8)).join(",");
        if (!lookup.has(key)) {
          lookup.set(key, pts.length);
          pts.push(
            '<vertex x="' + v[0] + '" y="' + v[1] + '" z="' + v[2] + '"/>',
          );
        }
        indices.push(lookup.get(key));
      }
      for (let j = 0; j < triangles.length; j += 3)
        faces.push(
          '<triangle v1="' +
            indices[triangles[j]] +
            '" v2="' +
            indices[triangles[j + 1]] +
            '" v3="' +
            indices[triangles[j + 2]] +
            '"/>',
        );
      return (
        '<object id="' +
        (i + 1) +
        '" type="model"><mesh><vertices>' +
        pts.join("") +
        "</vertices><triangles>" +
        faces.join("") +
        "</triangles></mesh></object>"
      );
    });
  return new Blob([
    zipSync({
      "[Content_Types].xml": file(
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
      ),
      "_rels/.rels": file(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
      ),
      "3D/3dmodel.model": file(
        '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>' +
          objects.join("") +
          "</resources><build>" +
          objects.map((_, i) => '<item objectid="' + (i + 1) + '"/>').join("") +
          "</build></model>",
      ),
    }),
  ]);
}
self.onmessage = async ({ data: { id, project, format } }) => {
  let solids = [];
  try {
    validate(project);
    ready ??= init({ locateFile: () => wasm }).then(setOC);
    await ready;
    const bodies = project.bodies.filter((b) => b.visible);
    if (format === "inspect-step") {
      const result = await importedSolid(bodies.at(-1).source);
      self.postMessage({ id, dimensions: result.dimensions });
      return;
    }
    for (const b of bodies) {
      const imported = b.kind === "step" ? await importedSolid(b.source) : null;
      if (
        imported &&
        imported.dimensions.some(
          (v, i) => Math.abs(v - [b.w, b.d, b.h][i]) > 0.001,
        )
      )
        throw Error("Imported body dimensions do not match the STEP source.");
      solids.push(solid(b, imported?.shape));
    }
    const meshes = solids.map((s, i) => {
      const volume = measureVolume(s);
      if (!Number.isFinite(volume) || volume <= 0 || s.solids.length !== 1)
        throw Error("The operation must produce a closed solid.");
      return {
        ...s.mesh({ tolerance: 0.08, angularTolerance: 0.18 }),
        lines: s.meshEdges().lines,
        id: bodies[i].id,
        volume,
        bounds: s.boundingBox.bounds,
      };
    });
    let blob;
    if (format) {
      if (!solids.length) throw Error("Show a body before exporting.");
      if (format === "step") {
        blob = exportSTEP(
          solids.map((shape, i) => ({ shape, name: bodies[i].name })),
        );
        const check = await importSTEP(blob);
        if (!check.solids.length) throw Error("STEP verification failed.");
        check.delete();
      } else if (format === "stl")
        blob = makeCompound(solids).blobSTL({ binary: true });
      else if (format === "3mf") blob = threeMF(meshes);
    }
    self.postMessage({ id, meshes, blob });
  } catch (e) {
    self.postMessage({
      id,
      error:
        typeof e?.message === "string"
          ? e.message
          : "The solid could not be built with those dimensions.",
    });
  } finally {
    for (const s of solids) s.delete();
  }
};
