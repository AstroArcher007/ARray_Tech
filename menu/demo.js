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
})();
