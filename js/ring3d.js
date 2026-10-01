// ring3d.js — the live ring in the about section (2026-09-30, Linzhi).
//
// The hero stays a film. As the about panel slides up, this canvas takes over from the film at the
// film's own position and size, carries the ring along an S to the left of the screen while it turns
// once, and leaves it there to be dragged round. Reference: neoconda.com, "About the device".
//
// Kept light on purpose, because the old live render stuttered: the model is Eric's bake run through
// gltf-transform (9.1 MB -> 0.6 MB, 3.0 M -> 0.6 M vertices, 1024 px WebP), no post-processing, no
// transmission (it renders the scene twice), pixel ratio capped at 1.5, and nothing is drawn while the
// ring is off screen or standing still.
//
// The screen shows what the film's does: the orange display with the ASPIRIUM wordmark (Linzhi,
// 2026-09-30 -- the firmware's ruby face, tried first, did not suit the ring at this size).
// ES module, loaded with an import map for "three" (index.html). Paths are relative to this file
// so build.mjs can rewrite them to hashed names.
import * as THREE from "three";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "../vendor/three/addons/loaders/DRACOLoader.js";

const MODEL = new URL("../assets/model/ring.glb", import.meta.url).href;
const DRACO = new URL("../vendor/three/draco/", import.meta.url).href;
const SCREEN_R = 10.4;                           // model units; the wordmark strip is 17 wide
const SCREEN_ORANGE = 0xf27346;                  // sampled off the film's last frame
const ORIENT = [Math.PI / 2, 0, 0];              // the bake's screen faces +Y; this turns it to the camera

const doc = document.documentElement;
const canvas = document.getElementById("ring3d");
const about = document.getElementById("about");
const stage = document.getElementById("about-stage");
const band = document.getElementById("band");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const bezier = (a, b, c, d, t) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

const hasWebGL2 = () => {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
};

// Without the live ring the about panel still reads: the copy is fully shown and the stage shows the poster.
const giveUp = err => {
  doc.classList.add("no-ring3d");
  if (about) about.style.setProperty("--ap", "1");
  if (err) console.info("[ring3d]", err.message || err);
};

if (!canvas || !about || !stage || !hasWebGL2()) giveUp(new Error("no WebGL2 or no about panel"));
else start().catch(giveUp);

