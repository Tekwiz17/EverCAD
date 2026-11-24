import test from "node:test";
import assert from "node:assert/strict";
import init from "replicad-opencascadejs";
import { setOC, measureVolume } from "replicad";
import { solid } from "../src/geometry.js";
import { empty, body, catalog, validate } from "../src/model.js";
import { interpret, Question } from "../src/language.js";
test("blank on first use and native project round trip", () => {
  const p = empty();
  assert.equal(p.bodies.length, 0);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(p))), p);
});
test("acceptance workflow, clarify and rebuild", () => {
  const p = interpret(
    empty(),
    "Make a box that is 100 millimeters wide, 60 millimeters deep and 30 millimeters tall.",
  );
  assert.deepEqual(
    [p.bodies[0].w, p.bodies[0].d, p.bodies[0].h],
    [100, 60, 30],
  );
  let q;
  try {
    interpret(p, "Round the corners.");
  } catch (e) {
    q = e;
  }
  assert.ok(q instanceof Question);
  const rounded = interpret(p, q.fill("2 mm"));
  const tall = interpret(rounded, "Make it 10 millimeters taller.");
  assert.equal(tall.bodies[0].h, 40);
  assert.equal(tall.bodies[0].features.length, 1);
  assert.equal(
    interpret(tall, "Add a 4 mm hole in each corner").bodies[0].features.length,
    2,
  );
});
test("equivalent cube expressions", () => {
  for (const text of [
    "Make a 50 mm cube",
    "Create a cube that is 50 millimeters on each side",
    "Give me a square block measuring 5 centimeters in every direction",
    "Make a box that is 50 by 50 by 50",
  ]) {
    const b = interpret(empty(), text).bodies[0];
    assert.deepEqual([b.w, b.d, b.h], [50, 50, 50]);
  }
});
test("100,800 generated dimension commands", () => {
  for (const verb of ["make", "create", "build", "draw", "generate", "give me"])
    for (const noun of ["box", "plate", "block", "rectangular plate"])
      for (const unit of ["mm", "cm", "inches"])
        for (let w = 1; w <= 20; w++)
          for (let d = 1; d <= 10; d++)
            for (let h = 1; h <= 7; h++) {
              const b = interpret(
                  empty(),
                  verb +
                    " a " +
                    noun +
                    " " +
                    w +
                    " " +
                    unit +
                    " wide, " +
                    d +
                    " " +
                    unit +
                    " deep and " +
                    h +
                    " " +
                    unit +
                    " tall",
                ).bodies[0],
                s = { mm: 1, cm: 10, inches: 25.4 }[unit];
              assert.deepEqual([b.w, b.d, b.h], [w * s, d * s, h * s]);
            }
});
test("transactions reject partial requests, oversized parts, unknown data", () => {
  const p = empty();
  for (const cmd of [
    "Make a box and paint it green",
    "make a box; melt it",
    "make a 99999 mm cube",
    "make a box 5 mm tall with whiskers",
  ])
    assert.throws(() => interpret(p, cmd));
  assert.equal(p.bodies.length, 0);
  assert.throws(() => validate({ ...p, version: 4 }));
});
test("units, typos, context, patterns and compound clarification", () => {
  const p = interpret(
    empty(),
    "make a rectangular plate 100 mm wide, 60 mm deep and 5 mm thick, round the corners by 1 mm and put a 4 mm hole in each corner",
  );
  assert.equal(p.bodies[0].features.length, 2);
  assert.equal(
    interpret(empty(), "make a clyinder 1/2 inch wide").bodies[0].w,
    12.7,
  );
  assert.equal(interpret(empty(), "make a cube two inches").bodies[0].w, 50.8);
  try {
    interpret(empty(), "make a box; add a hole");
  } catch (q) {
    assert.equal(
      interpret(empty(), q.fill("5 mm")).bodies[0].features[0].size,
      5,
    );
  }
});
test("all registered templates produce a positive-volume closed solid; machining removes material", async () => {
  setOC(await init());
  for (const kind of Object.keys(catalog)) {
    const s = solid(body(kind));
    assert.ok(measureVolume(s) > 0, kind);
    assert.equal(s.solids.length, 1, kind);
    s.delete();
  }
  const b = body("box");
  const baseline = measureVolume(solid(b));
  b.features = [{ type: "hole", size: 4, depth: 0, place: "corners" }];
  assert.ok(
    Math.abs(baseline - measureVolume(solid(b)) - 4 * Math.PI * 4 * b.h) <
      0.0001,
  );
});
test("pattern count, chamfer, top fillet, shell, rotation and pyramid volume", async () => {
  setOC(await init());
  const start = interpret(empty(), "make a box");
  for (const cmd of [
    "add 5 holes of 3 mm in a line",
    "drill 6 holes of 2 mm around a circle",
    "chamfer the top edges by 2 mm",
    "round the top edges by 2 mm",
    "shell it with 2 mm walls",
    "rotate it 30 degrees",
  ]) {
    const b = interpret(start, cmd).bodies[0],
      v = measureVolume(solid(b));
    assert.ok(v > 0, cmd);
    if (!cmd.startsWith("rotate")) assert.ok(v < 60 * 40 * 30, cmd);
  }
  const b = body("pyramid");
  assert.ok(Math.abs(measureVolume(solid(b)) - (b.w * b.d * b.h) / 3) < 0.001);
});
