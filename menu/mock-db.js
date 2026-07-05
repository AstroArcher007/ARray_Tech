/* ==========================================================================
   mock-db.js — In-memory stand-in for Firebase Firestore (compat API)
   ==========================================================================

   This file exists ONLY for the live demo page. It implements just enough
   of the `db.collection(...)` surface that app.js and admin.js already use
   (orderBy, onSnapshot, add, update, delete) so both files run completely
   unmodified against fake data instead of a real project.

   Everything lives in a plain JS object in the browser tab's memory:
     - No network calls, no real Firebase project, no API keys.
     - Every change any "phone" makes is instantly visible to the other,
       because both simulated apps share this same in-memory store.
     - Refreshing the page resets everything back to the seed data below —
       nothing is ever written to disk.

   To go from this demo to a real deployment, swap this file back out for
   a real firebase-config.js (see that file's own comments) — app.js and
   admin.js don't need to change at all.
   ========================================================================== */

const db = (function () {
  "use strict";

  // --- Seed data: a sample menu for a fictional Indian restaurant --------

  const seedCategories = [
    { id: "cat_starters", name: "Starters", order: 1 },
    { id: "cat_mains", name: "Main Course", order: 2 },
    { id: "cat_breads", name: "Breads", order: 3 },
    { id: "cat_rice", name: "Rice & Biryani", order: 4 },
    { id: "cat_desserts", name: "Desserts", order: 5 },
    { id: "cat_beverages", name: "Beverages", order: 6 },
  ];

  const seedMenu = [
    // --- Starters ---
    { id: "dish_paneer_tikka", name: "Paneer Tikka", description: "Char-grilled cottage cheese marinated in yogurt and spices.", price: 260, category: "Starters", dietType: "veg", spiceLevel: 2, isAlcoholic: false, isSpecial: true, order: 1 },
    { id: "dish_hara_bhara_kabab", name: "Hara Bhara Kabab", description: "Spinach and green pea patties with a crisp sesame crust.", price: 220, category: "Starters", dietType: "veg", spiceLevel: 1, isAlcoholic: false, isSpecial: false, order: 2 },
    { id: "dish_gobi_manchurian", name: "Gobi Manchurian", description: "Crispy cauliflower tossed in a tangy Indo-Chinese sauce.", price: 210, category: "Starters", dietType: "veg", spiceLevel: 2, isAlcoholic: false, isSpecial: false, order: 3 },
    { id: "dish_chicken_65", name: "Chicken 65", description: "Deep-fried chicken bites tempered with curry leaf and chilli.", price: 280, category: "Starters", dietType: "non-veg", spiceLevel: 3, isAlcoholic: false, isSpecial: false, order: 4 },
    { id: "dish_tandoori_chicken", name: "Tandoori Chicken (Half)", description: "Clay-oven roasted chicken marinated overnight in spiced yogurt.", price: 320, category: "Starters", dietType: "non-veg", spiceLevel: 2, isAlcoholic: false, isSpecial: true, order: 5 },

    // --- Main Course ---
    { id: "dish_butter_chicken", name: "Butter Chicken", description: "Tandoori chicken simmered in a velvety tomato and butter gravy.", price: 380, category: "Main Course", dietType: "non-veg", spiceLevel: 1, isAlcoholic: false, isSpecial: true, order: 1 },
    { id: "dish_dal_makhani", name: "Dal Makhani", description: "Black lentils slow-cooked overnight with butter and cream.", price: 260, category: "Main Course", dietType: "veg", spiceLevel: 1, isAlcoholic: false, isSpecial: false, order: 2 },
    { id: "dish_palak_paneer", name: "Palak Paneer", description: "Cottage cheese cubes in a smooth, mildly spiced spinach gravy.", price: 280, category: "Main Course", dietType: "veg", spiceLevel: 1, isAlcoholic: false, isSpecial: false, order: 3 },
    { id: "dish_chana_masala", name: "Chana Masala", description: "Chickpeas simmered in a tangy onion-tomato masala.", price: 230, category: "Main Course", dietType: "veg", spiceLevel: 2, isAlcoholic: false, isSpecial: false, order: 4 },
    { id: "dish_egg_curry", name: "Egg Curry", description: "Boiled eggs in a spiced coconut and onion curry.", price: 240, category: "Main Course", dietType: "egg", spiceLevel: 2, isAlcoholic: false, isSpecial: false, order: 5 },
    { id: "dish_rogan_josh", name: "Mutton Rogan Josh", description: "Slow-braised mutton in a fiery Kashmiri red chilli gravy.", price: 420, category: "Main Course", dietType: "non-veg", spiceLevel: 3, isAlcoholic: false, isSpecial: false, order: 6 },

    // --- Breads ---
    { id: "dish_garlic_naan", name: "Garlic Naan", description: "Tandoor-baked leavened bread topped with garlic and coriander.", price: 90, category: "Breads", dietType: "veg", spiceLevel: 0, isAlcoholic: false, isSpecial: false, order: 1 },
    { id: "dish_tandoori_roti", name: "Tandoori Roti", description: "Whole-wheat flatbread baked fresh in the clay oven.", price: 40, category: "Breads", dietType: "veg", spiceLevel: 0, isAlcoholic: false, isSpecial: false, order: 2 },
    { id: "dish_laccha_paratha", name: "Laccha Paratha", description: "Flaky, layered whole-wheat bread brushed with ghee.", price: 80, category: "Breads", dietType: "veg", spiceLevel: 0, isAlcoholic: false, isSpecial: false, order: 3 },

    // --- Rice & Biryani ---
    { id: "dish_chicken_biryani", name: "Chicken Biryani", description: "Basmati rice layered and slow-cooked with spiced chicken.", price: 340, category: "Rice & Biryani", dietType: "non-veg", spiceLevel: 2, isAlcoholic: false, isSpecial: true, order: 1 },
    { id: "dish_veg_biryani", name: "Veg Biryani", description: "Basmati rice dum-cooked with seasonal vegetables and saffron.", price: 260, category: "Rice & Biryani", dietType: "veg", spiceLevel: 1, isAlcoholic: false, isSpecial: false, order: 2 },
    { id: "dish_jeera_rice", name: "Jeera Rice", description: "Steamed basmati rice tempered with cumin and ghee.", price: 180, category: "Rice & Biryani", dietType: "veg", spiceLevel: 0, isAlcoholic: false, isSpecial: false, order: 3 },

    // --- Desserts ---
    { id: "dish_gulab_jamun", name: "Gulab Jamun", description: "Warm milk-solid dumplings soaked in cardamom sugar syrup.", price: 120, category: "Desserts", dietType: "veg", spiceLevel: 0, isAlcoholic: false, isSpecial: false, order: 1 },
    { id: "dish_gajar_halwa", name: "Gajar Ka Halwa", description: "Slow-cooked carrot pudding with khoya, ghee, and cashews.", price: 140, category: "Desserts", dietType: "veg", spiceLevel: 0, isAlcoholic: false, isSpecial: false, order: 2 },

    // --- Beverages ---
    { id: "dish_masala_chai", name: "Masala Chai", description: "Spiced Indian tea simmered with milk, ginger, and cardamom.", price: 60, category: "Beverages", dietType: "veg", spiceLevel: 0, isAlcoholic: false, isSpecial: false, order: 1 },
    { id: "dish_mango_lassi", name: "Mango Lassi", description: "Chilled yogurt smoothie blended with ripe Alphonso mango.", price: 130, category: "Beverages", dietType: "veg", spiceLevel: 0, isAlcoholic: false, isSpecial: false, order: 2 },
    { id: "dish_kingfisher", name: "Kingfisher Beer (330ml)", description: "Crisp, chilled Indian lager.", price: 220, category: "Beverages", dietType: "veg", spiceLevel: 0, isAlcoholic: true, isSpecial: false, order: 3 },
    { id: "dish_old_monk", name: "Old Monk Rum (60ml)", description: "Dark rum with notes of vanilla and caramel, served neat or on ice.", price: 180, category: "Beverages", dietType: "veg", spiceLevel: 0, isAlcoholic: true, isSpecial: false, order: 4 },
  ];

  // --- Minimal in-memory Firestore-compat emulator ------------------------

  const store = {}; // collectionName -> Map<id, data-without-id>
  let nextId = 1;

  function seedCollection(name, docs) {
    const map = new Map();
    docs.forEach(({ id, ...rest }) => map.set(id, rest));
    store[name] = { docs: map, listeners: [] };
  }

  seedCollection("menu", seedMenu);
  seedCollection("categories", seedCategories);

  function getCollection(name) {
    if (!store[name]) store[name] = { docs: new Map(), listeners: [] };
    return store[name];
  }

  function snapshotFor(name) {
    const coll = getCollection(name);
    return {
      docs: Array.from(coll.docs.entries()).map(([id, data]) => ({
        id,
        data: () => ({ ...data }),
      })),
    };
  }

  function notify(name) {
    const coll = getCollection(name);
    const snapshot = snapshotFor(name);
    coll.listeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (err) {
        console.error(`Listener for "${name}" threw:`, err);
      }
    });
  }

  function collectionRef(name) {
    const ref = {
      // Ordering is a no-op here — both app.js and admin.js already sort
      // the data themselves once it arrives, exactly as they would with
      // results from a real Firestore query.
      orderBy() {
        return ref;
      },
      onSnapshot(onNext, onError) {
        const coll = getCollection(name);
        coll.listeners.push(onNext);
        // Fire asynchronously so callers see the same "loading -> loaded"
        // sequence they'd see against a real, momentarily-empty connection.
        setTimeout(() => {
          try {
            onNext(snapshotFor(name));
          } catch (err) {
            if (onError) onError(err);
          }
        }, 120);
        return () => {
          coll.listeners = coll.listeners.filter((cb) => cb !== onNext);
        };
      },
      doc(id) {
        return {
          async update(data) {
            const coll = getCollection(name);
            const existing = coll.docs.get(id) || {};
            coll.docs.set(id, { ...existing, ...data });
            notify(name);
          },
          async delete() {
            const coll = getCollection(name);
            coll.docs.delete(id);
            notify(name);
          },
        };
      },
      async add(data) {
        const id = `local_${Date.now()}_${nextId++}`;
        getCollection(name).docs.set(id, { ...data });
        notify(name);
        return { id };
      },
    };
    return ref;
  }

  return { collection: collectionRef };
})();
