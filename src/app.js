import "./style.css";
import { icons } from "./icons.js";
import { empty, validate, log, catalog, roundKinds, body } from "./model.js";
import { interpret, Question } from "./language.js";
import { viewport } from "./view.js";
const $ = (id) => document.getElementById(id),
  el = (tag, txt) =>
    Object.assign(document.createElement(tag), { textContent: txt || "" });
const icon = (n) => icons[n] || "",
  button = (name, fn, cls = "secondary") => {
    const b = el("button", name);
    b.className = cls;
    b.onclick = fn;
    return b;
  };
function tool(parent, id, label, svg, fn, visible = false) {
  const b = button("", fn, "");
  b.id = id;
  b.title = label;
  b.setAttribute("aria-label", label);
  b.innerHTML =
    icon(svg) + (visible ? '<span class="txt">' + label + "</span>" : "");
  $(parent).append(b);
  return b;
}
const bind = (id, n) => $(id).insertAdjacentHTML("afterbegin", icon(n));
let project = empty(),
  past = [],
  future = [],
  meshes = [],
  busy = false,
  job = null,
  viewer,
  face = null,
  saving = "Ready on this device",
  storageIssue = "",
  guideStep = 0,
  guideActive = false;
const key = "evercad.project.v1",
  prefsKey = "evercad.settings.v1";
let prefs = {
  theme: "System",
  size: "Standard",
  contrast: "Standard",
  units: "mm",
  mode: "Simple",
  relative: "10",
  projection: "Orthographic",
};
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(prefsKey) || "{}"));
} catch {}
function settings() {
  const dark =
    prefs.theme === "Dark" ||
    (prefs.theme === "System" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.contrast = prefs.contrast === "High";
  document.documentElement.style.fontSize =
    prefs.size === "Extra large"
      ? "20px"
      : prefs.size === "Large"
        ? "18px"
        : "16px";
  viewer?.theme(dark);
  $("mode").innerHTML = icon("sliders-horizontal") + prefs.mode + " mode";
  $("unitfoot").textContent = "Units · " + prefs.units;
  try {
    localStorage.setItem(prefsKey, JSON.stringify(prefs));
  } catch {}
}
function message(txt) {
  $("feedback").replaceChildren(document.createTextNode(txt));
}
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(project));
    saving = "Saved on this device";
    storageIssue = "";
  } catch {
    saving = "Local save unavailable";
    storageIssue = "Download a project copy using Save.";
  }
}
const active = () => project.bodies.find((b) => b.id === project.selected),
  unit = (n) =>
    Number((n / ({ mm: 1, cm: 10, in: 25.4 }[prefs.units] || 1)).toFixed(3)) +
    " " +
    prefs.units;
