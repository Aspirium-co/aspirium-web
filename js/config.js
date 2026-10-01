// Signet by ASPIRIUM — coming-soon page · behaviour config (page lane).
// Classic script, no modules: the page runs served AND straight from disk (Chrome refuses
// ES modules on file://). Copy lives in index.html (one source, works without JS). This file
// holds only the knobs that rulings change. Precedence: decisions_log > web_build_brief_v1_1.
window.SIGNET_CONFIG = {
  build: "WEB 000",

  // The §2 "Return visits" skip was retired 2026-09-09 (Eric): every load replays the opening, and
  // the page stores nothing in the browser. Restoring it means re-reading a sessionStorage flag in
  // js/main.js and passing intro:"skip" — and re-stating that storage in privacy.html.

  // §7 serial-to-source: every social piece carries a serial; it travels as ?c=NNN
  // and is stored on the subscriber as a tag. Only this analytics matters pre-launch.
  sourceParam: "c",
  sourcePattern: /^[A-Za-z0-9_-]{1,24}$/,

  // §3 fallback ladder: no WebGL2 → load error → not ready within 8 s → poster.
  readyTimeoutMs: 8000,

  // §3 / §5 pixel budget. Passed to the viewer as ?dpr= (the page knows the device class,
  // the viewer owns the probe).
  dprCap: { desktop: 2, phone: 1.5 },
  phoneQuery: "(max-width: 767px)",

  // HANDOFF_web.md §3 timeline, seconds from playback start. The stub viewer runs on
  // these; the live bundle fires the same callbacks from its own clock.
  // introEnd is the film's length since 2026-09-30: 6.85 s rendered, played at half speed.
  timeline: { black: 1.2, lightsFull: 4.0, introEnd: 13.7, wordmark: 13.7, wordmarkFull: 15.7 },

  // R5: email provider decided when the form is built. Until then `endpoint` is empty
  // and the form simulates success locally (console warning). To wire a provider: set
  // endpoint + method, map the field names, add any static fields.
  //   Buttondown  → endpoint "https://buttondown.com/api/emails/embed-subscribe/<user>", fields { email: "email", source: "tag" }
  //   Formspree   → endpoint "https://formspree.io/f/<id>",                             fields { email: "email", source: "source" }
  //   Klaviyo / Mailchimp → see README (both want ids in `extra`; Mailchimp needs a JSONP or server hop)
  // The lockup's decode effect (js/mark.js). The lockup is live text in Literata, so the effect
  // splits it into per-character cells rather than slicing a raster; nothing here needs re-measuring
  // when the copy changes. Reference: unajartera.com's nav — 450 ms hover, 220 ms tap, narrow
  // charset, left-to-right, nothing under reduced motion. Copy lives in index.html.
  wordmark: {
    charset: "ACEFGHIJKLPRSTUVY23456789",
    // Paced against the ring, not the page (Eric, 2026-09-09). The lockup renders NOTHING until the
    // ring is only just emerging (Eric, 2026-09-09). Walked back from demo.js's RACK_LAND at 5.0 s
    // — where it declares the focus rack resolved — to 2.0 s. Per HANDOFF_web.md §3 that is the
    // half-lights mark: the ring has been out of the black for 0.8 s, the lights reach full at 4 s
    // and the blur clears by ~5 s, so the first letters now land against a ring that is still soft.
    // The run lasts `runForIntro` of the 15 s intro (0.75 → 11.25 s), finishing about 13.25 s.
    // js/main.js derives both from timeline.introEnd; durations.load is the literal fallback.
    startAtSec: 2.0,
    runForIntro: 0.75,
    mode: "sequential",          // one letter at a time; letters that have not had their turn draw nothing
    activeCells: 1,              // how many scramble at once at the resolve point — 1 is strict 1-by-1
    blankMaxMs: 20000,           // insurance: never hold the opening screen dark longer than this
    churnMs: 80,                 // how often a scrambling cell re-rolls its glyph; at 60 fps it is noise
    durations: { load: 11250, lit: 1100, hover: 450, tap: 220, fallback: 2600 },
    triggers: { load: true, lit: false, hover: true },
  },

  // Two panels, one screen each (Eric, 2026-09-09): the ring and the lockup live in the first,
  // the capture form in the second. The hero is sticky, so the capture panel slides over it while
  // the hero's contents drift and fade — the differential IS the parallax. Off under reduced motion.
  parallax: {
    // Snappier (Eric, 2026-09-09): the hero leaves faster and clears sooner, so the handover between
    // the two panels reads as decisive rather than languid. Nothing here adds lag — the scroll
    // handler is already one rAF — so "snappier" is entirely a matter of travelling further per
    // unit of scroll and finishing the dissolve earlier.
    drift: 80,      // vh the hero's contents rise across one screen of scroll. At 80 they travel at
                    // 1.8x the page, so the lockup stays well ahead of the capture panel's rising
                    // edge instead of being cut by it; the two rates ARE the parallax.
    fade: 0.95,     // how much of the hero's opacity the dissolve spends
    fadeEnd: 0.4,   // …and by which fraction of the screen it has spent it. The capture panel's top
                    // edge reaches the ring at about half a screen, so the ring is already gone
                    // before it could be sliced — the light goes out as you leave.
    cueFade: 4,     // the scroll cue is gone after a quarter of a screen
    pauseAt: 0.9,   // fraction of the first screen after which the viewer stops rendering (battery)
  },

  // The drag hint in the void between the render and the lockup. Shown when the ring's intro lands
  // and rotation unlocks; retired by the first drag, or by autoHideMs if nobody touches it.
  // Off since the film replaced the live render (2026-09-30): a film cannot be dragged.
  dragHint: { enabled: false, autoHideMs: 12000 },

  capture: {
    endpoint: "",
    method: "POST",
    fields: { email: "email", source: "tags" },
    extra: {},
    honeypot: "website", // bots fill it, humans never see it (§7: honeypot + provider rate limit, no CAPTCHA)
  },
};
