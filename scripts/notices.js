import { readFile, writeFile } from "node:fs/promises";
const deps = [
  "replicad",
  "replicad-opencascadejs",
  "three",
  "fflate",
  "lucide-static",
  "opentype.js",
  "flatbush",
  "flatqueue",
];
const notices = [
  "EverCAD third-party notices",
  "CAD kernel distribution: https://github.com/sgenoud/replicad/tree/main/packages/replicad-opencascadejs",
  "OpenCascade.js source: https://github.com/donalffons/opencascade.js",
  "Open CASCADE Technology source: https://github.com/Open-Cascade-SAS/OCCT",
];
for (const name of deps) {
  const base = "node_modules/" + name + "/";
  const p = JSON.parse(await readFile(base + "package.json"));
  let license = "";
  for (const file of ["LICENSE", "LICENSE.txt", "LICENSE.md", "LICENSE.TXT"]) {
    try {
      license = await readFile(base + file, "utf8");
      break;
    } catch {}
  }
  notices.push(name + " " + p.version + " · " + p.license, license);
}
await writeFile("dist/THIRD-PARTY-NOTICES.txt", notices.join("\n\n"));