function dialog(title) {
  const m = $("modal");
  $("dialogbody").replaceChildren(el("h2", title));
  if (!m.open) m.showModal();
  return $("dialogbody");
}
function close() {
  if ($("modal").open) $("modal").close();
}
function confirmAction(title, desc, fn) {
  const d = dialog(title);
  d.append(
    el("p", desc),
    button("Continue", () => {
      close();
      fn();
    }),
  );
}
function download(blob, name) {
  const u = URL.createObjectURL(blob),
    a = el("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 30000);
}
function save() {
  download(
    new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
    project.name + ".evercad",
  );
  message("Project file prepared for download.");
}
function kernel(p, format) {
  return new Promise((res, rej) => {
    const worker = new Worker(new URL("./kernel.js", import.meta.url), {
      type: "module",
    });
    const finish = (fn, value) => {
      clearTimeout(timer);
      worker.terminate();
      job = null;
      fn(value);
    };
    const timer = setTimeout(
      () =>
        finish(
          rej,
          Error(
            "This operation took too long. Try a smaller part or fewer features.",
          ),
        ),
      90000,
    );
    job = () =>
      finish(rej, Error("Operation canceled. Your project is unchanged."));
    worker.onmessage = (e) =>
      e.data.error ? finish(rej, Error(e.data.error)) : finish(res, e.data);
    worker.onerror = () =>
      finish(
        rej,
        Error(
          "The modeling engine could not start. Reload the workspace and try again.",
        ),
      );
    worker.postMessage({ id: 1, project: p, format });
  });
}
async function process(
  p,
  { direction = "edit", format = null, success = "", fit = true } = {},
) {
  if (busy) return;
  busy = true;
  render();
  message(format ? "Preparing export…" : "Building geometry…");
  $("feedback").append(
    " ",
    button("Cancel", () => job?.()),
  );
  try {
    validate(p);
    const result = p.bodies.some((b) => b.visible)
      ? await kernel(p, format)
      : { meshes: [] };
    if (format) {
      if (!result.blob?.size) throw Error("Show a body before exporting.");
      download(result.blob, p.name + "." + format);
      message("Export prepared for download.");
      return true;
    }
    if (direction === "edit") {
      past.push(project);
      if (past.length > 80) past.shift();
      future = [];
    }
    if (direction === "undo") {
      future.push(project);
      past.pop();
    }
    if (direction === "redo") {
      past.push(project);
      future.pop();
    }
    project = p;
    meshes = result.meshes;
    face = null;
    if (direction !== "restore") persist();
    viewer?.update(meshes, p.selected, fit);
    message(success || "");
    return true;
  } catch (e) {
    message(e.message);
    return false;
  } finally {
    busy = false;
    render();
  }
}
function render() {
  $("projectname").textContent = project.name;
  $("savestate").innerHTML = icon("hard-drive");
  $("savestate").append(saving);
  $("savestate").title = storageIssue;
  $("bodycount").textContent =
    project.bodies.length +
    " " +
    (project.bodies.length === 1 ? "body" : "bodies");
  $("undo").disabled = busy || !past.length;
  $("redo").disabled = busy || !future.length;
  for (const id of [
    "new",
    "open",
    "export",
    "apply",
    "rename",
    "guide",
    "mode",
    "examples",
    "settings",
  ])
    $(id).disabled = busy || (id === "export" && !meshes.length);
  $("apply").innerHTML =
    icon("drafting-compass") +
    (busy
      ? "Working…"
      : project.bodies.length
        ? "Apply command"
        : "Create model") +
    icon("arrow-right");
  const b = active();
  $("dims").textContent = b
    ? [b.w, b.d, b.h].map(unit).join(" × ") + (face ? " · Face " + face : "")
    : "";
  $("dims").hidden =
    !b || $("dimension").getAttribute("aria-pressed") !== "true";
  const list = el("ol");
  for (const m of project.history.slice().reverse()) list.append(el("li", m));
  $("timeline").replaceChildren(
    project.history.length
      ? list
      : el("p", "Your modeling actions will appear here."),
  );
  inspect();
  if (guideActive) guideHint();
}
function mutate(fn, label) {
  try {
    const p = structuredClone(project);
    fn(
      p,
      p.bodies.find((b) => b.id === p.selected),
    );
    return process(log(p, label), { success: label });
  } catch (e) {
    message(e.message);
  }
}
function inspect() {
  const area = $("advanced");
  area.hidden = prefs.mode !== "Advanced";
  area.replaceChildren();
  if (area.hidden) return;
  area.append(el("h3", "Body properties"));
  const b = active();
  if (!b) {
    area.append(el("p", "Create a body to edit its properties."));
    return;
  }
  const sel = el("select");
  sel.className = "field";
  sel.setAttribute("aria-label", "Selected body");
  for (const item of project.bodies)
    sel.add(new Option(item.name + (item.visible ? "" : " (hidden)"), item.id));
  sel.value = b.id;
  sel.onchange = () => select(sel.value);
  area.append(sel);
  const fields = el("form");
  fields.className = "inspector";
  for (const [k, name] of Object.entries({
    name: "Name",
    w: roundKinds.has(b.kind) ? "Diameter" : "Width",
    d: "Depth",
    h: "Height",
    x: "X position",
    y: "Y position",
    z: "Z position",
    angle: "Rotation (°)",
  })) {
    if (b.kind === "step" && ["w", "d", "h"].includes(k)) continue;
    if (
      roundKinds.has(b.kind) &&
      (k === "d" || (b.kind === "sphere" && k === "h"))
    )
      continue;
    const l = el(
        "label",
        name + (["name", "angle"].includes(k) ? "" : " (mm)"),
      ),
      i = el("input");
    i.name = k;
    i.type = k === "name" ? "text" : "number";
    i.step = "any";
    i.required = true;
    i.value = b[k];
    l.append(i);
    fields.append(l);
  }
  const apply = button("Update body", null);
  apply.type = "submit";
  fields.append(apply);
  fields.onsubmit = (e) => {
    e.preventDefault();
    mutate((p, v) => {
      for (const [k, n] of new FormData(fields))
        v[k] = k === "name" ? n : Number(n);
      if (roundKinds.has(v.kind)) v.d = v.w;
      if (v.kind === "sphere") v.h = v.w;
    }, "Updated body properties");
  };
  area.append(fields);
  const actions = el("div");
  actions.className = "row";
  actions.append(
    button(b.visible ? "Hide" : "Show", () =>
      mutate(
        (p, v) => (v.visible = !v.visible),
        b.visible ? "Hid body" : "Showed body",
      ),
    ),
    button("Duplicate", () => applyCommand("Duplicate it")),
    button("Delete body", () =>
      confirmAction("Delete this body?", b.name, () =>
        mutate((p) => {
          p.bodies = p.bodies.filter((x) => x.id !== b.id);
          p.selected = p.bodies.at(-1)?.id || null;
        }, "Deleted " + b.name),
      ),
    ),
  );
  area.append(actions);
  b.features.forEach((f, i) => {
    const row = el("div");
    row.className = "row";
    row.append(
      el("span", i + 1 + ". " + f.type + " · " + unit(f.size)),
      button("Remove", () =>
        confirmAction("Remove this feature?", f.type, () =>
          mutate((p, v) => v.features.splice(i, 1), "Removed " + f.type),
        ),
      ),
    );
    area.append(row);
  });
  area
    .querySelectorAll("button,input,select")
    .forEach((c) => (c.disabled = busy));
}
function select(id, which = null) {
  if (busy) return;
  project = { ...project, selected: id };
  face = which;
  viewer?.update(meshes, id, false, which);
  persist();
  render();
  if (which)
    message(
      (active()?.name || "Body") +
        " · Face " +
        which +
        " selected. Commands act on the body.",
    );
}
async function applyCommand(text) {
  try {
    const p = interpret(project, text, Number(prefs.relative));
    const b = p.bodies.find((b) => b.id === p.selected);
    if (
      await process(p, {
        success: b
          ? b.name + " · " + [b.w, b.d, b.h].map(unit).join(" × ")
          : "Change applied.",
      })
    )
      $("command").value = "";
  } catch (e) {
    if (!(e instanceof Question)) {
      message(e.message);
      return;
    }
    message(e.message);
    const r = el("div");
    r.className = "row";
    const fill = (v) => {
      try {
        applyCommand(e.fill(v));
      } catch (err) {
        message(err.message);
      }
    };
    for (const opt of e.options) r.append(button(opt, () => fill(opt)));
    const custom = el("input");
    custom.placeholder = "Custom size";
    custom.setAttribute("aria-label", "Custom measurement");
    r.append(
      custom,
      button("Use size", () => fill(custom.value)),
    );
    $("feedback").append(r);
  }
}
const examples = [
  [
    "Mounting plate",
    "100 × 60 × 5 mm",
    "layers-3",
    "Make a rectangular plate 100 mm wide, 60 mm deep and 5 mm thick and put a 4 mm hole in each corner.",
  ],
  [
    "Hollow spacer",
    "18 mm outer diameter",
    "cylinder",
    "Make a spacer 18 mm wide and 20 mm tall.",
  ],
  [
    "Parts tray",
    "90 × 65 × 18 mm",
    "box",
    "Make a parts tray 90 mm wide, 65 mm deep and 18 mm tall.",
  ],
];
function example(item) {
  const [title, detail, n, cmd] = item;
  const b = button(
    "",
    () => {
      close();
      $("compose").click();
      $("command").value = cmd;
      $("command").focus();
    },
    "example",
  );
  b.innerHTML = icon(n);
  const t = el("span");
  t.append(el("strong", title), el("small", detail));
  b.append(t);
  b.insertAdjacentHTML("beforeend", icon("chevron-right"));
  return b;
}
for (const ex of examples) $("exampleslist").append(example(ex));
$("examples").onclick = () => {
  const d = dialog("Example commands"),
    search = el("input");
  search.type = "search";
  search.placeholder = "Search parts and commands";
  search.setAttribute("aria-label", "Search examples");
  const list = el("div");
  const all = [
    ...examples,
    ...Object.entries(catalog).map(([k, [n, w, dep, h]]) => [
      n,
      [w, dep, h].join(" × ") + " mm",
      "box",
      "Make a " + k,
    ]),
    ["Round corners", "Choose a radius", "layers-3", "Round the corners"],
    ["Increase height", "Add 10 mm", "ruler", "Make it 10 mm taller"],
    [
      "Corner holes",
      "4 mm diameter",
      "disc-3",
      "Add a 4 mm hole in each corner",
    ],
  ];
  const show = () => {
    list.replaceChildren(
      ...all
        .filter((a) =>
          a.join(" ").toLowerCase().includes(search.value.toLowerCase()),
        )
        .map(example),
    );
    if (!list.children.length) list.append(el("p", "No matching examples."));
  };
  search.oninput = show;
  show();
  d.append(search, list);
};
$("apply").onclick = () => applyCommand($("command").value);
$("command").onkeydown = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") $("apply").click();
};
tool(
  "filetools",
  "new",
  "New",
  "file-plus",
  () => {
    const create = () => process(empty(), { success: "New project ready." });
    project.bodies.length || project.history.length
      ? confirmAction(
          "Start a new project?",
          "Save a project file first to keep this one separately.",
          create,
        )
      : create();
  },
  true,
);
tool(
  "filetools",
  "open",
  "Open",
  "folder-open",
  () => $("upload").click(),
  true,
);
tool("filetools", "save", "Save", "save", save, true);
$("upload").onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    if (f.size > 25e6) throw Error("Choose a project file under 25 MB.");
    if (/\.st(e)?p$/i.test(f.name)) {
      if (f.size > 1500000) throw Error("Choose a STEP file under 1.5 MB.");
      const p = structuredClone(project),
        b = body("box");
      Object.assign(b, {
        kind: "step",
        source: await f.text(),
        name: f.name.replace(/\.st(e)?p$/i, "").slice(0, 100),
      });
      p.bodies.push(b);
      p.selected = b.id;
      validate(p);
      busy = true;
      render();
      message("Reading STEP geometry…");
      let dimensions;
      try {
        dimensions = (await kernel(p, "inspect-step")).dimensions;
      } finally {
        busy = false;
        render();
      }
      [b.w, b.d, b.h] = dimensions;
      const others = p.bodies.slice(0, -1);
      if (others.length)
        b.x = Math.max(...others.map((o) => o.x + o.w / 2)) + b.w / 2 + 10;
      await process(log(p, "Imported " + b.name), {
        success:
          "Imported one STEP solid. The body is centered on its local origin.",
      });
      return;
    }
    const p = validate(JSON.parse(await f.text()));
    const open = () => process(p, { success: "Opened " + p.name });
    project.bodies.length
      ? confirmAction(
          "Open this project?",
          "Save the current project first to keep a separate copy.",
          open,
        )
      : open();
  } catch (err) {
    message(
      err instanceof SyntaxError
        ? "This file is not a readable EverCAD project."
        : err.message,
    );
  }
};
tool(
  "histtools",
  "undo",
  "Undo",
  "undo-2",
  () =>
    past.length &&
    process(past.at(-1), {
      direction: "undo",
      success: "Undid the last action.",
    }),
);
tool(
  "histtools",
  "redo",
  "Redo",
  "redo-2",
  () =>
    future.length &&
    process(future.at(-1), {
      direction: "redo",
      success: "Restored the action.",
    }),
);
for (const [id, n] of Object.entries({
  settings: "settings-2",
  rename: "pencil",
  export: "download",
  guide: "book-open",
  history: "history",
  compose: "drafting-compass",
}))
  bind(id, n);
