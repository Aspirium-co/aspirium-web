// Pre-order form (presale.html, 2026-10-11). Classic script, like js/main.js, so the page also runs
// from disk. Posts to SIGNET_CONFIG.preorder.endpoint (Formspree); with no endpoint it opens a
// pre-filled email instead, so a reservation is never silently dropped.
(() => {
  const SITE = window.SIGNET_CONFIG || {};
  const cfg = SITE.preorder || {};
  const form = document.getElementById("reserve");
  if (!form) return;
  const submitBtn = form.querySelector(".submit");
  const statusEl = form.querySelector(".status");
  const setStatus = t => { statusEl.textContent = t || ""; };
  const done = () => { form.querySelector(".reserve__live").hidden = true; form.querySelector(".received").hidden = false; };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const els = form.elements;
    if (els._gotcha.value) { done(); return; } // honeypot tripped: look successful, send nothing
    for (const name of ["name", "email", "size", "quantity", "country"]) {
      const el = els[name];
      el.value = el.value.trim ? el.value.trim() : el.value;
      if (!el.value || !el.checkValidity()) {
        setStatus(name === "email" ? "That does not read as an email address." : "Please fill in every field.");
        el.focus();
        return;
      }
    }
    const data = new FormData(form);

    if (!cfg.endpoint) {
      const lines = ["name", "email", "size", "quantity", "country"].map(k => `${k[0].toUpperCase() + k.slice(1)}: ${data.get(k)}`);
      location.href = `mailto:${cfg.fallbackEmail}?subject=${encodeURIComponent("Gemtronic pre-order")}&body=${encodeURIComponent(lines.join("\r\n"))}`;
      setStatus("Your mail app should open with the reservation. Press send there to finish.");
      return;
    }

    submitBtn.disabled = true;
    setStatus("Sending.");
    try {
      const res = await fetch(cfg.endpoint, { method: "POST", body: data, headers: { Accept: "application/json" }, mode: "cors", credentials: "omit" });
      if (res.ok) { done(); setStatus(""); }
      else setStatus("Not received. Please try again, or email " + cfg.fallbackEmail + ".");
    } catch {
      setStatus("Not received. Please try again, or email " + cfg.fallbackEmail + ".");
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
