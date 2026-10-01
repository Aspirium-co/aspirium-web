// cursor-fx.js — a fluid under the mouse, shown through a dot matrix (2026-09-30, Linzhi).
//
// The black ground is secretly a dot matrix, the way the ring's own 160x160 screen is. Under it runs
// a small fluid: the pointer stirs it and pours into it, and wherever the fluid is, the dots light
// up. Each dot is lit as a whole, from the fluid at its centre, so it reads as pixels; at the thick
// core they close up into a solid patch.
//
// Why a real fluid. The reference (buttermax.net, and Linzhi's screen recording of it) leaves a mark
// that is wide where the hand moved fast and thin where it slowed, reaches across half the screen,
// and keeps moving after the pointer stops -- spreading, splitting into islands and threads for
// several seconds. A string of circles (tried first) cannot do that, nor can a velocity field
// without pressure (tried second). This is the standard stable-fluids loop, as in Pavel
// Dobryakov's WebGL Fluid Simulation: curl and vorticity confinement for the swirl, a pressure
// solve so it spreads instead of piling up, then advection of velocity and dye.
//
// Blended with `difference` (css/site.css .pixels): the dots show in their own colour on the black
// ground, and text under them turns to its complement -- black under the white core. Over the ring
// there are no dots; it breaks up like a bad signal instead, from the mask this shares
// (window.__inkMask). Only from the about panel down; the opening film is left alone.
// Mouse only, nothing under reduced motion, and nothing without half-float render targets.
// Drawn only while there is fluid left.

const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("pixels");

const CFG = {
  SIM: 128,                 // velocity grid, on the short side
  DYE: 384,                 // dye grid, on the short side
  VEL_DISSIPATION: 0.35,    // per second; low, so the fluid keeps moving after the pointer stops
  DYE_DISSIPATION: 0.9,     // per second; the mark lasts about three seconds
  PRESSURE: 0.8,
  PRESSURE_ITER: 18,
  CURL: 28,                 // vorticity confinement: curls and breaks the mark up
  FORCE: 4000,
  RADIUS: 0.0011,           // brush, as a fraction of the screen area; grows with speed
  PITCH: 11,                // CSS px between dots
  KEEP_MS: 7000,            // keep simulating this long after the pointer stops
};
// The smoke runs from white at its thick core to a deep orange-red at its thin edge (Linzhi,
// 2026-10-01: the red is what the screen's orange made where it crossed the film's grey halo).
// White at the core also means text under it turns fully black under the difference blend.
const EDGE = [178 / 255, 52 / 255, 22 / 255];      // #B23416
const CORE = [1, 1, 1];
const OPACITY = 0.8;      // the whole smoke, so it sits back from the page (Linzhi, 2026-10-01)
const MASK_W = 160;       // width of the shared ink mask

// Where the ink is, for js/ring3d.js: the ring breaks up like a bad signal wherever the smoke passes
// behind it. Rows run bottom-up, as WebGL reads them.
const inkMask = { data: null, w: 0, h: 0, frame: 0, active: false };
window.__inkMask = inkMask;

const gl = canvas && fine && !reduced
  ? canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, alpha: true, depth: false, stencil: false })
  : null;

if (gl) {
  try { start(); } catch (err) { console.info("[cursor-fx]", err.message); }
}

function start() {
  if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("no float render targets");

  const BASE_VS = `#version 300 es
precision highp float;
in vec2 a;
uniform vec2 texel;
out vec2 vUv, vL, vR, vT, vB;
void main() {
  vUv = a * .5 + .5;
  vL = vUv - vec2(texel.x, 0.); vR = vUv + vec2(texel.x, 0.);
  vT = vUv + vec2(0., texel.y); vB = vUv - vec2(0., texel.y);
  gl_Position = vec4(a, 0., 1.);
}`;
  const head = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB;
out vec4 o;
`;
  const FS = {
    splat: head + `uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
void main() {
  vec2 p = vUv - point; p.x *= aspect;
  o = vec4(texture(uTarget, vUv).xyz + exp(-dot(p, p) / radius) * color, 1.);
}`,
    advect: head + `uniform sampler2D uVelocity, uSource; uniform vec2 texel; uniform float dt, dissipation;
void main() {
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texel;
  o = texture(uSource, coord) / (1. + dissipation * dt);
}`,
    curl: head + `uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y, R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x, B = texture(uVelocity, vB).x;
  o = vec4(.5 * (R - L - T + B), 0., 0., 1.);
}`,
    vorticity: head + `uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
void main() {
  float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  f /= length(f) + .0001;
  f *= curl * C; f.y *= -1.;
  vec2 v = texture(uVelocity, vUv).xy + f * dt;
  o = vec4(clamp(v, -1000., 1000.), 0., 1.);
}`,
    divergence: head + `uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x;
  if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y;
  o = vec4(.5 * (R - L + T - B), 0., 0., 1.);
}`,
    clear: head + `uniform sampler2D uTexture; uniform float value;
void main() { o = value * texture(uTexture, vUv); }`,
    pressure: head + `uniform sampler2D uPressure, uDivergence;
