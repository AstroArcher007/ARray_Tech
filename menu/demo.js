/* ==========================================================================
   demo.js — Mobile pager dots for the phone-swipe carousel
   Desktop shows both phones at once, so this only matters on narrow
   viewports where .demo-phones becomes a horizontal snap-scroller.
   ========================================================================== */

(function () {
  "use strict";

  const track = document.getElementById("demoPhones");
  const pager = document.getElementById("demoPager");
  if (!track || !pager) return;

  const dots = Array.from(pager.querySelectorAll(".demo-pager__dot"));
  const slides = Array.from(track.querySelectorAll(".phone-slot"));

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = Number(dot.dataset.target) || 0;
      const target = slides[index];
      if (target) target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    });
  });

  function updateActiveDot() {
    const index = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
  }

  let ticking = false;
  track.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateActiveDot();
      ticking = false;
    });
  });

  window.addEventListener("resize", updateActiveDot);
})();
