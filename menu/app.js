/* ==========================================================================
   Client Menu — app.js
   Reads the `menu` collection from Firestore in real time and renders:
     1. A "Today's Special" horizontal strip for items where isSpecial === true
     2. Category tabs with a swipeable/scrollable panel per category
   ========================================================================== */

(function () {
  "use strict";

  const specialTrack = document.getElementById("specialTrack");
  const categoryNav = document.getElementById("categoryNav");
  const categoryNavIndicator = document.getElementById("categoryNavIndicator");
  const categoryViewport = document.getElementById("categoryViewport");
  const categoryTrack = document.getElementById("categoryTrack");
  const searchInput = document.getElementById("searchInput");

  /** Full unfiltered snapshot of the menu, kept in memory so search can
   *  re-render instantly without re-querying Firestore. */
  let allDishes = [];

  /** Index of the category panel currently in view. */
  let activeIndex = 0;

  /** Swipe-tracking state for the touch/pointer drag on the panel track. */
  let dragState = null;

  // Indian Rupee formatting — no decimal places for whole-rupee menu prices,
  // matches how Indian menus are typically printed (e.g. ₹350, not ₹350.00).
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  const SPARKLE_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2l2.6 6.6L21 11l-6.4 2.4L12 20l-2.6-6.6L3 11l6.4-2.4L12 2z"></path>
    </svg>`;

  const CORNER_FLOURISH = `
    <svg class="special-card__corner" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4">
      <path d="M16 2 L16 30 M2 16 L30 16" opacity="0.35"></path>
      <circle cx="16" cy="16" r="6" opacity="0.6"></circle>
    </svg>`;

  const SWIPE_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 5l-6 7 6 7M15 5l6 7-6 7"></path>
    </svg>`;

  /** Diet marker: the standard Indian menu convention of a square outline
   *  containing a colored dot. Green = veg, maroon = non-veg, brown = egg. */
  function dietMarker(dietType) {
    const type = dietType === "non-veg" || dietType === "egg" ? dietType : "veg";
    const cls = type === "non-veg" ? "diet-marker--nonveg" : type === "egg" ? "diet-marker--egg" : "diet-marker--veg";
    const label = type === "non-veg" ? "Non-vegetarian" : type === "egg" ? "Contains egg" : "Vegetarian";
    return `
      <svg class="diet-marker ${cls}" viewBox="0 0 16 16" role="img" aria-label="${label}">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"></rect>
        <circle cx="8" cy="8" r="3.4" fill="currentColor"></circle>
      </svg>`;
  }

  /** Escapes text before it's placed into innerHTML, so dish data typed by
   *  a restaurant staffer never breaks markup or enables injection. */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function formatPrice(price) {
    const num = typeof price === "number" ? price : parseFloat(price);
    return currencyFormatter.format(isNaN(num) ? 0 : num);
  }

  /** Groups a flat dish array into an ordered list of { name, items },
   *  preserving first-seen category order so tabs don't reshuffle randomly. */
  function groupByCategory(dishes) {
    const order = [];
    const map = new Map();
    dishes.forEach((dish) => {
      const cat = dish.category || "Uncategorized";
      if (!map.has(cat)) {
        map.set(cat, []);
        order.push(cat);
      }
      map.get(cat).push(dish);
    });
    return order.map((name) => ({ name, items: map.get(name) }));
  }

  function renderSpecials(dishes) {
    const specials = dishes.filter((d) => d.isSpecial);

    if (specials.length === 0) {
      specialTrack.innerHTML = `<div class="special-empty">No specials on the menu right now — check back soon.</div>`;
      return;
    }

    specialTrack.innerHTML = specials
      .map(
        (dish) => `
        <article class="special-card">
          ${CORNER_FLOURISH}
          <div class="special-card__category">${escapeHtml(dish.category || "Special")}</div>
          <div class="special-card__name-row">
            ${dietMarker(dish.dietType)}
            <h3 class="special-card__name">${escapeHtml(dish.name)}</h3>
          </div>
          <p class="special-card__desc">${escapeHtml(dish.description)}</p>
          <div class="special-card__footer">
            <span class="special-card__price">${formatPrice(dish.price)}</span>
          </div>
        </article>`
      )
      .join("");
  }

  function renderMenuItem(dish) {
    return `
      <div class="menu-item">
        <div class="menu-item__main">
          <div class="menu-item__name-row">
            ${dietMarker(dish.dietType)}
            <span class="menu-item__name">${escapeHtml(dish.name)}</span>
            ${dish.isSpecial ? `<span class="menu-item__badge">${SPARKLE_ICON}Special</span>` : ""}
          </div>
          <p class="menu-item__desc">${escapeHtml(dish.description)}</p>
        </div>
        <span class="menu-item__price">${formatPrice(dish.price)}</span>
      </div>`;
  }

  /** Builds the tab bar, the sliding underline indicator, and one swipeable
   *  panel per category. Keeps whichever category was active before a
   *  re-render (e.g. from search) in view when possible. */
  function renderCategories(dishes) {
    if (dishes.length === 0) {
      categoryNav.innerHTML = "";
      categoryNavIndicator.style.width = "0px";
      categoryTrack.innerHTML = `<div class="category-panel"><div class="menu-empty">No dishes match your search.</div></div>`;
      categoryTrack.style.transform = "translateX(0%)";
      return;
    }

    const groups = groupByCategory(dishes);
    if (activeIndex >= groups.length) activeIndex = 0;

    categoryNav.innerHTML = groups
      .map(
        (group, i) => `
        <button class="category-tab${i === activeIndex ? " is-active" : ""}" data-index="${i}">
          ${escapeHtml(group.name)}
          <span class="category-tab__count">${group.items.length}</span>
        </button>`
      )
      .join("");

    categoryTrack.innerHTML = groups
      .map(
        (group) => `
        <div class="category-panel">
          <div class="category-panel__card">
            <div class="category__items">
              ${group.items.map(renderMenuItem).join("")}
            </div>
          </div>
          <div class="swipe-hint">${SWIPE_ICON}Swipe to browse categories</div>
        </div>`
      )
      .join("");

    categoryNav.querySelectorAll(".category-tab").forEach((btn) => {
      btn.addEventListener("click", () => goToCategory(Number(btn.dataset.index), true));
    });

    goToCategory(activeIndex, false);
  }

  /** Moves the track to the given category index, updates the active tab
   *  state, slides the underline indicator, and scrolls the tab into view. */
  function goToCategory(index, animate) {
    const tabs = categoryNav.querySelectorAll(".category-tab");
    if (tabs.length === 0) return;
    index = Math.max(0, Math.min(index, tabs.length - 1));
    activeIndex = index;

    categoryTrack.style.transition = animate ? "" : "none";
    categoryTrack.style.transform = `translateX(-${index * 100}%)`;
    if (!animate) {
      // Force reflow so the transition-disable actually takes effect before
      // it's re-enabled on the next interaction.
      void categoryTrack.offsetHeight;
      categoryTrack.style.transition = "";
    }

    tabs.forEach((tab, i) => tab.classList.toggle("is-active", i === index));

    const activeTab = tabs[index];
    const navIndicator = categoryNavIndicator;
    navIndicator.style.width = `${activeTab.offsetWidth}px`;
    navIndicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;

    activeTab.scrollIntoView({ behavior: animate ? "smooth" : "auto", inline: "center", block: "nearest" });
  }

  // --- Swipe / drag handling on the category track ------------------------

  function onDragStart(clientX) {
    dragState = { startX: clientX, currentX: clientX, width: categoryViewport.offsetWidth };
    categoryTrack.style.transition = "none";
  }

  function onDragMove(clientX) {
    if (!dragState) return;
    dragState.currentX = clientX;
    const delta = dragState.currentX - dragState.startX;
    const basePercent = -activeIndex * 100;
    const deltaPercent = (delta / dragState.width) * 100;
    categoryTrack.style.transform = `translateX(${basePercent + deltaPercent}%)`;
  }

  function onDragEnd() {
    if (!dragState) return;
    const delta = dragState.currentX - dragState.startX;
    const threshold = dragState.width * 0.18;
    categoryTrack.style.transition = "";

    if (delta > threshold) {
      goToCategory(activeIndex - 1, true);
    } else if (delta < -threshold) {
      goToCategory(activeIndex + 1, true);
    } else {
      goToCategory(activeIndex, true);
    }
    dragState = null;
  }

  categoryViewport.addEventListener("touchstart", (e) => onDragStart(e.touches[0].clientX), { passive: true });
  categoryViewport.addEventListener("touchmove", (e) => onDragMove(e.touches[0].clientX), { passive: true });
  categoryViewport.addEventListener("touchend", onDragEnd);

  categoryViewport.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return; // touch handled above
    onDragStart(e.clientX);
  });
  window.addEventListener("pointermove", (e) => onDragMove(e.clientX));
  window.addEventListener("pointerup", onDragEnd);

  window.addEventListener("resize", () => goToCategory(activeIndex, false));

  function renderAll(dishes) {
    renderSpecials(dishes);
    renderCategories(dishes);
  }

  function applySearch() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      renderAll(allDishes);
      return;
    }
    const filtered = allDishes.filter((dish) => {
      const haystack = `${dish.name} ${dish.description} ${dish.category}`.toLowerCase();
      return haystack.includes(query);
    });
    renderAll(filtered);
  }

  function showLoadError() {
    categoryTrack.innerHTML = `
      <div class="category-panel">
        <div class="menu-empty">
          The menu couldn't be loaded. Please check your connection, or ask staff for a printed menu.
        </div>
      </div>`;
    categoryNav.innerHTML = "";
    specialTrack.innerHTML = "";
  }

  /** Real-time Firestore listener — the menu updates live as the admin
   *  panel makes changes, with no page reload needed. */
  function subscribeToMenu() {
    db.collection("menu")
      .orderBy("name")
      .onSnapshot(
        (snapshot) => {
          allDishes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          applySearch();
        },
        (error) => {
          console.error("Firestore subscription error:", error);
          showLoadError();
        }
      );
  }

  searchInput.addEventListener("input", applySearch);

  subscribeToMenu();
})();
