// features.js — which feature is lit, and what the ring's screen shows (2026-10-01, Linzhi).
//
// The item nearest the middle of the screen is lit, as on neoconda.com. Clicking an item lights it
// too, and it stays lit until the page has scrolled a little way on, so a click is not overruled by
// the next scroll event. Whatever is lit puts its screens -- data-screens, the firmware's own
// frames -- on the ring, which js/ring3d.js reads from window.__ringScreen and cycles through.

const items = [...document.querySelectorAll(".feat")];
const panel = document.getElementById("features");
const IDLE = ["idle"];                      // HOME, before any item has come up

if (items.length && panel) {
  let active = null, pinnedAt = null, raf = 0;

  const show = item => {
    if (item === active) return;
    if (active) active.classList.remove("is-active");
    active = item;
    if (item) item.classList.add("is-active");
    window.__ringScreen = { frames: item ? item.dataset.screens.split(/\s+/) : IDLE, since: performance.now() };
    if (window.__ringWake) window.__ringWake();
  };

  const update = () => {
    raf = 0;
    const y = window.scrollY || 0;
    if (pinnedAt !== null) {
      if (Math.abs(y - pinnedAt) < innerHeight * 0.18) return;
      pinnedAt = null;
    }
    const mid = innerHeight / 2;
    let best = null, bestD = innerHeight * 0.3;            // nothing lit unless an item is near the middle
    for (const it of items) {
      const r = it.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) { best = it; bestD = d; }
    }
    show(best);
  };

  for (const it of items) {
    it.addEventListener("click", () => { show(it); pinnedAt = window.scrollY || 0; });
  }
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  addEventListener("resize", () => { if (!raf) raf = requestAnimationFrame(update); });
  window.__ringScreen = { frames: IDLE, since: performance.now() };
  update();
}
