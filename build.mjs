#!/usr/bin/env node
// site/build.mjs — static build for deployment. Copies the page to dist/ with
// content-hashed names for everything under assets/, css/ and js/, rewriting the
// references in HTML/CSS/JS (brief §3: separate hashed files, long cache headers —
// see _headers). No bundler; the page also runs straight from this folder.
//   node build.mjs [--out dist]
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outArg = process.argv.indexOf("--out");
const out = join(root, outArg >= 0 ? process.argv[outArg + 1] : "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const TEXT = new Set([".html", ".css", ".js", ".mjs", ".txt", ".md"]);
// CNAME must keep its exact name: GitHub Pages reads it out of the published artifact and
// takes the custom domain from it, so a hashed copy would be ignored.
const NOHASH = new Set(["_headers", "robots.txt", "index.html", "privacy.html", "CNAME"]);
const hashName = (rel, buf) => {
  const e = extname(rel); const h = createHash("sha256").update(buf).digest("hex").slice(0, 8);
  return rel.slice(0, -e.length) + "." + h + e;
};
// order: leaves first, so every file's references are already final when it is hashed
const order = [
  // Out of the deploy: the poster PNG masters (the JPEGs are what ship) and the retired lockup
  // raster. NOT the whole assets/mark folder — the house wordmark lives there and is referenced.
  ...walk(join(root, "assets")).filter(f => !/assets\/poster\/.*\.png$/.test(f) && !/assets\/mark\//.test(f)),   // both lockup rasters are retired; kept on disk for reuse
  join(root, "css/site.css"),
  // three.js for the live ring (js/ring3d.js): the core before the module that imports it, the
  // shared util before the loader that imports it
  join(root, "vendor/three/three.core.min.js"), join(root, "vendor/three/three.module.min.js"),
  join(root, "vendor/three/addons/utils/BufferGeometryUtils.js"),
  join(root, "vendor/three/addons/loaders/GLTFLoader.js"), join(root, "vendor/three/addons/loaders/DRACOLoader.js"),
  join(root, "vendor/three/draco/draco_wasm_wrapper.js"), join(root, "vendor/three/draco/draco_decoder.wasm"),
  join(root, "vendor/three/LICENSE"),
  join(root, "viewer/bundle.js"), join(root, "viewer/index.html"),
  join(root, "js/config.js"), join(root, "js/mark.js"), join(root, "js/viewer-stub.js"), join(root, "js/viewer-embed.js"), join(root, "js/viewer-video.js"), join(root, "js/main.js"), join(root, "js/ring3d.js"), join(root, "js/cursor-fx.js"),
  join(root, "privacy.html"), join(root, "index.html"), join(root, "robots.txt"), join(root, "_headers"),
  join(root, "CNAME"),
];
const mapping = new Map(); // source rel → dist rel
for (const abs of order) {
  const rel = relative(root, abs);
  let buf = readFileSync(abs);
  if (TEXT.has(extname(rel))) {
    let text = buf.toString("utf8");
    for (const [src, dst] of mapping) {
      const from = relative(dirname(rel), src).split("\\").join("/");
      const to = relative(dirname(rel), dst).split("\\").join("/");
      text = text.split("./" + from).join("./" + to).split(from).join(to);
    }
    buf = Buffer.from(text, "utf8");
  }
  // The Draco decoder is fetched by name from a folder (DRACOLoader.setDecoderPath), and LICENSE has no
  // extension to hash around; both keep their names.
  const keep = /[\\/]draco[\\/]/.test(rel) || basename(rel) === "LICENSE";
  const dst = (NOHASH.has(basename(rel)) || rel.endsWith(".md") || keep) ? rel : hashName(rel, buf);
  mapping.set(rel, dst);
  mkdirSync(join(out, dirname(dst)), { recursive: true });
  writeFileSync(join(out, dst), buf);
  console.log(rel === dst ? `  ${rel}` : `  ${rel} → ${dst}`);
}
console.log(`built ${mapping.size} files into ${relative(process.cwd(), out) || "."}`);
