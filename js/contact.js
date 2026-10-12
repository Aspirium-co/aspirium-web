// The contact address (2026-10-11). Clicking it opens a new email as any mailto link does, and also
// copies the address: on a computer with no mail app set up, the mailto opens nothing, and the
// visitor would otherwise be left with no idea what happened.
(() => {
  for (const link of document.querySelectorAll(".js-mail")) {
    link.addEventListener("click", () => {
      const note = link.closest(".contact")?.querySelector(".contact__note");
      const address = link.textContent.trim();
      navigator.clipboard?.writeText(address).then(
        () => { if (note) note.textContent = "Address copied. If no email window opened, paste it into your mail."; },
        () => {}
      );
    });
  }
})();
