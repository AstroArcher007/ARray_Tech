/* ==========================================================================
   Admin Dashboard — admin.js
   Full CRUD against the `menu` Firestore collection:
     - Create:  form submit with no dishId set
     - Read:    real-time onSnapshot populates the dish list + category options
     - Update:  clicking "Edit" on a dish card loads it into the form;
                submitting then updates that document instead of creating one
     - Delete:  "Delete" button on each dish card, with a confirm step
   ========================================================================== */

(function () {
  "use strict";

  const menuCollection = db.collection("menu");

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
  const dietSelect = document.getElementById("dietSelect");
  const dietRadios = dietSelect.querySelectorAll('input[name="dietType"]');

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
  let toastTimer = null;

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

  function refreshCategoryOptions(selectedValue) {
    const sorted = Array.from(knownCategories).sort((a, b) => a.localeCompare(b));
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

  addCategoryBtn.addEventListener("click", () => {
    const name = newCategoryInput.value.trim();
    if (!name) return;
    knownCategories.add(name);
    refreshCategoryOptions(name);
    categorySelect.value = name;
    newCategoryInput.value = "";
    newCategoryRow.classList.remove("is-visible");
  });

  newCategoryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCategoryBtn.click();
    }
  });

  // --- Form: create / update ---------------------------------------------

  function resetForm() {
    dishForm.reset();
    dishIdField.value = "";
    setSelectedDietType("veg");
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
    setSelectedDietType(dish.dietType);
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
    const dietType = getSelectedDietType();

    if (!name || !description || !category || isNaN(price) || price < 0) {
      showToast("Please fill in every field with a valid value.", true);
      return;
    }

    const payload = { name, description, price, category, isSpecial, dietType };
    const existingId = dishIdField.value;

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

  // --- Rendering the dish list --------------------------------------------

  function renderDishCard(dish) {
    return `
      <article class="dish-card" data-id="${dish.id}">
        <div class="dish-card__main">
          <div class="dish-card__top">
            ${dietMarker(dish.dietType)}
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

  function renderDishList(dishes) {
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

    dishTable.innerHTML = dishes.map(renderDishCard).join("");

    dishTable.querySelectorAll(".dish-card").forEach((card) => {
      const id = card.dataset.id;
      const dish = allDishes.find((d) => d.id === id);
      if (!dish) return;

      card.querySelector(".edit-btn").addEventListener("click", () => loadDishIntoForm(dish));
      card.querySelector(".delete-btn").addEventListener("click", () => deleteDish(id, dish.name));
    });
  }

  function applyAdminSearch() {
    const query = adminSearch.value.trim().toLowerCase();
    if (!query) {
      renderDishList(allDishes);
      return;
    }
    const filtered = allDishes.filter((dish) => {
      const haystack = `${dish.name} ${dish.description} ${dish.category}`.toLowerCase();
      return haystack.includes(query);
    });
    renderDishList(filtered);
  }

  adminSearch.addEventListener("input", applyAdminSearch);

  // --- Real-time subscription ----------------------------------------------

  function subscribeToMenu() {
    menuCollection.orderBy("name").onSnapshot(
      (snapshot) => {
        allDishes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        knownCategories = new Set(allDishes.map((d) => d.category).filter(Boolean));
        refreshCategoryOptions();

        applyAdminSearch();

        statusDot.classList.add("is-live");
        statusText.textContent = "Live";
      },
      (error) => {
        console.error("Firestore subscription error:", error);
        statusDot.classList.remove("is-live");
        statusText.textContent = "Connection error";
        showToast("Lost connection to the database.", true);
      }
    );
  }

  setSelectedDietType("veg");
  subscribeToMenu();
})();
