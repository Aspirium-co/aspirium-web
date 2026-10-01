// viewer-video.js — the hero band as a pre-rendered film instead of the live WebGL render.
//
// Replaced the live bundle on 2026-09-30 (Linzhi): the real-time render stuttered on ordinary
// laptops and phones and cost a 13.5 MB download. The film is the Blender render, cropped to a
// square and slowed to half speed (assets/video/). Implements the same contract as
// js/viewer-embed.js, so js/main.js drives it unchanged: the film's own clock paces the lockup's
// decode, its last frame is the end pose, and it holds there rather than looping.
//
// Classic script: defines window.SignetViewer = { mount }. CONTRACT — see js/viewer-embed.js.
// A film cannot be dragged, so setInteractive is a no-op and the drag hint is switched off in
// js/config.js.
(() => {
  // Written relative to this script, not the page, so build.mjs finds it and swaps in the hashed name.
  const SRC = "../assets/video/gemtronic-1x1.mp4";
  const here = (document.currentScript && document.currentScript.src) || location.href;

  async function mount(el, opts = {}) {
    const v = document.createElement("video");
    v.className = "film";
    v.muted = true;                    // muted + playsinline is what lets mobile browsers autoplay
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("aria-label", opts.label || "Gemtronic ring, lit from within");
    v.preload = "auto";
    v.disablePictureInPicture = true;
    if (opts.poster) v.poster = opts.poster;
    v.src = new URL(SRC, here).href;
    el.appendChild(v);

    let destroyed = false, firedEnd = false, raf = 0;
    const finish = () => {
      if (firedEnd || destroyed) return;
      firedEnd = true;
      cancelAnimationFrame(raf);
      opts.onIntroProgress?.(1);
      opts.onIntroEnd?.();
      opts.onWordmarkLit?.();
    };
    const tick = () => {
      if (destroyed || firedEnd) return;
      if (v.duration) opts.onIntroProgress?.(Math.min(1, v.currentTime / v.duration));
      raf = requestAnimationFrame(tick);
    };

    const handle = {
      play() { if (!firedEnd && !destroyed) v.play().catch(() => {}); },
      pause() { v.pause(); },
      restart() { firedEnd = false; v.currentTime = 0; v.play().catch(() => {}); tick(); },
      setInteractive() { /* a film does not rotate */ },
      destroy() { destroyed = true; cancelAnimationFrame(raf); v.removeAttribute("src"); v.load(); v.remove(); },
      get time() { return v.currentTime; },
    };

    v.addEventListener("error", () => { if (!destroyed) opts.onError?.(new Error("film failed to load")); }, { once: true });
    v.addEventListener("ended", finish);

    // ready = the first frame can be shown
    await new Promise(resolve => {
      if (v.readyState >= 2) return resolve();
      v.addEventListener("loadeddata", resolve, { once: true });
      v.addEventListener("error", resolve, { once: true });
    });
    if (destroyed || v.error) return handle;
    opts.onReady?.();

    // Reduced motion: no film, straight to the end pose.
    const toEnd = () => { v.pause(); try { v.currentTime = Math.max(0, (v.duration || 0) - 0.05); } catch { /* not seekable yet */ } finish(); };
    if (opts.intro === "skip") { toEnd(); return handle; }

    // Autoplay can still be refused (iOS low-power mode). Then show the end pose rather than a frozen first frame.
    v.play().then(tick, toEnd);
    return handle;
  }

  window.SignetViewer = { kind: "video", mount };
})();
