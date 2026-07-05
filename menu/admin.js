/* ==========================================================================
   Admin Dashboard — admin.js
   Full CRUD against the `menu` Firestore collection, plus a lightweight
   `categories` collection used purely to store display order:
     - Create:  form submit with no dishId set
     - Read:    real-time onSnapshot populates the dish list + category options
     - Update:  clicking "Edit" on a dish card loads it into the form;
                submitting then updates that document instead of creating one
     - Delete:  "Delete" button on each dish card, with a confirm step
     - Reorder: drag-and-drop for both categories (top panel) and dishes
                within a category (grouped list below), writing new `order`
                numbers back to Firestore on drop
   ========================================================================== */

(function () {
  "use strict";

  const menuCollection = db.collection("menu");
  const categoriesCollection = db.collection("categories");

  // --- DOM references -------------------------------------------------
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  const dishForm = document.getElementById("dishForm");
  const dishIdField = document.getElementById("dishId");
  const dishNameField = document.getElementById("dishName");
  const dishDescriptionField = document.getElementById("dishDescription");
  const dishPriceField = document.getElementById("dishPrice");
  const categorySelect = document.getElementById("categorySelect");
  const isSpecialToggle = document.getElementById("isSpecialToggle");
  const isAlcoholicToggle = document.getElementById("isAlcoholicToggle");
  const dietSelect = document.getElementById("dietSelect");
  const dietRadios = dietSelect.querySelectorAll('input[name="dietType"]');
  const spiceSelect = document.getElementById("spiceSelect");
  const spiceRadios = spiceSelect.querySelectorAll('input[name="spiceLevel"]');

  const categoryOrderList = document.getElementById("categoryOrderList");
  const saveCategoryOrderBtn = document.getElementById("saveCategoryOrderBtn");

  const formTitle = document.getElementById("formTitle");
  const formHint = document.getElementById("formHint");
  const submitBtn = document.getElementById("submitBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  const newCategoryToggle = document.getElementById("newCategoryToggle");
  const newCategoryRow = document.getElementById("newCategoryRow");
  const newCategoryInput = document.getElementById("newCategoryInput");
  const addCategoryBtn = document.getElementById("addCategoryBtn");

  const dishTable = document.getElementById("dishTable");
  const adminSearch = document.getElementById("adminSearch");

  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");

  // --- State ------------------------------------------------------------
  let allDishes = [];
  let knownCategories = new Set();
  let categoryOrders = new Map(); // categoryName -> { order, docId }
  let toastTimer = null;

  /** Local working order used while dragging, before it's saved to Firestore.
   *  Array of category names in the order the admin has arranged them. */
  let categoryOrderDraft = [];

  let draggedCategoryEl = null;
  let draggedDishEl = null;

  // Indian Rupee formatting to match the client menu.
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  const SPARKLE_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2l2.6 6.6L21 11l-6.4 2.4L12 20l-2.6-6.6L3 11l6.4-2.4L12 2z"></path>
    </svg>`;

  const EDIT_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>`;

  const TRASH_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path>
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"></path>
    </svg>`;

  const CHECK_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6L9 17l-5-5"></path>
    </svg>`;

  const ALERT_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>`;

  const DRAG_HANDLE_ICON = `
    <svg class="drag-handle" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5"></circle>
      <circle cx="15" cy="6" r="1.5"></circle>
      <circle cx="9" cy="12" r="1.5"></circle>
      <circle cx="15" cy="12" r="1.5"></circle>
      <circle cx="9" cy="18" r="1.5"></circle>
      <circle cx="15" cy="18" r="1.5"></circle>
    </svg>`;

  // A proper little chilli pepper: green stem + curved tapering body (in
  // the theme colour via currentColor) + a soft highlight for shine.
  const CHILLY_PATH = `<path fill="#4a7c46" d="M6.9 1.3c.25-.45.8-.65 1.25-.45.45.2.65.7.5 1.15-.1.3-.35.55-.65.7l-1.5.7-.05-1.5c0-.2.15-.4.45-.6z"/><path fill="currentColor" d="M7.6 2.5c.9-.35 1.9-.15 2.6.5 1.9 1.75 2.35 4.7 1.05 6.95-1.05 1.85-2.85 3.3-4.9 3.95-.85.25-1.5-.6-1.15-1.4.65-1.5.55-3.25-.3-4.65-.85-1.45-.75-3.35.45-4.65.6-.65 1.35-.9 2.25-.7z"/><path fill="#fff" opacity="0.35" d="M7.3 4.1c.5-.35 1.15-.35 1.6.05.85.75 1.05 2.05.45 3.05-.35.6-.85 1.1-1.45 1.4-.35.15-.7-.15-.6-.5.25-.85.15-1.8-.3-2.55-.25-.4-.15-.9.3-1.15z"/>`;

  const WINE_GLASS_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 22h8M12 15v7M5 2h14l-1.5 7.5a5.5 5.5 0 01-11 0L5 2z"></path>
    </svg>`;

  /** Diet marker: same square-outline-with-dot convention used on the
   *  client menu, so staff see exactly what customers will see. */
  function dietMarker(dietType) {
    const type = dietType === "non-veg" || dietType === "egg" ? dietType : "veg";
    const cls = type === "non-veg" ? "diet-marker--nonveg" : type === "egg" ? "diet-marker--egg" : "diet-marker--veg";
    return `
      <svg class="diet-marker ${cls}" viewBox="0 0 16 16">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"></rect>
        <circle cx="8" cy="8" r="3.4" fill="currentColor"></circle>
      </svg>`;
  }

  /** Spice marker: renders 1-3 filled chilly icons based on level (1-3).
   *  Returns an empty string when there's no spice level set (0 or absent) —
   *  the mark is optional and most dishes won't show it at all. */
  function spiceMarker(spiceLevel) {
    const level = Number(spiceLevel);
    if (!level || level < 1) return "";
    const count = Math.min(3, Math.max(1, Math.round(level)));
    const icon = `<svg viewBox="0 0 16 16">${CHILLY_PATH}</svg>`;
    return `<span class="spice-marker" title="Spice level: ${count}/3">${icon.repeat(count)}</span>`;
  }

  function alcoholMarker(isAlcoholic) {
    if (!isAlcoholic) return "";
    return `<svg class="alcohol-marker" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="Contains alcohol"><path d="M8 22h8M12 15v7M5 2h14l-1.5 7.5a5.5 5.5 0 01-11 0L5 2z"></path></svg>`;
  }

  function getSelectedDietType() {
    const checked = dietSelect.querySelector('input[name="dietType"]:checked');
    return checked ? checked.value : "veg";
  }

  function setSelectedDietType(value) {
    const target = value === "non-veg" || value === "egg" ? value : "veg";
    dietRadios.forEach((radio) => {
      radio.checked = radio.value === target;
      radio.closest(".diet-option").classList.toggle("is-checked", radio.checked);
    });
  }

  // Keep the fallback class in sync when the user clicks a diet option directly.
  dietRadios.forEach((radio) => {
    radio.addEventListener("change", () => setSelectedDietType(radio.value));
  });

  function getSelectedSpiceLevel() {
    const checked = spiceSelect.querySelector('input[name="spiceLevel"]:checked');
    return checked ? parseInt(checked.value, 10) : 0;
  }

  function setSelectedSpiceLevel(value) {
    const target = String(Number(value) || 0);
    spiceRadios.forEach((radio) => {
      radio.checked = radio.value === target;
      radio.closest(".spice-option").classList.toggle("is-checked", radio.checked);
    });
  }

  spiceRadios.forEach((radio) => {
    radio.addEventListener("change", () => setSelectedSpiceLevel(radio.value));
  });

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function formatPrice(price) {
    const num = typeof price === "number" ? price : parseFloat(price);
    return currencyFormatter.format(isNaN(num) ? 0 : num);
  }

  function showToast(message, isError) {
    clearTimeout(toastTimer);
    toastMessage.textContent = message;
    toast.classList.toggle("is-error", Boolean(isError));
    toast.querySelector("svg").innerHTML = isError
      ? ALERT_ICON.match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1]
      : CHECK_ICON.match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1];
    toast.classList.add("is-visible");
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  // --- Category select population ---------------------------------------

  function sortedCategoryNames() {
    // Prefer the explicit drag-established draft order; fall back to
    // whatever's stored in Firestore for any category not yet in the draft.
    const known = Array.from(knownCategories);
    return known.sort((a, b) => {
      const draftA = categoryOrderDraft.indexOf(a);
      const draftB = categoryOrderDraft.indexOf(b);
      if (draftA !== -1 && draftB !== -1) return draftA - draftB;
      if (draftA !== -1) return -1;
      if (draftB !== -1) return 1;
      const orderA = categoryOrders.has(a) ? categoryOrders.get(a).order : Infinity;
      const orderB = categoryOrders.has(b) ? categoryOrders.get(b).order : Infinity;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
  }

  function refreshCategoryOptions(selectedValue) {
    const sorted = sortedCategoryNames();
    const previousValue = selectedValue !== undefined ? selectedValue : categorySelect.value;

    categorySelect.innerHTML =
      `<option value="" disabled${!previousValue ? " selected" : ""}>Select…</option>` +
      sorted.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");

    if (previousValue && sorted.includes(previousValue)) {
      categorySelect.value = previousValue;
    }
  }

  newCategoryToggle.addEventListener("click", () => {
    newCategoryRow.classList.toggle("is-visible");
    if (newCategoryRow.classList.contains("is-visible")) {
      newCategoryInput.focus();
    }
  });

  addCategoryBtn.addEventListener("click", async () => {
    const name = newCategoryInput.value.trim();
    if (!name) return;

    const isNew = !knownCategories.has(name);
    knownCategories.add(name);
    refreshCategoryOptions(name);
    categorySelect.value = name;
    newCategoryInput.value = "";
    newCategoryRow.classList.remove("is-visible");

    if (isNew) {
      try {
        const nextOrder = categoryOrders.size > 0 ? Math.max(...Array.from(categoryOrders.values()).map((c) => c.order)) + 1 : 1;
        await categoriesCollection.add({ name, order: nextOrder });
      } catch (error) {
        console.error("Couldn't create category record:", error);
      }
    }
  });

  newCategoryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCategoryBtn.click();
    }
  });

  // --- Category order panel (drag-and-drop) ---------------------------------

  function renderCategoryOrderPanel() {
    if (knownCategories.size === 0) {
      categoryOrderList.innerHTML = `<div class="admin-empty">No categories yet — add a dish to create one.</div>`;
      return;
    }

    const sorted = sortedCategoryNames();
    categoryOrderDraft = sorted.slice();

    categoryOrderList.innerHTML = sorted
      .map((name, index) => {
        const count = allDishes.filter((d) => d.category === name).length;
        return `
          <div class="category-order-row" draggable="true" data-category="${escapeHtml(name)}">
            ${DRAG_HANDLE_ICON}
            <span>
              <span class="category-order-row__name">${escapeHtml(name)}</span>
              <span class="category-order-row__count">${count} ${count === 1 ? "item" : "items"}</span>
            </span>
            <span class="category-order-row__rank">#${index + 1}</span>
          </div>`;
      })
      .join("");

    wireCategoryDragEvents();
  }

  function wireCategoryDragEvents() {
    const rows = categoryOrderList.querySelectorAll(".category-order-row");

    rows.forEach((row) => {
      row.addEventListener("dragstart", () => {
        draggedCategoryEl = row;
        row.classList.add("is-dragging");
      });

      row.addEventListener("dragend", () => {
        row.classList.remove("is-dragging");
        draggedCategoryEl = null;
        rows.forEach((r) => r.classList.remove("is-drag-over"));
        updateCategoryRanksFromDom();
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (row === draggedCategoryEl) return;
        row.classList.add("is-drag-over");
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("is-drag-over");
      });

      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("is-drag-over");
        if (!draggedCategoryEl || draggedCategoryEl === row) return;

        const rowsArray = Array.from(categoryOrderList.children);
        const draggedIndex = rowsArray.indexOf(draggedCategoryEl);
        const targetIndex = rowsArray.indexOf(row);

        if (draggedIndex < targetIndex) {
          row.after(draggedCategoryEl);
        } else {
          row.before(draggedCategoryEl);
        }
      });
    });
  }

  function updateCategoryRanksFromDom() {
    const rows = categoryOrderList.querySelectorAll(".category-order-row");
    rows.forEach((row, index) => {
      const rankEl = row.querySelector(".category-order-row__rank");
      if (rankEl) rankEl.textContent = `#${index + 1}`;
    });
    categoryOrderDraft = Array.from(rows).map((row) => row.dataset.category);
  }

  saveCategoryOrderBtn.addEventListener("click", async () => {
    const rows = categoryOrderList.querySelectorAll(".category-order-row");
    const updates = Array.from(rows).map((row, index) => ({ name: row.dataset.category, order: index + 1 }));

    saveCategoryOrderBtn.disabled = true;
    try {
      await Promise.all(
        updates.map(async ({ name, order }) => {
          const existing = categoryOrders.get(name);
          if (existing && existing.docId) {
            await categoriesCollection.doc(existing.docId).update({ order });
          } else {
            await categoriesCollection.add({ name, order });
          }
        })
      );
      showToast("Category order saved.");
    } catch (error) {
      console.error("Couldn't save category order:", error);
      showToast("Couldn't save category order. Please try again.", true);
    } finally {
      saveCategoryOrderBtn.disabled = false;
    }
  });

  // --- Form: create / update ---------------------------------------------

  function resetForm() {
    dishForm.reset();
    dishIdField.value = "";
    setSelectedDietType("veg");
    setSelectedSpiceLevel(0);
    isAlcoholicToggle.checked = false;
    formTitle.textContent = "Add a dish";
    formHint.textContent = "Fill in the details and save to publish it to the live menu.";
    submitBtn.textContent = "Save dish";
    cancelEditBtn.style.display = "none";
    refreshCategoryOptions("");
  }

  function loadDishIntoForm(dish) {
    dishIdField.value = dish.id;
    dishNameField.value = dish.name || "";
    dishDescriptionField.value = dish.description || "";
    dishPriceField.value = typeof dish.price === "number" ? dish.price : "";
    isSpecialToggle.checked = Boolean(dish.isSpecial);
    isAlcoholicToggle.checked = Boolean(dish.isAlcoholic);
    setSelectedDietType(dish.dietType);
    setSelectedSpiceLevel(dish.spiceLevel);
    refreshCategoryOptions(dish.category || "");

    formTitle.textContent = `Editing "${dish.name}"`;
    formHint.textContent = "Update the details below, then save your changes.";
    submitBtn.textContent = "Update dish";
    cancelEditBtn.style.display = "inline-flex";

    dishNameField.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEditBtn.addEventListener("click", resetForm);

  dishForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = dishNameField.value.trim();
    const description = dishDescriptionField.value.trim();
    const price = parseFloat(dishPriceField.value);
    const category = categorySelect.value;
    const isSpecial = isSpecialToggle.checked;
    const isAlcoholic = isAlcoholicToggle.checked;
    const dietType = getSelectedDietType();
    const spiceLevel = getSelectedSpiceLevel();

    if (!name || !description || !category || isNaN(price) || price < 0) {
      showToast("Please fill in every field with a valid value.", true);
      return;
    }

    const existingId = dishIdField.value;
    let order;

    if (existingId) {
      const existingDish = allDishes.find((d) => d.id === existingId);
      order = existingDish && typeof existingDish.order === "number" ? existingDish.order : undefined;
    }
    if (typeof order !== "number") {
      // New dish, or one with no prior order — place it after the last
      // dish currently in that category. Reorder later via drag-and-drop.
      const dishesInCategory = allDishes.filter((d) => d.category === category);
      order = dishesInCategory.length > 0 ? Math.max(...dishesInCategory.map((d) => (typeof d.order === "number" ? d.order : 0))) + 1 : 1;
    }

    const payload = { name, description, price, category, isSpecial, isAlcoholic, dietType, spiceLevel, order };

    submitBtn.disabled = true;
    try {
      if (existingId) {
        await menuCollection.doc(existingId).update(payload);
        showToast("Dish updated.");
      } else {
        await menuCollection.add(payload);
        showToast("Dish added to the menu.");
      }
      resetForm();
    } catch (error) {
      console.error("Save failed:", error);
      showToast("Couldn't save that dish. Please try again.", true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // --- Delete -------------------------------------------------------------

  async function deleteDish(id, name) {
    const confirmed = window.confirm(`Remove "${name}" from the menu? This can't be undone.`);
    if (!confirmed) return;

    try {
      await menuCollection.doc(id).delete();
      showToast("Dish removed.");
      if (dishIdField.value === id) resetForm();
    } catch (error) {
      console.error("Delete failed:", error);
      showToast("Couldn't remove that dish. Please try again.", true);
    }
  }

  // --- Rendering the dish list (grouped by category, drag-to-reorder) ------

  function renderDishCard(dish, draggable) {
    return `
      <article class="dish-card${draggable ? " is-draggable" : ""}" data-id="${dish.id}" ${draggable ? 'draggable="true"' : ""}>
        ${draggable ? DRAG_HANDLE_ICON.replace('class="drag-handle"', 'class="dish-card__drag-handle"') : ""}
        <div class="dish-card__main">
          <div class="dish-card__top">
            ${dietMarker(dish.dietType)}
            ${spiceMarker(dish.spiceLevel)}
            ${alcoholMarker(dish.isAlcoholic)}
            <span class="dish-card__name">${escapeHtml(dish.name)}</span>
            <span class="dish-card__category">${escapeHtml(dish.category || "Uncategorized")}</span>
            ${dish.isSpecial ? `<span class="dish-card__special">${SPARKLE_ICON}Special</span>` : ""}
          </div>
          <p class="dish-card__desc">${escapeHtml(dish.description)}</p>
          <div class="dish-card__price">${formatPrice(dish.price)}</div>
        </div>
        <div class="dish-card__actions">
          <button class="icon-btn edit-btn" title="Edit dish" aria-label="Edit ${escapeHtml(dish.name)}">${EDIT_ICON}</button>
          <button class="icon-btn delete-btn" title="Delete dish" aria-label="Delete ${escapeHtml(dish.name)}">${TRASH_ICON}</button>
        </div>
      </article>`;
  }

  /** Renders dishes grouped by category (in category order), each group's
   *  dishes draggable to reorder within that category. Dragging is disabled
   *  while a search filter is active, since cross-filtered positions don't
   *  map cleanly back to a real order. */
  function renderDishList(dishes, isFiltered) {
    if (dishes.length === 0) {
      dishTable.innerHTML = `
        <div class="admin-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"></path>
          </svg>
          No dishes yet — add your first one using the form.
        </div>`;
      return;
    }

    if (isFiltered) {
      dishTable.innerHTML = `<div class="dish-group">${dishes.map((d) => renderDishCard(d, false)).join("")}</div>`;
      wireDishCardButtons();
      return;
    }

    const grouped = new Map();
    dishes.forEach((dish) => {
      const cat = dish.category || "Uncategorized";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat).push(dish);
    });

    dishTable.innerHTML = Array.from(grouped.entries())
      .map(([category, items]) => {
        return `
          <div class="dish-group" data-category="${escapeHtml(category)}">
            <div class="dish-group__header">
              <span class="dish-group__title">${escapeHtml(category)}</span>
              <span class="dish-group__count">${items.length} ${items.length === 1 ? "item" : "items"}</span>
            </div>
            ${items.map((d) => renderDishCard(d, true)).join("")}
          </div>`;
      })
      .join("");

    wireDishCardButtons();
    wireDishDragEvents();
  }

  function wireDishCardButtons() {
    dishTable.querySelectorAll(".dish-card").forEach((card) => {
      const id = card.dataset.id;
      const dish = allDishes.find((d) => d.id === id);
      if (!dish) return;

      card.querySelector(".edit-btn").addEventListener("click", () => loadDishIntoForm(dish));
      card.querySelector(".delete-btn").addEventListener("click", () => deleteDish(id, dish.name));
    });
  }

  function wireDishDragEvents() {
    dishTable.querySelectorAll(".dish-group").forEach((group) => {
      const cards = group.querySelectorAll(".dish-card.is-draggable");

      cards.forEach((card) => {
        card.addEventListener("dragstart", () => {
          draggedDishEl = card;
          card.classList.add("is-dragging");
        });

        card.addEventListener("dragend", async () => {
          card.classList.remove("is-dragging");
          draggedDishEl = null;
          cards.forEach((c) => c.classList.remove("is-drag-over"));
          await saveDishOrderForGroup(group);
        });

        card.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (card === draggedDishEl) return;
          card.classList.add("is-drag-over");
        });

        card.addEventListener("dragleave", () => {
          card.classList.remove("is-drag-over");
        });

        card.addEventListener("drop", (e) => {
          e.preventDefault();
          card.classList.remove("is-drag-over");
          if (!draggedDishEl || draggedDishEl === card || draggedDishEl.closest(".dish-group") !== group) return;

          const cardsArray = Array.from(group.querySelectorAll(".dish-card.is-draggable"));
          const draggedIndex = cardsArray.indexOf(draggedDishEl);
          const targetIndex = cardsArray.indexOf(card);

          if (draggedIndex < targetIndex) {
            card.after(draggedDishEl);
          } else {
            card.before(draggedDishEl);
          }
        });
      });
    });
  }

  /** After a drop finishes, write the new 1..N order for every dish in that
   *  category group back to Firestore, matching the new visual sequence. */
  async function saveDishOrderForGroup(groupEl) {
    const cards = groupEl.querySelectorAll(".dish-card.is-draggable");
    const updates = Array.from(cards).map((card, index) => ({ id: card.dataset.id, order: index + 1 }));

    try {
      await Promise.all(updates.map(({ id, order }) => menuCollection.doc(id).update({ order })));
    } catch (error) {
      console.error("Couldn't save dish order:", error);
      showToast("Couldn't save the new order. Please try again.", true);
    }
  }

  function sortDishesForDisplay(dishes) {
    return [...dishes].sort((a, b) => {
      const catOrderA = categoryOrders.has(a.category) ? categoryOrders.get(a.category).order : Infinity;
      const catOrderB = categoryOrders.has(b.category) ? categoryOrders.get(b.category).order : Infinity;
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;

      const dishOrderA = typeof a.order === "number" ? a.order : Infinity;
      const dishOrderB = typeof b.order === "number" ? b.order : Infinity;
      if (dishOrderA !== dishOrderB) return dishOrderA - dishOrderB;

      return (a.name || "").localeCompare(b.name || "");
    });
  }

  function applyAdminSearch() {
    const query = adminSearch.value.trim().toLowerCase();
    if (!query) {
      renderDishList(sortDishesForDisplay(allDishes), false);
      return;
    }
    const filtered = allDishes.filter((dish) => {
      const haystack = `${dish.name} ${dish.description} ${dish.category}`.toLowerCase();
      return haystack.includes(query);
    });
    renderDishList(sortDishesForDisplay(filtered), true);
  }

  adminSearch.addEventListener("input", applyAdminSearch);

  // --- Real-time subscriptions ----------------------------------------------

  let menuLive = false;
  let categoriesLive = false;

  function updateStatus() {
    if (menuLive && categoriesLive) {
      statusDot.classList.add("is-live");
      statusText.textContent = "Live";
    }
  }

  function subscribeToMenu() {
    menuCollection.orderBy("name").onSnapshot(
      (snapshot) => {
        allDishes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const dishCategories = new Set(allDishes.map((d) => d.category).filter(Boolean));
        // Keep any categories that only exist via the categories collection too
        // (e.g. one just added but with no dishes assigned yet).
        knownCategories = new Set([...dishCategories, ...categoryOrders.keys()]);

        refreshCategoryOptions();
        renderCategoryOrderPanel();
        applyAdminSearch();

        menuLive = true;
        updateStatus();
      },
      (error) => {
        console.error("Firestore subscription error:", error);
        statusDot.classList.remove("is-live");
        statusText.textContent = "Connection error";
        showToast("Lost connection to the database.", true);
      }
    );
  }

  function subscribeToCategories() {
    categoriesCollection.onSnapshot(
      (snapshot) => {
        categoryOrders = new Map();
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data && data.name) {
            categoryOrders.set(data.name, { order: typeof data.order === "number" ? data.order : 0, docId: doc.id });
          }
        });

        knownCategories = new Set([...knownCategories, ...categoryOrders.keys()]);

        refreshCategoryOptions();
        renderCategoryOrderPanel();
        applyAdminSearch();

        categoriesLive = true;
        updateStatus();
      },
      (error) => {
        console.error("Categories subscription error:", error);
      }
    );
  }

  setSelectedDietType("veg");
  setSelectedSpiceLevel(0);
  subscribeToMenu();
  subscribeToCategories();
})();
