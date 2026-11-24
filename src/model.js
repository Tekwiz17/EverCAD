export const catalog = {
  box: ["Box", 60, 40, 30],
  cube: ["Cube", 50, 50, 50],
  plate: ["Mounting plate", 100, 60, 5],
  bracket: ["Mounting bracket", 72, 48, 40],
  tray: ["Parts tray", 90, 65, 18],
  organizer: ["Drawer organizer", 120, 80, 36],
  enclosure: ["Electronics enclosure", 90, 60, 32],
  holder: ["Pencil holder", 64, 64, 80],
  pot: ["Plant pot", 76, 76, 65],
  coaster: ["Coaster", 90, 90, 4],
  washer: ["Washer", 24, 24, 3],
  spacer: ["Spacer", 18, 18, 20],
  tube: ["Tube", 40, 40, 45],
  cylinder: ["Cylinder", 40, 40, 45],
  sphere: ["Sphere", 40, 40, 40],
  prism: ["Hexagonal prism", 36, 36, 25],
  cone: ["Cone", 40, 40, 50],
  frustum: ["Truncated cone", 50, 50, 40],
  knob: ["Hex knob", 32, 32, 16],
  flange: ["Mounting flange", 60, 60, 8],
  foot: ["Rubber foot", 30, 30, 12],
  nameplate: ["Nameplate blank", 90, 32, 4],
  ornament: ["Ornament blank", 70, 70, 4],
  lid: ["Box lid", 90, 60, 6],
  wedge: ["Wedge", 60, 40, 30],
  pyramid: ["Pyramid", 40, 40, 40],
  ellipse: ["Elliptical plate", 70, 40, 6],
  capsule: ["Capsule plate", 70, 32, 8],
  torus: ["Torus", 48, 48, 8],
  peg: ["Locating peg", 12, 12, 25],
  pulley: ["Pulley", 50, 50, 15],
  wheel: ["Wheel", 55, 55, 14],
  dish: ["Round dish", 75, 75, 14],
};
export const roundKinds = new Set(
  "holder pot coaster washer spacer tube cylinder sphere prism cone frustum knob flange foot ornament torus peg pulley wheel dish".split(
    " ",
  ),
);
export const empty = () => ({
  format: "EverCAD",
  version: 1,
  name: "Untitled project",
  bodies: [],
  selected: null,
  history: [],
});
export function body(kind, x = 0) {
  const [name, w, d, h] = catalog[kind];
  return {
    id: crypto.randomUUID(),
    name,
    kind,
    w,
    d,
    h,
    x,
    y: 0,
    z: 0,
    angle: 0,
    visible: true,
    features: [],
  };
}
export function validate(p) {
  if (
    p?.format !== "EverCAD" ||
    p.version !== 1 ||
    typeof p.name !== "string" ||
    p.name.length > 120 ||
    !Array.isArray(p.bodies) ||
    p.bodies.length > 30 ||
    !Array.isArray(p.history) ||
    p.history.length > 300 ||
    p.history.some((h) => typeof h !== "string" || h.length > 700)
  )
    throw Error("Choose a valid EverCAD project file.");
  const ids = new Set();
  for (const b of p.bodies) {
    if (
      !b ||
      (!Object.hasOwn(catalog, b.kind) && b.kind !== "step") ||
      typeof b.id !== "string" ||
      ids.has(b.id) ||
      typeof b.name !== "string" ||
      b.name.length > 100 ||
      typeof b.visible !== "boolean" ||
      !Array.isArray(b.features) ||
      b.features.length > 40
    )
      throw Error("This body contains unsupported data.");
    if (
      b.kind === "step" &&
      (typeof b.source !== "string" ||
        b.source.length > 1500000 ||
        !b.source.trimStart().startsWith("ISO-10303-21;"))
    )
      throw Error("The STEP source in this project is invalid.");
    ids.add(b.id);
    for (const k of ["w", "d", "h", "x", "y", "z", "angle"])
      if (
        !Number.isFinite(b[k]) ||
        Math.abs(b[k]) > 10000 ||
        (["w", "d", "h"].includes(k) && (b[k] < 0.5 || b[k] > 2000))
      )
        throw Error(
          "Use dimensions between 0.5 and 2,000 mm, and positions within 10,000 mm.",
        );
    for (const f of b.features) {
      if (
        f?.count !== undefined &&
        (!Number.isInteger(f.count) || f.count < 2 || f.count > 24)
      )
        throw Error("Patterns support 2 to 24 features.");
      if (
        ![
          "hole",
          "round",
          "pocket",
          "boss",
          "slot",
          "chamfer",
          "shell",
        ].includes(f?.type) ||
        !Number.isFinite(f.size) ||
        f.size <= 0 ||
        f.size > 2000 ||
        ![
          "center",
          "corners",
          "left",
          "right",
          "top",
          "line",
          "circle",
        ].includes(f.place) ||
        !Number.isFinite(f.depth) ||
        f.depth < 0 ||
        f.depth > 2000
      )
        throw Error("A feature has invalid measurements.");
    }
  }
  if (p.selected !== null && !ids.has(p.selected))
    throw Error("The selected body is missing.");
  return p;
}
export function log(p, message) {
  p.history = [...p.history.slice(-299), message];
  return validate(p);
}
