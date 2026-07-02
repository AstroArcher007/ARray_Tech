/* =============================================================
   ZENITH ACADEMY — SCRIPT
   Vanilla JS only. Organized by feature.
============================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ===========================================================
     1. STICKY NAVBAR — shadow on scroll + mobile menu toggle
  =========================================================== */
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const primaryNav = document.getElementById('primaryNav');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('is-scrolled', window.scrollY > 10);
  });

  navToggle.addEventListener('click', () => {
    const isOpen = primaryNav.classList.toggle('is-open');
    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close mobile menu after clicking a link
  primaryNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      primaryNav.classList.remove('is-open');
      navToggle.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ===========================================================
     2. SMOOTH SCROLL for anchor links (CSS handles most of this
        via `scroll-behavior: smooth`; this adds offset safety
        for browsers/edge-cases and keeps focus accessible)
  =========================================================== */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId.length > 1) {
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      }
    });
  });

  /* ===========================================================
     3. SCROLL-TRIGGERED REVEAL ANIMATIONS (IntersectionObserver)
  =========================================================== */
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target); // animate once
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  revealElements.forEach(el => revealObserver.observe(el));

  /* ===========================================================
     4. ANIMATED STAT COUNTERS (triggered on scroll into view)
  =========================================================== */
  const statNumbers = document.querySelectorAll('.stats-bar__num');

  const animateCount = (el) => {
    const target = parseInt(el.dataset.count, 10);
    const duration = 1600; // ms
    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    };
    requestAnimationFrame(step);
  };

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => statsObserver.observe(el));

  /* ===========================================================
     5. TESTIMONIAL CAROUSEL (custom vanilla JS, no library)
  =========================================================== */
  const track = document.getElementById('carouselTrack');
  const slides = Array.from(track.children);
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const dotsContainer = document.getElementById('carouselDots');

  let currentSlide = 0;
  let autoplayTimer = null;

  // Build dots dynamically based on number of slides
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.classList.add('carousel__dot');
    dot.setAttribute('aria-label', `Go to testimonial ${i + 1}`);
    if (i === 0) dot.classList.add('is-active');
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  });
  const dots = Array.from(dotsContainer.children);

  function goToSlide(index) {
    currentSlide = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    dots.forEach(d => d.classList.remove('is-active'));
    dots[currentSlide].classList.add('is-active');
  }

  function nextSlide() { goToSlide(currentSlide + 1); }
  function prevSlide() { goToSlide(currentSlide - 1); }

  nextBtn.addEventListener('click', () => { nextSlide(); resetAutoplay(); });
  prevBtn.addEventListener('click', () => { prevSlide(); resetAutoplay(); });

  // Autoplay
  function startAutoplay() {
    autoplayTimer = setInterval(nextSlide, 5500);
  }
  function resetAutoplay() {
    clearInterval(autoplayTimer);
    startAutoplay();
  }
  startAutoplay();

  // Pause autoplay on hover/focus for accessibility
  const carouselWrapper = document.getElementById('testimonialCarousel');
  carouselWrapper.addEventListener('mouseenter', () => clearInterval(autoplayTimer));
  carouselWrapper.addEventListener('mouseleave', startAutoplay);

  // Basic swipe support for touch devices
  let touchStartX = 0;
  track.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      diff > 0 ? nextSlide() : prevSlide();
      resetAutoplay();
    }
  }, { passive: true });

  /* ===========================================================
     6. FAQ ACCORDION
  =========================================================== */
  const accordionItems = document.querySelectorAll('.accordion__item');

  accordionItems.forEach(item => {
    const trigger = item.querySelector('.accordion__trigger');
    const panel = item.querySelector('.accordion__panel');

    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      // Close all other panels (single-open accordion behavior)
      accordionItems.forEach(otherItem => {
        const otherTrigger = otherItem.querySelector('.accordion__trigger');
        const otherPanel = otherItem.querySelector('.accordion__panel');
        otherTrigger.setAttribute('aria-expanded', 'false');
        otherPanel.style.maxHeight = null;
      });

      // Toggle current panel
      if (!isOpen) {
        trigger.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });

  /* ===========================================================
     7. FORM HANDLING — Lead Magnet & Contact Form
     (Front-end only demo: replace fetch() call with your
      real backend / email service endpoint.)
  =========================================================== */
  function handleFormSubmit(formEl, noteEl, successMessage) {
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!formEl.checkValidity()) {
        noteEl.textContent = 'Please fill in all required fields correctly.';
        noteEl.classList.add('is-error');
        formEl.reportValidity();
        return;
      }

      const submitBtn = formEl.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;

      // Simulate a network request — swap with a real fetch() to your backend
      setTimeout(() => {
        noteEl.classList.remove('is-error');
        noteEl.textContent = successMessage;
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        formEl.reset();
      }, 900);
    });
  }

  const leadMagnetForm = document.getElementById('leadMagnetForm');
  const lmFormNote = document.getElementById('lmFormNote');
  handleFormSubmit(leadMagnetForm, lmFormNote, "✅ Check your inbox — the syllabus PDF is on its way!");

  const contactForm = document.getElementById('contactForm');
  const contactFormNote = document.getElementById('contactFormNote');
  handleFormSubmit(contactForm, contactFormNote, "✅ Message sent! Our team will reach out within a few hours.");

  /* ===========================================================
     8. SYLLABUS BUTTONS (course cards) — demo behavior
  =========================================================== */
  document.querySelectorAll('.js-syllabus-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const courseName = btn.dataset.course;
      alert(`📄 The detailed syllabus for "${courseName}" would download here.\n(Hook this button up to your actual PDF file or a modal.)`);
    });
  });

  /* ===========================================================
     9. FOOTER — dynamic copyright year
  =========================================================== */
  document.getElementById('year').textContent = new Date().getFullYear();

});
