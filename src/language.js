import { catalog, roundKinds, body, log, validate } from "./model.js";
const aliases = {
  "square block": "cube",
  "rectangular box": "box",
  "rectangular block": "box",
  block: "box",
  "rectangular plate": "plate",
  "mounting plate": "plate",
  "mounting bracket": "bracket",
  "l bracket": "bracket",
  "parts tray": "tray",
  "drawer organizer": "organizer",
  "electronics enclosure": "enclosure",
  "pencil holder": "holder",
  "plant pot": "pot",
  "hexagonal prism": "prism",
  "hex knob": "knob",
  "mounting flange": "flange",
  "rubber foot": "foot",
  "box lid": "lid",
  "truncated cone": "frustum",
  "elliptical plate": "ellipse",
  "capsule plate": "capsule",
  "round dish": "dish",
  "locating peg": "peg",
  bushing: "spacer",
  ring: "washer",
  cylindar: "cylinder",
  clyinder: "cylinder",
  cylnder: "cylinder",
  cuboid: "box",
  rectangle: "plate",
};
const names = {
  ...Object.fromEntries(Object.keys(catalog).map((k) => [k, k])),
  ...aliases,
};
const units = {
  mm: 1,
  millimeters: 1,
  millimeter: 1,
  millimetres: 1,
  millimetre: 1,
  cm: 10,
  centimeter: 10,
  centimeters: 10,
  centimetre: 10,
  centimetres: 10,
  in: 25.4,
  inch: 25.4,
  inches: 25.4,
};
const numbers =
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(
    " ",
  );
const tens = "twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
export function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "'")
    .replace(/(\d)"/g, "$1 inches")
    .replace(/½/g, " 1/2")
    .replace(/(\d+)\s+(\d+)\/(\d+)/g, (_, a, b, c) => String(+a + b / c))
    .replace(/(\d+)\/(\d+)/g, (_, a, b) => String(a / b))
    .replace(
      /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[ -](one|two|three|four|five|six|seven|eight|nine)\b/g,
      (_, a, b) => String((tens.indexOf(a) + 2) * 10 + numbers.indexOf(b)),
    )
    .replace(/\b[a-z]+\b/g, (w) =>
      numbers.includes(w)
        ? String(numbers.indexOf(w))
        : tens.includes(w)
          ? String((tens.indexOf(w) + 2) * 10)
          : w,
    )
    .replace(/millimetters/g, "millimeters")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}
const measure =
  "(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))\\s*(" +
  Object.keys(units)
    .sort((a, b) => b.length - a.length)
    .join("|") +
  ")?";
