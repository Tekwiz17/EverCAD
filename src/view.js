import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
export function viewport(el, onSelect, onChange) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  el.prepend(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "3D modeling viewport. Use the view tools to change the camera.",
  );
  renderer.domElement.setAttribute("role", "img");
  const scene = new T.Scene(),
    group = new T.Group();
  scene.add(group);
  scene.add(new T.HemisphereLight(0xfff5e8, 0x858d97, 2.4));
  const sun = new T.DirectionalLight(0xfff8ec, 2.8);
  sun.position.set(-80, -120, 200);
  scene.add(sun);
  let grid,
    axes,
    cam,
    controls,
    scale = 150,
    orient = "Isometric",
    perspective = false,
    tool = "orbit",
    items = [],
    selected = null;
  const center = new T.Vector3(),
    dir = {
      Isometric: [1, -1.42, 1.02],
      Top: [0, -0.0001, 1],
      Front: [0, -1, 0],
      Right: [1, 0, 0],
      Left: [-1, 0, 0],
      Back: [0, 1, 0],
      Bottom: [0, -0.0001, -1],
    };
  function theme(dark) {
    if (grid) {
      scene.remove(grid, axes);
      grid.geometry.dispose();
      grid.material.dispose();
      axes.children.forEach((c) => {
        c.geometry.dispose();
        c.material.dispose();
      });
    }
    grid = new T.GridHelper(
      4000,
      400,
      dark ? 0x52605d : 0xb7c5c1,
      dark ? 0x41514e : 0xcbd5d1,
    );
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.15;
    scene.add(grid);
    axes = new T.Group();
    for (const [v, c] of [
      [[2000, 0, 0], dark ? 0xa96757 : 0xb97b6a],
      [[0, 2000, 0], dark ? 0x679285 : 0x64948a],
    ]) {
      const geo = new T.BufferGeometry().setFromPoints([
        new T.Vector3(...v).multiplyScalar(-1),
        new T.Vector3(...v),
      ]);
      axes.add(new T.Line(geo, new T.LineBasicMaterial({ color: c })));
    }
    scene.add(axes);
    scene.fog = new T.FogExp2(dark ? 0x202d2a : 0xe8eeea, 0.0016);
    render();
  }
  const axisSvg = el.querySelector(".axislabel svg"),
    cubeSvg = el.querySelector("#cube svg");
  const svgNS = "http://www.w3.org/2000/svg";
  function svgNode(tag, attrs, txt) {
    const n = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (txt) n.textContent = txt;
    return n;
  }
  function gizmo() {
    const rot = cam.quaternion.clone().invert(),
      project = (v) => new T.Vector3(...v).applyQuaternion(rot);
    axisSvg.replaceChildren();
    for (const [i, label, color] of [
      [0, "X", "#af6152"],
      [1, "Y", "#528575"],
      [2, "Z", "#547ba9"],
    ]) {
      const v = [0, 0, 0];
      v[i] = 1;
      const q = project(v);
      axisSvg.append(
        svgNode("path", {
          d: "M32 32l" + q.x * 22 + " " + -q.y * 22,
          stroke: color,
          "stroke-width": 2,
        }),
        svgNode(
          "text",
          {
            x: 32 + q.x * 28,
            y: 35 - q.y * 28,
            "text-anchor": "middle",
            fill: "currentColor",
            "font-size": 10,
          },
          label,
        ),
      );
    }
    const sides = [
      [0, 1, "R", "Right"],
      [0, -1, "L", "Left"],
      [1, -1, "F", "Front"],
      [1, 1, "B", "Back"],
      [2, 1, "TOP", "Top"],
      [2, -1, "BTM", "Bottom"],
    ];
    cubeSvg.replaceChildren();
    for (const [axis, sign, label, name] of sides) {
      const v = [0, 0, 0];
      v[axis] = sign;
      const normal = project(v);
      if (normal.z < 0.015) continue;
      const a = (axis + 1) % 3,
        b = (axis + 2) % 3;
      const points = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]
        .map(([i, j]) => {
          v[a] = i;
          v[b] = j;
          const q = project(v);
          return [40 + q.x * 20, 40 - q.y * 20].join(",");
        })
        .join(" ");
      const shape = svgNode("polygon", {
        points,
        fill: ["#d3ded8", "#e5ebe7", "#fafcf9"][axis],
        stroke: "#718579",
        "stroke-width": 1,
        "data-view": name,
      });
      cubeSvg.append(
        shape,
        svgNode(
          "text",
          {
            x: 40 + normal.x * 20,
            y: 43 - normal.y * 20,
            "text-anchor": "middle",
            "font-size": 8,
            fill: "#34483d",
            "data-view": name,
          },
          label,
        ),
      );
    }
  }
  function render() {
    if (cam) {
      renderer.render(scene, cam);
      gizmo();
    }
  }
  function camera(view = orient) {
    orient = view;
    controls?.dispose();
    const a = el.clientWidth / Math.max(1, el.clientHeight);
    cam = perspective
      ? new T.PerspectiveCamera(35, a, 0.1, 40000)
      : new T.OrthographicCamera(
          (-scale * a) / 2,
          (scale * a) / 2,
          scale / 2,
          -scale / 2,
          0.1,
          40000,
        );
    cam.up.set(0, 0, 1);
    cam.position
      .copy(center)
      .add(
        new T.Vector3(...(dir[view] || dir.Isometric))
          .normalize()
          .multiplyScalar(perspective ? scale * 1.65 : scale * 3),
      );
    cam.lookAt(center);
    controls = new OrbitControls(cam, renderer.domElement);
    controls.target.copy(center);
    controls.maxPolarAngle = Math.PI * 0.98;
    controls.mouseButtons.LEFT = tool === "pan" ? T.MOUSE.PAN : T.MOUSE.ROTATE;
    controls.addEventListener("change", () => {
      render();
      onChange?.();
    });
    controls.update();
    render();
  }
  function size() {
    const w = el.clientWidth,
      h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    if (cam.isOrthographicCamera) {
      cam.left = (-scale * w) / h / 2;
      cam.right = -cam.left;
      cam.top = scale / 2;
      cam.bottom = -scale / 2;
    } else cam.aspect = w / h;
    cam.updateProjectionMatrix();
    render();
  }
  function fit(view = "Isometric") {
    const bounds = new T.Box3().setFromObject(group);
    if (bounds.isEmpty()) {
      center.set(0, 0, 0);
      scale = 150;
    } else {
      bounds.getCenter(center);
      const size = bounds.getSize(new T.Vector3());
      scale = Math.max(
        10,
        (size.length() * 1.32) / Math.min(1, el.clientWidth / el.clientHeight),
      );
    }
    camera(view);
    size();
  }
  function update(meshes, id, auto = true, face = null) {
    group.traverse((n) => {
      n.geometry?.dispose();
      if (n.material) n.material.dispose();
    });
    group.clear();
    items = meshes;
    selected = id;
    for (const m of meshes) {
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(m.vertices, 3));
      geo.setAttribute("normal", new T.Float32BufferAttribute(m.normals, 3));
      geo.setIndex(m.triangles);
      const mesh = new T.Mesh(
        geo,
        new T.MeshStandardMaterial({
          color: m.id === id ? 0xe59d5c : 0xb5c0c1,
          roughness: 0.55,
          metalness: 0.18,
        }),
      );
      mesh.userData = m;
      group.add(mesh);
      if (face && m.id === id && m.faceGroups[face - 1]) {
        const f = m.faceGroups[face - 1],
          g = geo.clone();
        g.setDrawRange(f.start, f.count);
        group.add(
          new T.Mesh(
            g,
            new T.MeshBasicMaterial({
              color: 0x6e9e91,
              polygonOffset: true,
              polygonOffsetFactor: -2,
              polygonOffsetUnits: -2,
            }),
          ),
        );
      }

      const edges = new T.BufferGeometry();
      edges.setAttribute("position", new T.Float32BufferAttribute(m.lines, 3));
      group.add(
        new T.LineSegments(
          edges,
          new T.LineBasicMaterial({
            color: 0x574c3d,
            transparent: true,
            opacity: 0.72,
          }),
        ),
      );
    }
    if (auto) fit();
    else render();
  }
  let down;
  renderer.domElement.onpointerdown = (e) => {
    down = [e.clientX, e.clientY];
  };
  renderer.domElement.onpointerup = (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4)
      return;
    const r = el.getBoundingClientRect(),
      ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        1 - ((e.clientY - r.top) / r.height) * 2,
      ),
      cam,
    );
    const hit = ray.intersectObjects(
      group.children.filter((o) => o.isMesh && o.userData.id),
    )[0];
    if (hit) {
      const m = hit.object.userData;
      const fi = m.faceGroups.findIndex(
        (f) =>
          hit.faceIndex * 3 >= f.start && hit.faceIndex * 3 < f.start + f.count,
      );
      onSelect(m.id, fi + 1);
    }
  };
  camera();
  theme(false);
  new ResizeObserver(size).observe(el);
  return {
    update,
    fit,
    theme,
    view: camera,
    projection(v) {
      perspective = v;
      camera();
    },
    tool(v) {
      tool = v;
      controls.mouseButtons.LEFT = v === "pan" ? T.MOUSE.PAN : T.MOUSE.ROTATE;
    },
    zoom(f) {
      if (cam.isOrthographicCamera) {
        cam.zoom = T.MathUtils.clamp(cam.zoom * f, 0.05, 100);
        cam.updateProjectionMatrix();
      } else
        cam.position
          .sub(controls.target)
          .multiplyScalar(1 / f)
          .add(controls.target);
      controls.update();
      render();
    },
    step(x, y) {
      const offset = cam.position.clone().sub(controls.target);
      const az = Math.atan2(offset.y, offset.x) + x,
        elv = T.MathUtils.clamp(
          Math.asin(offset.z / offset.length()) + y,
          -1.5,
          1.5,
        ),
        len = offset.length();
      cam.position
        .set(
          len * Math.cos(elv) * Math.cos(az),
          len * Math.cos(elv) * Math.sin(az),
          len * Math.sin(elv),
        )
        .add(controls.target);
      controls.update();
    },
    get selected() {
      return selected;
    },
  };
}