async function start() {
  let raf = 0;                                   // the pending frame; wake() is called from setup onward
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // What the chrome reflects. The film's ring sits in black with a few hard lights, and polished metal
  // is nothing but its reflections, so a bright room (RoomEnvironment) turned it milky. This is a
  // black studio with soft boxes: a big one overhead, strips either side, a low fill.
  const studio = new THREE.Scene();
  const softbox = (w, h, x, y, z, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    studio.add(m);
  };
  softbox(6, 3, 0, 5, 2, 4.0);        // overhead
  softbox(1.2, 6, -5, 0.5, 1.5, 3.2); // left strip
  softbox(1.2, 6, 5, 0.5, -1, 2.4);   // right strip, set back
  softbox(5, 1.5, 0, -4.5, 3, 0.7);   // low fill
  softbox(3, 3, 0, 1, -6, 1.2);       // behind, for the rim
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio, 0.02).texture;
  pmrem.dispose();

  // A long lens: the ring is placed in screen space, and a narrow field keeps it from bending
  // when it sits off centre.
  const FOV = 22, DIST = 600;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 2000);
  camera.position.set(0, 0, DIST);
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(-250, 320, 420);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4);
  rim.position.set(320, -120, -300);
  scene.add(key, rim);

  const draco = new DRACOLoader().setDecoderPath(DRACO);
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(MODEL);
  draco.dispose();

  const model = gltf.scene;
  let logo = null;
  model.traverse(o => {
    if (o.isLight) o.intensity = 0;              // the bake's own lights were tuned for its renderer; ours light it
    if (!o.isMesh) return;
    const name = o.material && o.material.name;
    if (name === "screen_content_mat") {
      logo = o;                                  // the bake's wordmark strip (17 x 1): black letters, masked
    } else if (name === "screen_display") {
      o.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    } else if (o.material.metalness === 1) {
      o.material.roughness = 0.32;               // scales the bake's roughness map: polished, as in the film
      o.material.envMapIntensity = 1.4;
      if (o.material.normalMap) o.material.normalScale.set(2.5, 2.5);   // the bake's 10 reads as grit at this size
    } else if (name === "dome_glass") {
      // The lens over the screen. Real transmission would render the whole scene a second time, so
      // the glass is only its reflections, added on top: a black, glossy surface blended additively
      // leaves the screen under it untouched and lays the studio's highlights over the curve.
      o.material = new THREE.MeshPhysicalMaterial({
        color: 0x000000, metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02,
        envMapIntensity: 3.5, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
    }
  });

  // The lit display. In the bake it is black until its power-on animation, which this page does not
  // play, so it gets the film's orange as an unlit disc just under the wordmark.
  if (logo) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(SCREEN_R, 96),
      new THREE.MeshBasicMaterial({ color: SCREEN_ORANGE, toneMapped: false }),
    );
    disc.rotation.set(-Math.PI / 2, 0, 0);
    disc.position.copy(logo.position);
    disc.position.y += 0.02;                     // just clear of the display surface, or they fight in the depth buffer
    logo.parent.add(disc);
    logo.position.y += 0.05;                     // and the wordmark just clear of the disc
    logo.renderOrder = 1;
  }

  // The bake's screen faces +Y; stand the ring up so it faces the camera, then centre it on the pivot.
  const holder = new THREE.Group();
  holder.add(model);
  holder.rotation.set(ORIENT[0], ORIENT[1], ORIENT[2]);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  holder.position.sub(box.getCenter(new THREE.Vector3()));
  const ringH = box.getSize(new THREE.Vector3()).y;
  const pivot = new THREE.Group();
  pivot.add(holder);
  scene.add(pivot);
  if (new URLSearchParams(location.search).has("ring-debug")) window.__ring = { THREE, scene, camera, renderer, pivot, holder, model, wake: () => wake(), draw: () => frame(performance.now()) };

  // ---- dragging: yaw is free, pitch is limited, a flick keeps turning for a moment ----
  let dragYaw = 0, dragPitch = 0, vYaw = 0, vPitch = 0, drag = null, interactive = false;
  stage.addEventListener("pointerdown", e => {
    if (!interactive) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add("is-dragging");
    wake();
  });
  stage.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    vYaw = dx * 0.012; vPitch = dy * 0.008;
    dragYaw += vYaw;
    dragPitch = clamp(dragPitch + vPitch, -0.7, 0.7);
    wake();
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    stage.classList.remove("is-dragging");
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);   // the browser took it as a scroll
  stage.addEventListener("lostpointercapture", endDrag);

  // ---- where the ring is, from the scroll position ----
  const filmScale = () => parseFloat(getComputedStyle(band).getPropertyValue("--film-scale")) || 1;
  // the film's ring fills about 74% of the square frame's height (measured on its last frame)
  const FILM_RING = 0.74;

  let W = 0, H = 0;
  const resize = () => {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    wake();
  };

  const place = t => {
    const y0 = window.scrollY || 0;
    const top = about.offsetTop;                                 // the hero is one screen tall
    const p = clamp(y0 / Math.max(1, top), 0, 1);
    // The ring lands at 80% of the scroll; for the last stretch it rides up with the panel, locked to
    // the stage beside the copy. (Landing at 100% left it sitting high of the copy whenever the scroll
    // stopped a little short, which is most of the time.)
    const ARRIVE = 0.8;
    const e = reduced ? (p > 0 ? 1 : 0) : smooth(clamp(p / ARRIVE, 0, 1));
    const release = Math.max(0, y0 - (top + about.offsetHeight - H));

    const b = band.getBoundingClientRect();
    const sx = b.left + b.width / 2, sy = b.top + b.height / 2;
    const sh = b.height * FILM_RING * filmScale();
    // where the stage is right now: it moves with the panel, so the ring and the copy move as one
    const r = stage.getBoundingClientRect();
    const ex = r.left + r.width / 2, ey = r.top + r.height / 2;
    const eh = r.height * 0.86;

    // an S: out to the right, across past the stage, back onto it
    const x = bezier(sx, sx + W * 0.2, ex - W * 0.16, ex, e);
    const y = bezier(sy, lerp(sy, ey, 0.35) + H * 0.06, ey - H * 0.08, ey, e);
    const h = lerp(sh, eh, e);

    const upp = (2 * DIST * Math.tan((FOV * Math.PI) / 360)) / H;   // world units per CSS pixel at z = 0
    pivot.position.set((x - W / 2) * upp, -(y - H / 2) * upp, 0);
    pivot.scale.setScalar((h * upp) / ringH);

    interactive = p >= ARRIVE && release < H * 0.5;
    if (!drag) {                                                     // let a flick run down
      vYaw *= 0.94; vPitch *= 0.9;
      if (Math.abs(vYaw) > 1e-4) dragYaw += vYaw;
      if (Math.abs(vPitch) > 1e-4) dragPitch = clamp(dragPitch + vPitch, -0.7, 0.7);
    }
    const sway = (!reduced && interactive && !drag) ? Math.sin(t * 0.0006) * 0.14 : 0;
    pivot.rotation.set(
      Math.sin(Math.PI * e) * 0.45 + dragPitch,
      e * Math.PI * 2 + dragYaw + sway,
      Math.sin(Math.PI * e) * -0.18,
    );

    // the canvas takes over from the film at the very start of the scroll
    const show = reduced ? (p > 0 ? 1 : 0) : smooth(clamp(p / 0.08, 0, 1));
    canvas.style.opacity = show.toFixed(3);
    band.style.opacity = (1 - show).toFixed(3);
    about.style.setProperty("--ap", clamp((p - 0.4) / (ARRIVE - 0.4), 0, 1).toFixed(3));   // copy done when the ring lands
    stage.classList.toggle("is-live", interactive);

    const onScreen = show > 0 && release < H * 1.2;
    const moving = !reduced && (interactive || drag || Math.abs(vYaw) > 1e-4) || (p > 0 && p < 1) || release > 0;
    return { onScreen, moving };
  };

  // ---- drawing only when there is something to draw ----
  const frame = t => {
    raf = 0;
    const { onScreen, moving } = place(t);
    if (onScreen) renderer.render(scene, camera);
    if (onScreen && moving) wake();
  };
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }
  addEventListener("scroll", wake, { passive: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") wake(); });

  addEventListener("resize", resize);
  resize();                                      // sizes the canvas and asks for the first frame
  doc.classList.add("has-ring3d");
}
