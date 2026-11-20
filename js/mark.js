// mark.js — the lockup's "decode" effect (page lane).
//
// The lockup is live text (Eric, 2026-09-09), so the effect operates on characters rather than on
// slices of a raster. Every non-space character is split into a cell holding two layers: the real
// character, which alone drives layout, and an absolutely positioned overlay that carries the random
// code glyph. Nothing is ever measured and nothing reflows, at any font size, before or after the
// webfont swaps, at any viewport.
//
// MODES
//   "sequential" — one letter at a time: cells before the resolve point show their real character,
//     `activeCells` at the point scramble, and every cell after it renders NOTHING. The lockup
//     builds out of an empty field.
//   "scramble" — the reference nav's behaviour (unajartera.com): every unresolved cell scrambles at
//     once and the word is legible-as-noise throughout. Used by the short hover and tap runs.
//
// Classic script: defines window.SignetMark = { attach(el, conf) -> api }.
// api: { enabled, running, runs, run(durationMs, mode) }.
(() => {
  const reduced = false;   // plays even when the system asks for reduced motion (Linzhi, 2026-11-19)

  function attach(el, conf) {
    conf = conf || {};
    const charset = conf.charset || "ACEFGHIJKLPRSTUVY23456789";
    const api = { running: false, runs: 0, enabled: false, run() {} };
    const lines = Array.prototype.slice.call(el.querySelectorAll("[data-mark-line]"));
    if (reduced || !lines.length) return api;        // live text, no effect: the lockup just sits there

    // split into cells; spaces stay as text nodes so word gaps keep their natural width
    const cells = [];
    for (const line of lines) {
      const text = line.textContent;
      line.textContent = "";
      for (const chr of Array.from(text)) {
        if (!chr.trim()) { line.appendChild(document.createTextNode(chr)); continue; }
        const cell = document.createElement("span");
        cell.className = "ch";
        const real = document.createElement("span");
        real.className = "ch__real";
        real.textContent = chr;
        const fx = document.createElement("span");
        fx.className = "ch__fx";
        fx.setAttribute("aria-hidden", "true");
        cell.appendChild(real);
        cell.appendChild(fx);
        line.appendChild(cell);
        cells.push({ el: cell, fx, state: "done" });
      }
    }
    if (!cells.length) return api;
    api.enabled = true;

    const rand = () => charset[Math.floor(Math.random() * charset.length)];
    // Unresolved cells hold a glyph for churnMs before re-rolling. At 60 fps a fresh glyph every
    // frame reads as white noise; the reference gets away with it only because its runs last 450 ms.
    const churnMs = conf.churnMs || 0;
    let raf = 0, safety = 0, lastChurn = -Infinity, lastResolved = -1;
    let mode = "sequential", active = 1;

    const setState = (c, state, roll) => {
      if (c.state !== state) {
        c.state = state;
        c.el.className = state === "done" ? "ch" : "ch is-" + state;
      }
      const want = state === "fx" ? roll : "";
      if (c.fx.textContent !== want) c.fx.textContent = want;
    };

    const paint = (resolved, now) => {
      if (now - lastChurn >= churnMs) {
        lastChurn = now;
        for (const c of cells) c.roll = rand();
      }
      if (resolved !== lastResolved) { lastResolved = resolved; el.dataset.resolved = String(resolved); }
      cells.forEach((c, i) => {
        if (i < resolved) return setState(c, "done");
        if (mode === "sequential" && i >= resolved + active) return setState(c, "pending");
        setState(c, "fx", c.roll);
      });
    };

    const restore = () => {
      cancelAnimationFrame(raf); clearTimeout(safety);
      for (const c of cells) setState(c, "done");
      lastResolved = -1; delete el.dataset.resolved;
      el.classList.remove("is-fx");
      api.running = false;
    };

    api.run = (duration = 450, runMode) => {
      if (api.running) return;
      mode = runMode || conf.mode || "sequential";
      active = Math.max(1, conf.activeCells || 1);
      api.running = true; api.runs++;
      el.dataset.runs = String(api.runs);
      el.dataset.mode = mode;
      el.classList.add("is-fx");
      lastChurn = -Infinity;
      const start = performance.now();
      paint(0, start);
      // the page holds the opening screen dark until this fires
      try { el.dispatchEvent(new CustomEvent("signet:decode-start", { bubbles: true })); } catch { /* old engine */ }
      const tick = now => {
        const t = Math.min(1, (now - start) / duration);
        paint(Math.floor(cells.length * t), now);
        if (t < 1) raf = requestAnimationFrame(tick); else restore();
      };
      raf = requestAnimationFrame(tick);
      safety = setTimeout(restore, duration + 400);   // never leave the lockup mid-decode
    };

    // the reference's own triggers. Short runs stay in all-at-once scramble: one-at-a-time over
    // 450 ms would read as a wipe across a mostly empty lockup.
    if (!conf.triggers || conf.triggers.hover !== false) {
      const d = conf.durations || {};
      el.addEventListener("mouseenter", () => api.run(d.hover ?? 450, "scramble"));
      el.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") api.run(d.tap ?? 220, "scramble"); }, { passive: true });
    }
    return api;
  }

  window.SignetMark = { attach };
})();
