import * as cad from "replicad";
const rect = (w, d, h, r = 0) =>
  cad.drawRoundedRectangle(w, d, r).sketchOnPlane().extrude(h);
const cyl = (diam, h, x = 0, y = 0, z = 0) =>
  cad.makeCylinder(diam / 2, h, [x, y, z]);
const poly = (r, n, h) => cad.drawPolysides(r, n).sketchOnPlane().extrude(h);
const revolved = (r, top, h) => {
  let p = cad.draw([0, 0]).lineTo([r, 0]).lineTo([top, h]);
  if (top) p = p.lineTo([0, h]);
  return p.close().sketchOnPlane("XZ").revolve();
};
export function solid(b, imported = null) {
  const { w, d, h, kind: k } = b,
    t = Math.min(3, w / 8, d / 8, h / 4),
    r = Math.min(w, d) / 10;
  let s;
  switch (k) {
    case "step":
      s = imported;
      break;
    case "bracket": {
      const base = rect(w, d, t, r);
      const upright = rect(w, t, h, t / 3).translate(0, d / 2 - t / 2, 0);
      s = base.fuse(upright);
      for (const x of [-w * 0.3, w * 0.3]) {
        s = s.cut(cyl(t * 2.1, t + 2, x, -d * 0.2, -1));
        s = s.cut(
          cad.makeCylinder(
            t * 1.35,
            t + 2,
            [x, d / 2 + 1, h * 0.72],
            [0, -1, 0],
          ),
        );
      }
      break;
    }
    case "tray":
    case "organizer":
    case "enclosure":
    case "lid": {
      s = rect(w, d, h, r).cut(
        rect(w - 2 * t, d - 2 * t, h, r / 2).translate(0, 0, t),
      );
      if (k === "organizer")
        s = s.fuse(rect(t, d - t, h * 0.88)).fuse(rect(w - t, t, h * 0.88));
      break;
    }
    case "pot":
    case "holder":
      s = cyl(w, h).cut(cyl(w - 2 * t, h, 0, 0, t));
      if (k === "pot") s = s.cut(cyl(w * 0.12, h));
      break;
    case "washer":
    case "tube":
    case "spacer":
      s = cyl(w, h).cut(cyl(w * (k === "tube" ? 0.78 : 0.45), h));
      break;
    case "ornament":
      s = cyl(w, h).cut(cyl(w * 0.09, h, 0, w * 0.38));
      break;
    case "knob":
      s = poly(w / 2, 6, h).cut(cyl(w * 0.23, h));
      break;
    case "flange":
      s = cyl(w, h).cut(cyl(w * 0.42, h));
      for (let i = 0; i < 4; i++)
        s = s.cut(
          cyl(
            w * 0.1,
            h,
            w * 0.36 * Math.cos((i * Math.PI) / 2),
            w * 0.36 * Math.sin((i * Math.PI) / 2),
          ),
        );
      break;
    case "cone":
    case "frustum":
    case "foot":
      s = revolved(w / 2, k === "cone" ? 0 : w * 0.3, h);
      break;
    case "ellipse":
      s = cad
        .drawEllipse(Math.max(w, d) / 2, Math.min(w, d) / 2)
        .rotate(w < d ? 90 : 0)
        .sketchOnPlane()
        .extrude(h);
      break;
    case "capsule":
      s = rect(w, d, h, Math.min(w, d) / 2 - 0.00001);
      break;
    case "torus": {
      if (h >= w / 2)
        throw Error("Use a ring thickness below half the outer diameter.");
      s = cad
        .drawCircle(h / 2)
        .translate((w - h) / 2, h / 2)
        .sketchOnPlane("XZ")
        .revolve();
      break;
    }
    case "pulley":
      s = cyl(w, h * 0.22)
        .fuse(cyl(w * 0.8, h))
        .fuse(cyl(w, h * 0.22, 0, 0, h * 0.78))
        .cut(cyl(w * 0.2, h));
      break;
    case "wheel":
      s = cyl(w, h).cut(cyl(w * 0.18, h));
      for (let i = 0; i < 5; i++)
        s = s.cut(
          cyl(
            w * 0.2,
            h,
            w * 0.29 * Math.cos((i * Math.PI * 2) / 5),
            w * 0.29 * Math.sin((i * Math.PI * 2) / 5),
          ),
        );
      break;
    case "dish":
      s = cyl(w, h).cut(cyl(w - 2 * t, h, 0, 0, t));
      break;
    case "peg":
    case "cylinder":
    case "coaster":
      s = cyl(w, h);
      break;
    case "sphere":
      s = cad.makeSphere(w / 2).translate(0, 0, w / 2);
      break;
    case "prism":
      s = poly(w / 2, 6, h);
      break;
    case "wedge":
      s = cad
        .draw([-w / 2, 0])
        .lineTo([w / 2, 0])
        .lineTo([w / 2, h])
        .close()
        .sketchOnPlane("XZ")
        .extrude(d)
        .translate(0, d / 2, 0);
      break;
    case "pyramid": {
      const pts = [
          [-w / 2, -d / 2, 0],
          [w / 2, -d / 2, 0],
          [w / 2, d / 2, 0],
          [-w / 2, d / 2, 0],
        ],
        tip = [0, 0, h];
      s = cad.makeSolid([
        cad.makePolygon([...pts].reverse()),
        ...pts.map((v, i) => cad.makePolygon([v, pts[(i + 1) % 4], tip])),
      ]);
      break;
    }
    default:
      s = rect(w, d, h, k === "nameplate" ? r : 0);
  }
  for (const f of b.features) {
    if (f.type === "shell") {
      if (f.size >= Math.min(w, d, h) / 2)
        throw Error("Choose a thinner wall.");
      s = s.shell(f.size, (faces) => faces.inPlane("XY", h));
      continue;
    }
    if (f.type === "round" || f.type === "chamfer") {
      if (f.size >= Math.min(w, d, h) / 2)
        throw Error(
          "Choose a radius smaller than half the shortest dimension.",
        );
      const filter =
        f.place === "top" ? (edges) => edges.inPlane("XY", h) : undefined;
      s =
        f.type === "round"
          ? s.fillet(f.size, filter)
          : s.chamfer(f.size, filter);
      continue;
    }
    const patternCount = f.count || 4;
    const positions =
      f.place === "line"
        ? Array.from({ length: patternCount }, (_, i) => [
            w * 0.64 * (i / (patternCount - 1) - 0.5),
            0,
          ])
        : f.place === "circle"
          ? Array.from({ length: patternCount }, (_, i) => [
              Math.min(w, d) *
                0.32 *
                Math.cos((i * 2 * Math.PI) / patternCount),
              Math.min(w, d) *
                0.32 *
                Math.sin((i * 2 * Math.PI) / patternCount),
            ])
          : f.place === "corners"
            ? [-1, 1].flatMap((a) =>
                [-1, 1].map((c) => [w * 0.32 * a, d * 0.32 * c]),
              )
            : [
                [
                  f.place === "left"
                    ? -w * 0.25
                    : f.place === "right"
                      ? w * 0.25
                      : 0,
                  0,
                ],
              ];
    for (const [x, y] of positions) {
      const depth = f.depth || h,
        z = f.type === "boss" ? h : h - depth;
      if (
        f.type !== "boss" &&
        (depth > h + 0.0001 ||
          f.size >= Math.min(w, d) * (f.place === "corners" ? 0.34 : 0.94))
      )
        throw Error("The feature is too large for this body.");
      const tool =
        f.type === "pocket"
          ? rect(f.size, f.size, depth + 0.01).translate(x, y, z)
          : f.type === "slot"
            ? rect(
                f.size,
                f.size * 0.4,
                depth + 0.01,
                f.size * 0.199,
              ).translate(x, y, z)
            : cyl(f.size, depth + (f.type === "boss" ? 0 : 0.01), x, y, z);
      const before = cad.measureVolume(s);
      s = f.type === "boss" ? s.fuse(tool) : s.cut(tool);
      if (
        Math.abs(cad.measureVolume(s) - before) < 1e-6 ||
        s.solids?.length > 1
      )
        throw Error(
          "That feature does not meet solid material. Try a different position.",
        );
    }
  }
  return s.rotate(b.angle, [0, 0, 0], [0, 0, 1]).translate(b.x, b.y, b.z);
}