void main() {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  o = vec4((L + R + B + T - texture(uDivergence, vUv).x) * .25, 0., 0., 1.);
}`,
    gradient: head + `uniform sampler2D uPressure, uVelocity;
void main() {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x, T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  o = vec4(texture(uVelocity, vUv).xy - vec2(R - L, T - B), 0., 1.);
}`,
    // where the ink is, as 0..1, for js/ring3d.js to read back
    mask: head + `uniform sampler2D uDye;
void main() { o = vec4(smoothstep(.06, .45, texture(uDye, vUv).x)); }`,
    // the dot matrix: every dot is lit as a whole by the dye at its centre
    dots: head + `uniform sampler2D uDye; uniform vec2 res; uniform float dpr, pitch; uniform vec4 ring; uniform vec3 edge, core;
void main() {
  vec2 p = vec2(gl_FragCoord.x / dpr, res.y - gl_FragCoord.y / dpr);
  vec2 c = (floor(p / pitch) + .5) * pitch;
  float d = texture(uDye, vec2(c.x / res.x, 1. - c.y / res.y)).x;
  float k = smoothstep(.06, .45, d);
  if (ring.z > 0.) k *= smoothstep(.95, 1.1, length((c - ring.xy) / ring.zw));   // the ring has its own effect
  if (k < .04) discard;
  vec2 f = abs(p - c) / pitch;
  // Dots grow as the smoke thickens and close up into a solid patch at its core. A gap between
  // dots cut every glyph lying over them in two, half inverted and half not, which read as noise.
  if (max(f.x, f.y) > mix(.2, .51, smoothstep(.55, .95, k))) discard;
  // the red stays full at the thin edge (only the dots shrink there); white only at the thickest
  vec3 color = mix(edge, core, smoothstep(.75, 1.4, d));   // by the dye itself, which runs past 1 when fresh
  float lit = mix(.65, 1., smoothstep(.04, .4, k)) * ${OPACITY.toFixed(2)};
  o = vec4(color * lit, lit);
}`,
  };

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, BASE_VS);
  const programs = {};
  for (const [name, src] of Object.entries(FS)) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, "a");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const un = gl.getActiveUniform(p, i).name;
      u[un] = gl.getUniformLocation(p, un);
    }
    programs[name] = { p, u };
  }

  gl.bindVertexArray(gl.createVertexArray());
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const target = (w, h, internal, format) => {
    gl.activeTexture(gl.TEXTURE0);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f, w, h };
  };
  const double = (w, h, internal, format) => {
    const d = { read: target(w, h, internal, format), write: target(w, h, internal, format), w, h };
    d.swap = () => { const r = d.read; d.read = d.write; d.write = r; };
    return d;
  };
  const gridSize = n => {
    const a = innerWidth / innerHeight;
    return a >= 1 ? [Math.round(n * a), n] : [n, Math.round(n / a)];
  };

  let W = 0, H = 0, dpr = 1, vel, dye, div, curl, pres, maskT;
  // a small 8-bit copy of the ink, read back every frame and shared (window.__inkMask)
  const mask8 = (w, h) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  };
  const resize = () => {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const [sw, sh] = gridSize(CFG.SIM), [dw, dh] = gridSize(CFG.DYE);
    vel = double(sw, sh, gl.RG16F, gl.RG);
    dye = double(dw, dh, gl.R16F, gl.RED);
    div = target(sw, sh, gl.R16F, gl.RED);
    curl = target(sw, sh, gl.R16F, gl.RED);
    pres = double(sw, sh, gl.R16F, gl.RED);
    maskT = mask8(MASK_W, Math.max(8, Math.round(MASK_W * H / W)));
    inkMask.data = new Uint8Array(maskT.w * maskT.h * 4);
    inkMask.w = maskT.w; inkMask.h = maskT.h;
  };

  // The smoke belongs to the about panel and below (Linzhi, 2026-10-01): over the opening film it
  // fought the film's grey halo, had to cut a hole round the filmed ring, and pulled the eye off an
  // intro that is there to be watched. It starts once the about panel is half way up.
  const about = document.getElementById("about");
  const engaged = () => !about || (window.scrollY || 0) >= about.offsetTop * 0.5;

  let unit = 0;
  const bind = t => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); return unit++; };
  const run = (name, out, texel, set) => {
    const pr = programs[name];
    gl.useProgram(pr.p);
    unit = 0;
    if (pr.u.texel && texel) gl.uniform2f(pr.u.texel, texel[0], texel[1]);
    set(pr.u);
    if (out) { gl.bindFramebuffer(gl.FRAMEBUFFER, out.f); gl.viewport(0, 0, out.w, out.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const splat = (x, y, dx, dy, r, amount) => {
    const tv = [1 / vel.w, 1 / vel.h], aspect = W / H;
    run("splat", vel.write, tv, u => {
      gl.uniform1i(u.uTarget, bind(vel.read.t));
      gl.uniform1f(u.aspect, aspect); gl.uniform2f(u.point, x, y);
      gl.uniform3f(u.color, dx, dy, 0); gl.uniform1f(u.radius, r);
    });
    vel.swap();
    run("splat", dye.write, [1 / dye.w, 1 / dye.h], u => {
      gl.uniform1i(u.uTarget, bind(dye.read.t));
      gl.uniform1f(u.aspect, aspect); gl.uniform2f(u.point, x, y);
      gl.uniform3f(u.color, amount, 0, 0); gl.uniform1f(u.radius, r);
    });
    dye.swap();
  };

  const step = dt => {
    const tv = [1 / vel.w, 1 / vel.h];
    run("curl", curl, tv, u => { gl.uniform1i(u.uVelocity, bind(vel.read.t)); });
    run("vorticity", vel.write, tv, u => {
      gl.uniform1i(u.uVelocity, bind(vel.read.t)); gl.uniform1i(u.uCurl, bind(curl.t));
      gl.uniform1f(u.curl, CFG.CURL); gl.uniform1f(u.dt, dt);
    });
    vel.swap();
    run("divergence", div, tv, u => { gl.uniform1i(u.uVelocity, bind(vel.read.t)); });
    run("clear", pres.write, tv, u => { gl.uniform1i(u.uTexture, bind(pres.read.t)); gl.uniform1f(u.value, CFG.PRESSURE); });
    pres.swap();
    for (let i = 0; i < CFG.PRESSURE_ITER; i++) {
      run("pressure", pres.write, tv, u => { gl.uniform1i(u.uPressure, bind(pres.read.t)); gl.uniform1i(u.uDivergence, bind(div.t)); });
      pres.swap();
    }
    run("gradient", vel.write, tv, u => { gl.uniform1i(u.uPressure, bind(pres.read.t)); gl.uniform1i(u.uVelocity, bind(vel.read.t)); });
    vel.swap();
    run("advect", vel.write, tv, u => {
      const t = bind(vel.read.t);
      gl.uniform1i(u.uVelocity, t); gl.uniform1i(u.uSource, t);
      gl.uniform1f(u.dt, dt); gl.uniform1f(u.dissipation, CFG.VEL_DISSIPATION);
    });
    vel.swap();
    run("advect", dye.write, tv, u => {
      gl.uniform1i(u.uVelocity, bind(vel.read.t)); gl.uniform1i(u.uSource, bind(dye.read.t));
      gl.uniform1f(u.dt, dt); gl.uniform1f(u.dissipation, CFG.DYE_DISSIPATION);
    });
    dye.swap();
  };

  // pointer: every move splats along its path, wider the faster it goes
  let px = null, py = null, lastMove = -1e9, raf = 0, last = 0;
  const pending = [];
  addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const x = e.clientX, y = e.clientY;
    if (px !== null && engaged()) pending.push([px, py, x, y]);
    px = x; py = y;
    lastMove = performance.now();
    wake();
  }, { passive: true });

  const frame = now => {
    raf = 0;
    const dt = Math.min((now - (last || now)) / 1000, 1 / 60) || 1 / 60;
    last = now;
    for (const [x0, y0, x1, y1] of pending.splice(0)) {
      const dx = (x1 - x0) / W, dy = (y1 - y0) / H;
      const speed = Math.hypot(x1 - x0, y1 - y0);
      if (speed < 0.5) continue;
      const r = CFG.RADIUS * (0.5 + Math.min(speed / 40, 1.6));          // fast strokes are wide
      const n = Math.min(6, Math.ceil(speed / 30));                       // fill long jumps
      for (let i = 1; i <= n; i++) {
        const x = (x0 + (x1 - x0) * i / n) / W, y = 1 - (y0 + (y1 - y0) * i / n) / H;
        splat(x, y, dx * CFG.FORCE / n, -dy * CFG.FORCE / n, r, 0.4 / n + 0.08);
      }
    }
    step(dt);

    const ring = window.__ringRect;
    const live = now - lastMove < CFG.KEEP_MS;
    if (live) {
      run("mask", maskT, null, u => { gl.uniform1i(u.uDye, bind(dye.read.t)); });
      gl.readPixels(0, 0, maskT.w, maskT.h, gl.RGBA, gl.UNSIGNED_BYTE, inkMask.data);
      inkMask.frame++;
    }
    inkMask.active = live;
    if (window.__ringWake) window.__ringWake();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (live) {
      run("dots", null, null, u => {
        gl.uniform1i(u.uDye, bind(dye.read.t));
        gl.uniform2f(u.res, W, H); gl.uniform1f(u.dpr, dpr); gl.uniform1f(u.pitch, CFG.PITCH);
        gl.uniform4f(u.ring, ring ? ring.cx : 0, ring ? ring.cy : 0, ring ? ring.rx : 0, ring ? ring.ry : 0);
        gl.uniform3f(u.edge, EDGE[0], EDGE[1], EDGE[2]);
        gl.uniform3f(u.core, CORE[0], CORE[1], CORE[2]);
      });
      wake();
    } else {
      last = 0;
    }
  };
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  addEventListener("resize", () => { resize(); wake(); });
  resize();
}