$("export").onclick = () => {
  const d = dialog("Export model");
  d.append(
    el(
      "p",
      "Export the visible bodies. Save an EverCAD project to keep editable features and history.",
    ),
  );
  for (const [f, t] of [
    ["step", "STEP · Fusion solid"],
    ["stl", "STL · Triangle mesh"],
    ["3mf", "3MF · 3D printing"],
  ])
    d.append(
      button(
        t,
        () => {
          close();
          process(project, { format: f });
        },
        "example",
      ),
    );
};
$("rename").onclick = () => {
  const d = dialog("Rename project"),
    i = el("input");
  i.maxLength = 120;
  i.value = project.name;
  i.setAttribute("aria-label", "Project name");
  d.append(
    i,
    button("Rename", () => {
      if (i.value.trim()) {
        close();
        mutate((p) => (p.name = i.value.trim()), "Renamed project");
      }
    }),
  );
  i.select();
};
function setup() {
  const d = dialog("Workspace settings");
  for (const [k, title, opts] of [
    ["theme", "Appearance", ["System", "Light", "Dark"]],
    ["size", "Text size", ["Standard", "Large", "Extra large"]],
    ["contrast", "Contrast", ["Standard", "High"]],
    ["units", "Display units", ["mm", "cm", "in"]],
    ["mode", "Modeling tools", ["Simple", "Advanced"]],
    ["relative", "Relative change (%)", ["5", "10", "20"]],
    ["projection", "Camera", ["Orthographic", "Perspective"]],
  ]) {
    const row = el("div");
    row.className = "setting";
    const l = el("label", title),
      s = el("select");
    s.id = "pref-" + k;
    l.htmlFor = s.id;
    opts.forEach((o) => s.add(new Option(o, o)));
    s.value = prefs[k];
    s.onchange = () => {
      prefs[k] = s.value;
      settings();
      if (k === "projection") viewer?.projection(s.value === "Perspective");
      render();
    };
    row.append(l, s);
    d.append(row);
  }
  d.append(
    el(
      "p",
      "For voice input, use your device’s keyboard dictation in the command field. EverCAD does not request microphone access.",
    ),
  );
}
$("settings").onclick = setup;
$("mode").onclick = () => {
  prefs.mode = prefs.mode === "Simple" ? "Advanced" : "Simple";
  settings();
  render();
};
$("paneltoggle").onclick = () => {
  const c = document.querySelector("main").classList.toggle("collapsed");
  $("paneltoggle").textContent = c ? "Show panel" : "Hide panel";
  $("paneltoggle").setAttribute("aria-expanded", String(!c));
};
function tab(history) {
  $("editor").hidden = history;
  $("timeline").hidden = !history;
  $("compose").setAttribute("aria-pressed", String(!history));
  $("history").setAttribute("aria-pressed", String(history));
}
$("compose").onclick = () => tab(false);
$("history").onclick = () => tab(true);
const steps = [
  [
    "Describe a part",
    "Type “Make a 50 mm cube” in the command field and press Create model.",
  ],
  [
    "Inspect the part",
    "Drag over the grid to orbit. Use the view menu for a top or front view.",
  ],
  ["Change a dimension", "Type “Make it 10 mm taller” and apply the command."],
  [
    "Undo a change",
    "Use Undo beside the project title. Redo restores the change.",
  ],
  [
    "Keep your work",
    "Save downloads an editable project. Export creates a solid or printable mesh.",
  ],
];
function guideHint() {
  let box = $("guidehint");
  if (!box) {
    box = el("section");
    box.id = "guidehint";
    box.className = "guidehint";
    $("panel").prepend(box);
  }
  const [t, s] = steps[guideStep];
  box.replaceChildren(
    el("strong", guideStep + 1 + " / 5 · " + t),
    el("p", s),
    button(guideStep === 4 ? "Finish" : "Next", () => {
      if (guideStep === 4) {
        guideActive = false;
        box.remove();
      } else {
        guideStep++;
        guideHint();
      }
    }),
    button("Skip guide", () => {
      guideActive = false;
      box.remove();
    }),
  );
}
$("guide").onclick = () => {
  guideStep = 0;
  guideActive = true;
  guideHint();
  $("guidehint").scrollIntoView({ block: "nearest" });
};
for (const [id, label, n, fn] of [
  ["orbit", "Orbit", "orbit", () => mode("orbit")],
  ["pan", "Pan", "hand", () => mode("pan")],
  ["zoomin", "Zoom in", "zoom-in", () => viewer?.zoom(1.25)],
  ["zoomout", "Zoom out", "zoom-out", () => viewer?.zoom(0.8)],
  [
    "fit",
    "Fit and reset camera",
    "scan",
    () => {
      viewer?.fit();
      $("view").value = "Isometric";
    },
  ],
  [
    "dimension",
    "Show dimensions",
    "ruler",
    () => {
      const b = $("dimension");
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
      render();
    },
  ],
])
  tool("viewtools", id, label, n, fn);
