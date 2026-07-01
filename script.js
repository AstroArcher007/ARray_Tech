/* =========================================================
   ARray Tech — vanilla JS
   Sections: hero typewriter, mobile nav, scroll reveals,
             cost-recovery calculator, lead form
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------
     1. Hero badge typewriter
     --------------------------------------------------- */
  (function heroTypewriter() {
    const el = document.getElementById('heroTyped');
    if (!el) return;

    // Replaced the coding theme with clean business values
    const lines = [
      'High-speed sites for local businesses.',
      '100% cost recovery guaranteed.',
      'Premium online presence for ₹5,000 flat.'
    ];

    let lineIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const TYPE_SPEED = 55;
    const DELETE_SPEED = 28;
    const HOLD_TIME = 1800;

    function tick() {
      const current = lines[lineIndex];

      if (!deleting) {
        charIndex++;
        el.textContent = current.slice(0, charIndex);
        if (charIndex === current.length) {
          deleting = true;
          setTimeout(tick, HOLD_TIME);
          return;
        }
        setTimeout(tick, TYPE_SPEED);
      } else {
        charIndex--;
        el.textContent = current.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          lineIndex = (lineIndex + 1) % lines.length;
          setTimeout(tick, 400);
          return;
        }
        setTimeout(tick, DELETE_SPEED);
      }
    }

    tick();
  })();

  /* ---------------------------------------------------
     2. Mobile nav toggle
     --------------------------------------------------- */
  (function mobileNav() {
    const burger = document.getElementById('burgerBtn');
    const menu = document.getElementById('mobileMenu');
    if (!burger || !menu) return;

    burger.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(isOpen));
    });

    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  })();

  /* ---------------------------------------------------
     3. Scroll reveal for sections
     --------------------------------------------------- */
  (function scrollReveal() {
    const targets = document.querySelectorAll(
      '.card, .why__list li, .qr-card, .calc__panel, .contact__form, .contact__copy'
    );
    targets.forEach(t => t.classList.add('reveal'));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(t => observer.observe(t));
  })();

  /* ---------------------------------------------------
     4. Cost Recovery Calculator
     --------------------------------------------------- */
  (function calculator() {
    const PRICE = 5000;

    const bizType = document.getElementById('bizType');
    const extraSlider = document.getElementById('extraSlider');
    const valueSlider = document.getElementById('valueSlider');

    const sliderLabel = document.getElementById('sliderLabel');
    const sliderValue = document.getElementById('sliderValue');
    const valueLabel = document.getElementById('valueLabel');
    const valueValue = document.getElementById('valueValue');

    const outUnit = document.getElementById('outUnit');
    const outUnit2 = document.getElementById('outUnit2');
    const outExtra = document.getElementById('outExtra');
    const outValue = document.getElementById('outValue');
    const outDaily = document.getElementById('outDaily');
    const outDays = document.getElementById('outDays');
    const outDaysPlural = document.getElementById('outDaysPlural');
    const outSentence = document.getElementById('outSentence');

    if (!bizType || !extraSlider || !valueSlider) return;

    const unitPlural = {
      customer: 'customers',
      member: 'members',
      student: 'students',
      booking: 'bookings'
    };

    function currentOption() {
      return bizType.options[bizType.selectedIndex];
    }

    function syncDefaultsToBusiness() {
      const opt = currentOption();
      const unit = opt.dataset.unit;
      const defaultValue = Number(opt.dataset.value);

      sliderLabel.textContent = `Extra ${unitPlural[unit]} per day`;
      valueLabel.textContent = `Average value per ${unit}`;
      valueSlider.value = defaultValue;

      // Scale the value-slider range sensibly per business type
      if (unit === 'customer') { valueSlider.min = 50; valueSlider.max = 1000; valueSlider.step = 10; }
      if (unit === 'member') { valueSlider.min = 300; valueSlider.max = 5000; valueSlider.step = 100; }
      if (unit === 'student') { valueSlider.min = 500; valueSlider.max = 10000; valueSlider.step = 100; }
      if (unit === 'booking') { valueSlider.min = 1000; valueSlider.max = 20000; valueSlider.step = 250; }

      valueSlider.value = defaultValue;
    }

    function recalc() {
      const opt = currentOption();
      const unit = opt.dataset.unit;
      const unitP = unitPlural[unit];

      const extra = Number(extraSlider.value);
      const value = Number(valueSlider.value);
      const daily = extra * value;
      const days = Math.max(1, Math.ceil(PRICE / daily));

      sliderValue.textContent = extra;
      valueValue.textContent = `₹${value.toLocaleString('en-IN')}`;

      outUnit.textContent = unitP;
      outUnit2.textContent = unit;
      outExtra.textContent = extra;
      outValue.textContent = value.toLocaleString('en-IN');
      outDaily.textContent = daily.toLocaleString('en-IN');
      outDays.textContent = days;
      outDaysPlural.textContent = days === 1 ? '' : 's';

      const extraWord = extra === 1 ? `1 extra ${unit}` : `${extra} extra ${unitP}`;
      const dayWord = days === 1 ? 'day' : 'days';
      outSentence.textContent = `Bring in just ${extraWord} a day and your ₹5,000 website pays for itself in ${days} ${dayWord}.`;
    }

    bizType.addEventListener('change', () => {
      syncDefaultsToBusiness();
      recalc();
    });
    extraSlider.addEventListener('input', recalc);
    valueSlider.addEventListener('input', recalc);

    syncDefaultsToBusiness();
    recalc();
  })();

  /* ---------------------------------------------------
     5. Lead form
     --------------------------------------------------- */
  (function leadForm() {
    const form = document.getElementById('leadForm');
    const note = document.getElementById('formNote');
    if (!form || !note) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = form.name.value.trim();
      const business = form.business.value;
      const whatsapp = form.whatsapp.value.trim();

      if (!name || !business || !whatsapp) {
        note.textContent = 'Please fill in every field so we can reach you.';
        note.style.color = '#ff8a8a';
        return;
      }

      // No backend wired up — this simulates a submit confirmation.
      note.style.color = 'var(--cyan)';
      note.textContent = `Thanks, ${name.split(' ')[0]}! We'll message you on WhatsApp shortly.`;
      form.reset();
    });
  })();

});