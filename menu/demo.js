/* ==========================================================================
   demo.js — Mobile pager dots for the phone-swipe carousel
   Desktop shows both phones at once, so this only matters on narrow
   viewports where .demo-phones becomes a horizontal snap-scroller.
   ========================================================================== */

(function () {
  "use strict";

  const track = document.getElementById("demoPhones");
  const pager = document.getElementById("demoPager");
  const prevBtn = document.getElementById("demoPrev");
  const nextBtn = document.getElementById("demoNext");
  if (!track || !pager) return;

  const dots = Array.from(pager.querySelectorAll(".demo-pager__dot"));
  const slides = Array.from(track.querySelectorAll(".phone-slot"));

  function goToSlide(index) {
    const target = slides[index];
    if (target) target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  dots.forEach((dot) => {
    dot.addEventListener("click", () => goToSlide(Number(dot.dataset.target) || 0));
  });

  function currentIndex() {
    // Each slide (plus its gap) is one "page" of scroll — use the first
    // slide's width rather than the viewport, since on mobile the slide
    // is narrower than the full carousel and doesn't fill clientWidth.
    const slideWidth = slides[0] ? slides[0].getBoundingClientRect().width : track.clientWidth;
    return Math.round(track.scrollLeft / slideWidth);
  }

  function updateActiveState() {
    const index = Math.min(Math.max(currentIndex(), 0), slides.length - 1);
    dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
    if (prevBtn) prevBtn.disabled = index <= 0;
    if (nextBtn) nextBtn.disabled = index >= slides.length - 1;
  }

  if (prevBtn) prevBtn.addEventListener("click", () => goToSlide(currentIndex() - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => goToSlide(currentIndex() + 1));

  let ticking = false;
  track.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateActiveState();
      ticking = false;
    });
  });

  window.addEventListener("resize", updateActiveState);
  updateActiveState();

  // --- Guard against focus-triggered re-snapping ---------------------------
  // On mobile, .demo-phones is a horizontal scroll-snap carousel. When a
  // form control *inside* one of the phone screens receives focus, mobile
  // browsers try to scroll it into view — and that auto-scroll can get
  // confused by the nested horizontal snap container, occasionally
  // re-snapping the whole carousel back to the first slide while someone
  // is just typing into the admin form. Turning snapping off for the
  // duration of the focus (and back on once it's done) removes the chance
  // of that misfire without disabling swiping between slides at rest.
  track.addEventListener("focusin", (event) => {
    if (event.target.closest("input, textarea, select, button, [contenteditable]")) {
      track.classList.add("is-editing");
    }
  });
  track.addEventListener("focusout", () => {
    track.classList.remove("is-editing");
  });

  // --- Keep admin.js's "scroll to top" inside its own phone screen ---------
  // admin.js was written to also run as a normal full-page app, where
  // `window.scrollTo({ top: 0 })` after loading a dish into the edit form
  // makes sense (scroll the page up to the form). Embedded here, "the page"
  // from the user's point of view is the admin phone's own screen, not the
  // outer demo page — scrolling the real window instead yanked the whole
  // mobile layout back to the top and could look like the view had swapped.
  // Redirect that call to the admin phone's inner scroller instead.
  const adminScreen = document.querySelector(".phone-slot--admin .phone-frame__screen");
  if (adminScreen) {
    const nativeScrollTo = window.scrollTo.bind(window);
    window.scrollTo = function (...args) {
      const opts = args[0];
      if (opts && typeof opts === "object" && (opts.top === 0 || opts.top === undefined) && (opts.left === 0 || opts.left === undefined)) {
        adminScreen.scrollTo({ top: 0, behavior: opts.behavior || "auto" });
        return;
      }
      nativeScrollTo(...args);
    };
  }
})();