function mode(n) {
  viewer?.tool(n);
  for (const id of ["orbit", "pan"])
    $(id).setAttribute("aria-pressed", String(id === n));
}
$("dimension").setAttribute("aria-pressed", "false");
mode("orbit");
$("view").onchange = () => viewer?.view($("view").value);
$("cube").onclick = (e) => {
  const s = $("view"),
    v = e.target.dataset.view;
  if (v) s.value = v;
  else s.selectedIndex = (s.selectedIndex + 1) % s.options.length;
  s.onchange();
};
$("stage").onkeydown = (e) => {
  const dirs = {
    ArrowLeft: [-0.14, 0],
    ArrowRight: [0.14, 0],
    ArrowUp: [0, 0.14],
    ArrowDown: [0, -0.14],
  };
  if (e.target !== $("stage")) return;
  if (dirs[e.key]) {
    e.preventDefault();
    viewer?.step(...dirs[e.key]);
  }
  if (e.key === "+" || e.key === "=") viewer?.zoom(1.25);
  if (e.key === "-") viewer?.zoom(0.8);
};
document.onkeydown = (e) => {
  if ($("modal").open || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    $(e.shiftKey ? "redo" : "undo").click();
  }
};
try {
  viewer = viewport($("stage"), select);
  viewer.projection(prefs.projection === "Perspective");
} catch {
  const n = $("stageNotice");
  n.hidden = false;
  n.textContent =
    "3D display requires WebGL. Enable graphics acceleration to inspect the model.";
}
settings();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", settings);
render();
try {
  const raw = localStorage.getItem(key);
  if (raw) {
    const p = validate(JSON.parse(raw));
    if (await process(p, { direction: "restore" })) {
      saving = "Saved on this device";
      render();
    }
  }
} catch {
  message(
    "The saved project could not be restored. Open a downloaded project copy.",
  );
}
