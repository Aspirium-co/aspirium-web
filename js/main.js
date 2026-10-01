// Signet by ASPIRIUM — coming-soon page · page logic (page lane).
// web_build_brief_v1_1.md §2 (anatomy, wiring the light, return visits), §3 (fallback
// ladder), §4 (interaction), §7 (capture plumbing). Classic script so the page also runs
// from disk; the viewer script is injected on demand so nothing it does can take the form
// down with it. The form works with JS off once an endpoint exists.
(() => {
  const SITE = window.SIGNET_CONFIG;
  const here = (document.currentScript && document.currentScript.src) || location.href;
  const doc = document.documentElement;
  const band = document.getElementById("band");
  const mountEl = document.getElementById("viewer");
  const poster = document.getElementById("poster");
  const posterImg = poster.querySelector("img");
  const form = document.getElementById("capture");

  // ---- dev switches (only reachable from dev/tune.html, a same-origin frame) ----
  const dev = (() => {
    try {
      const raw = (window.frameElement && window.frameElement.dataset.signetDev) || "";
      const o = {};
      for (const tok of raw.split(/\s+/).filter(Boolean)) { const [k, v] = tok.split(":"); o[k] = v ?? true; }
      return o;
    } catch { return {}; }
  })();

  // Opened from disk, Chrome refuses web fonts (file:// is a null origin), so prefer the
  // installed families there — reviewers have the TTFs installed. Served pages keep the
  // shipped files, so every visitor sees the same cut.
  if (location.protocol === "file:") {
    const st = document.createElement("style");
    st.textContent =
      '@font-face{font-family:"ASPIRIUM";font-weight:300;font-style:normal;src:local("ASPIRIUM Light"),local("ASPIRIUM-Light")}' +
      '@font-face{font-family:"Literata";font-weight:200 900;font-style:normal;src:local("Literata"),local("Literata-Regular")}' +
      '@font-face{font-family:"Source Serif 4";font-weight:200 900;font-style:normal;src:local("Source Serif 4"),local("SourceSerif4-Regular"),local("Source Serif Pro")}';
    document.head.appendChild(st);
  }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phone = matchMedia(SITE.phoneQuery).matches;
  // Every load replays the whole opening (Eric, 2026-09-09). This retires the brief's §2 "Return
  // visits" behaviour, which used a sessionStorage flag to mount at the end pose the second time in
  // a tab. Nothing is stored in the browser now; reduced motion is still the one path that skips.

  // ---- the light: one warm accent, and only when the ring's light arrives (§2) ----
  const warm = () => { doc.dataset.light = "warm"; };

  // ---- the lockup's decode effect (js/mark.js) ----
  // Paced against the ring (Eric, 2026-09-09): held until the ring is decently in focus and on
  // screen, then decoding one letter at a time. Fallback paths have no intro to follow, so they
  // decode as soon as the mark is on screen.
  const markEl = document.getElementById("mark");
  const wm = SITE.wordmark || {}, wmRun = wm.durations || {}, wmOn = wm.triggers || {};
  const mark = (window.SignetMark && markEl) ? window.SignetMark.attach(markEl, wm) : null;
  let decodeDone = false, holdSafety = 0;
  // The opening screen is already held dark by the inline script in <head>, so the lockup cannot
  // flash in before this runs. Keep that hold only when a decode is actually coming; otherwise drop
  // it now, so the page can never sit blank with nothing on the way (reduced motion, trigger off).
  const unhold = () => { clearTimeout(holdSafety); doc.classList.remove("is-opening"); };
  if (mark && mark.enabled && wmOn.load !== false && markEl) {
    markEl.addEventListener("signet:decode-start", unhold);   // lifted on the decode's first frame
    holdSafety = setTimeout(unhold, wm.blankMaxMs ?? 20000);
  } else {
    unhold();
  }
  // the run lasts `runForIntro` of the ring's intro, so the two clocks stay tied together
  const introSec = (SITE.timeline && SITE.timeline.introEnd) || 15;
  const loadMs = wm.runForIntro ? Math.round(wm.runForIntro * introSec * 1000) : (wmRun.load ?? 11250);

  // Held until the ring is decently in focus: startAtSec is demo.js's own RACK_LAND, the moment it
  // declares the blur resolved.
  const startAt = (wm.startAtSec ?? 5.0) / introSec;
  const decode = ms => {
    if (decodeDone || !mark || wmOn.load === false) return;
    if (mark.running) return;                        // a hover run owns the canvas; the next tick tries again
    decodeDone = true;
    mark.run(ms);                                    // the run itself lifts the hold, on its first frame
  };

  // ---- drag hint ----
  // The ring is a live render, not a video, and nothing says so. Shown the moment rotation
  // unlocks, retired by the first drag or by autoHideMs, whichever comes first.
  const dragEl = document.getElementById("drag");
  const hint = SITE.dragHint || {};
  let hintTimer = 0;
  const hideHint = () => { clearTimeout(hintTimer); dragEl && dragEl.classList.remove("is-on"); };
  const showHint = () => {
    if (!dragEl || hint.enabled === false) return;
    dragEl.classList.add("is-on");
    hintTimer = setTimeout(hideHint, hint.autoHideMs ?? 12000);
  };

  // ---- hero band: mount, fallback ladder, pause when unseen ----
  let viewer = null;
  let state = "boot"; // boot → live | poster
  const showPoster = reason => {
    if (state === "poster") return;
    state = "poster";
    if (viewer) { try { viewer.destroy(); } catch { /* already gone */ } viewer = null; }
    mountEl.hidden = true;
    band.dataset.state = "poster";
    hideHint();                                      // a poster does not rotate
    warm(); // fallback paths: warm state immediately (§2)
    decode(wmRun.fallback ?? 2600);                  // no intro to follow: decode on the poster
    if (reason) console.info("[signet] poster:", reason instanceof Error ? reason.message : reason);
  };
  // the poster the <picture> would choose for this device class
  const posterFor = isPhone => {
    const source = poster.querySelector("source");
    const src = isPhone && source ? source.getAttribute("srcset") : null;
    return new URL(src || posterImg.getAttribute("src"), location.href).href;
  };
  const hasWebGL2 = () => {
    try { const c = document.createElement("canvas"); return !!c.getContext("webgl2"); } catch { return false; }
  };
  // live bundle by default; the stub only through dev/tune.html or dev/check.mjs ("stub", "stub:slow", "stub:fail")
  const loadViewer = useStub => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    // The film replaced the live WebGL bundle (viewer-embed.js) on 2026-09-30 (Linzhi): it stuttered.
    s.src = new URL(useStub ? "viewer-stub.js" : "viewer-video.js", here).href;
    s.async = true;
    s.onload = () => window.SignetViewer ? resolve(window.SignetViewer) : reject(new Error("viewer script defined nothing"));
    s.onerror = () => reject(new Error("viewer script failed to load"));
    document.head.appendChild(s);
  });

  const boot = async () => {
    if (dev.nowebgl || (("stub" in dev) && !hasWebGL2())) return showPoster("no WebGL2");   // the film needs no WebGL
    const timer = setTimeout(() => { if (state === "boot") showPoster(`not ready within ${SITE.readyTimeoutMs} ms`); }, SITE.readyTimeoutMs);
    const intro = dev.intro || (reduced ? "skip" : "play");
    try {
      const mod = await loadViewer("stub" in dev);
      const v = await mod.mount(mountEl, {
        variant: phone ? "phone" : "desktop",
        intro,
        dprCap: phone ? SITE.dprCap.phone : SITE.dprCap.desktop,
        timeline: SITE.timeline,
        poster: posterFor(phone),
        label: posterImg.alt,
        devScenario: typeof dev.stub === "string" ? dev.stub : undefined,
        onReady() {
          if (state !== "boot") return; // the ladder already moved on
          clearTimeout(timer);
          state = "live";
          band.dataset.state = "live";
        },
        onIntroProgress(fraction) {
          if (state !== "live" || intro !== "play") return;
          // the ring's own clock drives the lockup: nothing until the focus rack has landed
          if (fraction >= startAt) decode(loadMs);
        },
        onIntroEnd() {
          if (state === "live") { viewer?.setInteractive(true); band.dataset.interactive = ""; showHint(); } // §4: rotation only after the intro
          if (intro !== "play") decode(wmRun.fallback ?? 2600);   // reduced motion / return visit: no intro to pace against
        },
        onWordmarkLit() {
          if (state !== "live") return;
          warm();
          if (mark && wmOn.lit !== false) mark.run(wmRun.lit ?? 1100);   // the DOM mark decodes as the ring's does
        },
        onDragged() { hideHint(); },        // they have found it; stop telling them
        onError(err) { clearTimeout(timer); showPoster(err); },
      });
      if (state === "poster") { try { v.destroy(); } catch { /* noop */ } return; }
      viewer = v;
      syncPlayback();
    } catch (err) {
      clearTimeout(timer);
      showPoster(err);
    }
  };

  // pause rendering when the band is off-screen, covered by the capture panel, or the tab is hidden
  let inView = true, covered = false;
  const syncPlayback = () => {
    const on = inView && !covered && document.visibilityState === "visible";
    band.dataset.playback = on ? "playing" : "paused";
    if (!viewer) return;
    try { on ? viewer.play() : viewer.pause(); } catch { /* viewer gone */ }
  };
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => { inView = entries[0].isIntersecting; syncPlayback(); }, { threshold: 0.05 }).observe(band);
  }
  document.addEventListener("visibilitychange", syncPlayback);

  // ---- parallax (Eric, 2026-09-09) ----
  // The hero is sticky and the capture panel slides over it; --p (0…1 across the first screen)
  // spends the hero's drift and fade in css/site.css, so the two panels move at different rates.
  // Passive listener, one write per frame; reduced motion keeps the value but the CSS ignores it.
  const hero = document.getElementById("hero");
  const px = SITE.parallax || {};
  if (hero) {
    hero.style.setProperty("--drift", String(px.drift ?? 9));
    hero.style.setProperty("--fade", String(px.fade ?? 0.55));
    hero.style.setProperty("--cue-fade", String(px.cueFade ?? 3));
  }
  let ticking = false;
  const applyScroll = () => {
    ticking = false;
    const h = (hero && hero.offsetHeight) || innerHeight || 1;
    const p = Math.min(1, Math.max(0, (window.scrollY || window.pageYOffset || 0) / h));
    if (hero) {
      hero.style.setProperty("--p", p.toFixed(4));
      hero.style.setProperty("--pf", Math.min(1, p / (px.fadeEnd || 0.6)).toFixed(4));
    }
    const nowCovered = p >= (px.pauseAt ?? 0.9);
    if (nowCovered !== covered) { covered = nowCovered; syncPlayback(); }
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(applyScroll); } }, { passive: true });
  addEventListener("resize", () => { if (!ticking) { ticking = true; requestAnimationFrame(applyScroll); } });
  applyScroll();

  boot();

  // ---- capture form (§7) ----
  const emailField = form.elements.email;
  const sourceField = form.elements.source;
  const hpField = form.elements[SITE.capture.honeypot];
  const submitBtn = form.querySelector(".submit");
  const statusEl = form.querySelector(".status");
  const receivedEl = form.querySelector(".received");
  const copy = form.dataset; // data-copy-* attributes in index.html

  // serial-to-source: ?c=NNN → tag
  const c = new URLSearchParams(location.search).get(SITE.sourceParam);
  if (c && SITE.sourcePattern.test(c)) sourceField.value = c;

  const setStatus = text => { statusEl.textContent = text || ""; };
  const setBusy = busy => { submitBtn.disabled = busy; form.classList.toggle("is-busy", busy); };
  const done = () => {
    form.querySelector(".capture__live").hidden = true;
    receivedEl.hidden = false;
    setStatus("");
  };

  const post = async payload => {
    const { endpoint, method, fields, extra } = SITE.capture;
    if (!endpoint) {
      // R5: stub endpoint. Simulate the round trip so the page choreography can be reviewed.
      console.warn("[signet] capture endpoint not wired (R5). Would send:", payload);
      await new Promise(r => setTimeout(r, 500));
      return true;
    }
    const body = new URLSearchParams(extra);
    body.set(fields.email, payload.email);
    if (payload.source) body.set(fields.source, payload.source);
    const res = await fetch(endpoint, { method, body, headers: { Accept: "application/json" }, mode: "cors", credentials: "omit" });
    return res.ok;
  };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (hpField && hpField.value) { done(); return; } // honeypot tripped: look successful, send nothing
    const email = emailField.value.trim();
    if (!email || !emailField.checkValidity()) { setStatus(copy.copyInvalid); emailField.focus(); return; }
    setBusy(true);
    setStatus(copy.copySending);
    try {
      const ok = await post({ email, source: sourceField.value });
      ok ? done() : setStatus(copy.copyFailed);
    } catch {
      setStatus(copy.copyFailed);
    } finally {
      setBusy(false);
    }
  });
})();