function readAll(s) {
  return [...s.matchAll(new RegExp(measure, "g"))].map((m) => ({
    raw: m[0].trim(),
    n: +m[1],
    unit: m[2],
    value: +m[1] * (units[m[2]] || 1),
  }));
}
const dim = {
  wide: "w",
  width: "w",
  wider: "w",
  diameter: "w",
  deep: "d",
  depth: "d",
  deeper: "d",
  long: "d",
  length: "d",
  tall: "h",
  height: "h",
  high: "h",
  taller: "h",
  thick: "h",
  thickness: "h",
  shorter: "h",
  narrower: "w",
  thinner: "h",
};
const dimPattern = Object.keys(dim).join("|");
function assign(b, key, val) {
  b.lastDimension = key;
  b[key] = val;
  if (roundKinds.has(b.kind) && (key === "w" || key === "d")) {
    b.w = b.d = val;
    if (b.kind === "sphere") b.h = val;
  }
  if (b.kind === "sphere" && key === "h") b.w = b.d = val;
}
export class Question extends Error {
  constructor(message, options, fill) {
    super(message);
    this.options = options;
    this.fill = fill;
  }
}
const unsupported = () => {
  throw Error(
    "I could not match the whole request. Try one change at a time, or choose a command from Examples.",
  );
};
function measureOnly(s) {
  const m = s.trim().match(new RegExp("^" + measure + "$"));
  if (!m || +m[1] <= 0)
    throw Error("Enter a positive measurement, such as 4 mm.");
  return +m[1] * (units[m[2]] || 1);
}
function single(p, s, relative) {
  let b = p.bodies.find((o) => o.id === p.selected);
  const prefix =
    /^(?:(?:please |can you )?(?:make|create|build|give me|start with|add|draw|generate)\s+)?(?:me\s+)?(?:a |an |the )?/;
  const creation = s.replace(prefix, "");
  const noun = Object.keys(names)
    .sort((a, b) => b.length - a.length)
    .find((n) => creation === n || creation.startsWith(n + " "));
  if (noun) {
    const k = names[noun];
    let tail = creation.slice(noun.length).trim();
    b = body(
      k,
      p.bodies.length
        ? Math.max(...p.bodies.map((o) => o.x + o.w / 2)) +
            catalog[k][1] / 2 +
            10
        : 0,
    );
    const matches = readAll(tail);
    const labeled = new RegExp(
      measure + "\\s*(?:in )?(" + dimPattern + ")\\b",
      "g",
    );
    let count = 0;
    tail = tail.replace(labeled, (_, n, u, key) => {
      assign(b, dim[key], +n * (units[u] || 1));
      count++;
      return " ";
    });
    if (count && count !== matches.length) unsupported();
    if (!count && matches.length) {
      if (matches.length === 3) {
        const fallback = matches.at(-1).unit;
        ["w", "d", "h"].forEach((key, i) =>
          assign(
            b,
            key,
            matches[i].n * (units[matches[i].unit || fallback] || 1),
          ),
        );
      } else if (matches.length === 1 && (k === "cube" || roundKinds.has(k))) {
        assign(b, "w", matches[0].value);
        if (k === "cube") b.h = b.d = b.w;
      } else unsupported();
      tail = tail.replace(new RegExp(measure, "g"), " ");
    }
    tail = tail
      .replace(
        /\b(that is|that measures|measuring|with|and|by|x|on each side|in every direction|on all sides|across|of|is)\b|[×,]/g,
        "",
      )
      .trim();
    if (tail) unsupported();
    p.bodies.push(b);
    p.selected = b.id;
    return;
  }
  // A size before the part name is equivalent to a size after it.
  const leading = creation.match(new RegExp("^" + measure + "\\s+(.+)$"));
  if (leading && names[leading[3]])
    return single(
      p,
      "make a " + leading[3] + " " + leading[1] + " " + (leading[2] || ""),
      relative,
    );
  if (!b)
    throw Error("Start by describing a part, such as “Make a 50 mm cube”.");
  if (
    /^(?:remove|delete) (?:the )?(?:last (?:thing i added|feature)|previous feature)$/.test(
      s,
    )
  ) {
    if (!b.features.length)
      throw Error(
        "This body has no added features. Use Undo to reverse the last action.",
      );
    b.features.pop();
    return;
  }
  if (/^(?:duplicate|copy) (?:it|this|the body)$/.test(s)) {
    const copy = structuredClone(b);
    copy.id = crypto.randomUUID();
    copy.x += b.w + 10;
    copy.name += " copy";
    p.bodies.push(copy);
    p.selected = copy.id;
    return;
  }
  const rotate = s.match(
    /^rotate (?:it|the body) (?:by )?(-?[0-9.]+) (?:degrees|degree)(?: around (?:the )?z axis)?$/,
  );
  if (rotate) {
    b.angle = (b.angle + Number(rotate[1])) % 360;
    return;
  }
  const shell = s.match(
    new RegExp(
      "^(?:shell|hollow out) (?:it|the body)(?: with)? " +
        measure +
        "(?: walls?)?$",
    ),
  );
  if (shell) {
    b.features.push({
      type: "shell",
      size: +shell[1] * (units[shell[2]] || 1),
      place: "top",
      depth: 0,
    });
    return;
  }
  const pattern = s.match(
    new RegExp(
      "^(?:add|drill|cut) (\\d+) (?:evenly spaced )?holes (?:of |with diameter )?" +
        measure +
        " (?:in|around) (?:a |the )?(line|circle)$",
    ),
  );
  if (pattern) {
    b.features.push({
      type: "hole",
      size: +pattern[2] * (units[pattern[3]] || 1),
      count: +pattern[1],
      place: pattern[4],
      depth: 0,
    });
    return;
  }
  const round = s.match(
    new RegExp(
      "^(?:round|fillet|chamfer) (?:the |its |all )?(?:top )?(?:corners|edges)(?: (?:by |with (?:a )?|to |using )?" +
        measure +
        "(?: radius)?)?$",
    ),
  );
  if (round) {
    if (!round[1])
      throw new Question(
        "What radius should the corners have?",
        ["1 mm", "2 mm", "3 mm"],
        (v) => s + " by " + measureOnly(v) + " mm",
      );
    b.features.push({
      type: s.startsWith("chamfer") ? "chamfer" : "round",
      size: +round[1] * (units[round[2]] || 1),
      depth: 0,
      place: s.includes("top ") ? "top" : "center",
    });
    return;
  }
  let f = s.match(
    new RegExp(
      "^(?:add|cut|put|drill|make) (?:a |an |four |4 )?(?:" +
        measure +
        "\\s*)?(?:through |blind )?(hole|holes|slot|boss|pocket)(?: (?:with (?:a )?diameter of |of |measuring )?" +
        measure +
        ")?(?: (?:in|at|on) (?:the |each |every |all )?(corner|corners|center|centre|left|right))?(?: (?:to a depth of )?" +
        measure +
        "(?: deep)?)?$",
    ),
  );
  if (f) {
    const type =
        f[3].replace(/s$/, "") === "bos"
          ? "boss"
          : f[3] === "holes"
            ? "hole"
            : f[3],
      place = /corner/.test(f[6])
        ? "corners"
        : ["left", "right"].includes(f[6])
          ? f[6]
          : "center";
    if (/\b(?:four|4) holes\b/.test(s) && place !== "corners")
      throw Error(
        "Specify a pattern, such as “add a 4 mm hole in each corner”.",
      );
    if (f[1] && f[4]) unsupported();
    const n = f[1] || f[4];
    if (!n)
      throw new Question(
        "How wide should the " + type + " be?",
        ["3 mm", "4 mm", "6 mm"],
        (v) =>
          s.replace(
            /\b(hole|holes|slot|boss|pocket)\b/,
            measureOnly(v) + " mm $1",
          ),
      );
    if (/\bblind\b/.test(s) && !f[7])
      throw new Question(
        "How deep should the hole be?",
        ["2 mm", "5 mm", "10 mm"],
        (v) => s + " " + measureOnly(v) + " mm deep",
      );
    b.features.push({
      type,
      place,
      size: +n * (units[f[2] || f[5]] || 1),
      depth: f[7] ? +f[7] * (units[f[8]] || 1) : type === "boss" ? 5 : 0,
    });
    return;
  }
  const last = b.features.at(-1);
  if (
    /^(?:add another hole|move (?:that|the last) hole to the (?:left|right)|put (?:one|1) on each corner|make the same thing on the other side)$/.test(
      s,
    )
  ) {
    if (last?.type !== "hole")
      throw Error("First add a hole to the selected body.");
    if (s.startsWith("move"))
      last.place = s.endsWith("left") ? "left" : "right";
    else if (s.startsWith("put")) last.place = "corners";
    else
      b.features.push({
        ...last,
        place: last.place === "right" ? "left" : "right",
      });
    return;
  }
  const previous = s.match(
    new RegExp("^change the previous dimension to " + measure + "$"),
  );
  if (previous) {
    if (!["w", "d", "h"].includes(b.lastDimension))
      throw Error(
        "Which dimension would you like to change? Try “Set the width to 2 inches”.",
      );
    const keyName = { w: "width", d: "depth", h: "height" }[b.lastDimension];
    return single(
      p,
      "set the " + keyName + " to " + previous[1] + " " + (previous[2] || "mm"),
      relative,
    );
  }
  if (/^make it (?:a little )?(bigger|smaller)$/.test(s)) {
    if (b.kind === "step")
      throw Error("This imported body has fixed base dimensions.");
    const factor = 1 + (s.endsWith("smaller") ? -relative : relative) / 100;
    for (const key of ["w", "d", "h"]) b[key] *= factor;
    for (const feature of b.features) {
      feature.size *= factor;
      feature.depth *= factor;
    }
    delete b.lastDimension;
    return;
  }
  if (s === "make the holes evenly spaced") {
    const holes = b.features.filter((f) => f.type === "hole");
    if (!holes.length) throw Error("Add holes to the selected body first.");
    const last = holes.at(-1);
    if (
      holes.some(
        (f) =>
          f.size !== last.size ||
          f.depth !== last.depth ||
          !["left", "center", "right"].includes(f.place),
      ) ||
      holes.length < 2
    )
      throw Error(
        "Use two or more matching individual holes for a linear pattern.",
      );
    b.features = b.features.filter((f) => f.type !== "hole");
    b.features.push({ ...last, place: "line", count: holes.length });
    return;
  }
  const key = s.match(new RegExp("\\b(" + dimPattern + ")\\b"))?.[1];
  if (key) {
    if (b.kind === "step")
      throw Error(
        "This imported solid has fixed base dimensions. You can move it or add features.",
      );
    const mode = s.match(
      /^(double|halve|reduce|increase|change|set|make)\b/,
    )?.[1];
    if (!mode) unsupported();
    const ms = readAll(s);
    const rest = s
      .replace(new RegExp(measure, "g"), " ")
      .replace(new RegExp("\\b(" + dimPattern + ")\\b", "g"), " ")
      .replace(
        /\b(double|halve|reduce|increase|change|set|make|a little|its|the|it|by|to|of|this|body|exactly)\b/g,
        "",
      )
      .trim();
    if (rest || ms.length > 1) unsupported();
    const old = b[dim[key]],
      delta = ms[0]?.value ?? (old * relative) / 100;
    let value;
    if (mode === "double" || mode === "halve") {
      if (ms.length) unsupported();
      value = old * (mode === "double" ? 2 : 0.5);
    } else if (mode === "reduce" || /shorter|narrower|thinner/.test(key))
      value = old - delta;
    else if (mode === "increase" || /taller|wider|deeper/.test(key))
      value = old + delta;
    else if (ms.length) value = delta;
    else unsupported();
    assign(b, dim[key], value);
    return;
  }
  const move = s.match(
    new RegExp(
      "^move (?:it|the body) " +
        measure +
        " (left|right|up|down|forward|back)$",
    ),
  );
  if (move) {
    const [k, sign] = {
      left: ["x", -1],
      right: ["x", 1],
      up: ["z", 1],
      down: ["z", -1],
      forward: ["y", -1],
      back: ["y", 1],
    }[move[3]];
    b[k] += sign * +move[1] * (units[move[2]] || 1);
    return;
  }
  unsupported();
}
export function interpret(project, command, relative = 10) {
  if (typeof command !== "string" || !command.trim() || command.length > 600)
    throw Error("Describe a change in 1 to 600 characters.");
  const parts = normalize(command).split(
    /\s*(?:;|,?\s+(?:and then|then)\s+|,?\s+and\s+(?=(?:put|add|round|cut|make|drill|move|double|reduce|create|fillet)\b)|,\s*(?=(?:round|put|add|cut|make|drill)\b))\s*/,
  );
  if (parts.length > 12) throw Error("Try fewer than 13 changes at once.");
  const p = structuredClone(validate(project));
  parts.forEach((s, i) => {
    try {
      single(p, s, relative);
      validate(p);
    } catch (e) {
      if (e instanceof Question) {
        const fill = e.fill;
        e.fill = (v) =>
          parts.map((part, j) => (j === i ? fill(v) : part)).join("; ");
      }
      throw e;
    }
  });
  return log(p, command.trim());
}
