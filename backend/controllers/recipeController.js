const pool = require("../config/db");
const { buildImageUrl } = require("../config/minio");

console.log("🍳 RECIPE CONTROLLER - INGREDIENT-PRIORITY SEARCH");

// ========================================
// ✅ GET RECOMMENDED RECIPES
// STRICT: Only show recipes that match ALL user preferences
// ========================================
exports.getRecommendedRecipes = async (req, res) => {
  try {
    const userId = req.user?.id;

    console.log("\n========================================");
    console.log("⭐ GET RECOMMENDED RECIPES (STRICT MATCHING)");
    console.log("User ID:", userId);

    if (!userId) {
      const query = `SELECT * FROM recipes ORDER BY rating DESC LIMIT 20`;
      const result = await pool.query(query);
      return res.json(result.rows.map(r => ({ ...r, image_url: buildImageUrl(r.image_url) })));
    }

    // Get user preferences
    const prefQuery = `
      SELECT diet_type, allergies, cuisines, skill_level, meal_goal, health_goal
      FROM user_preferences
      WHERE user_id = $1
    `;

    const prefResult = await pool.query(prefQuery, [userId]);

    if (prefResult.rows.length === 0) {
      console.log("⚠️ No preferences - returning popular recipes");
      const query = `
        SELECT r.*,
          CASE WHEN uf.recipe_id IS NOT NULL THEN true ELSE false END as is_favorite
        FROM recipes r
        LEFT JOIN user_favorites uf ON r.recipe_id = uf.recipe_id AND uf.user_id = $1
        ORDER BY rating DESC LIMIT 20
      `;
      const result = await pool.query(query, [userId]);
      return res.json(result.rows.map(r => ({ ...r, image_url: buildImageUrl(r.image_url) })));
    }

    const prefs = prefResult.rows[0];
    console.log("\n📋 USER PREFERENCES:", JSON.stringify(prefs, null, 2));

    // Build STRICT WHERE conditions
    let params = [userId];
    let paramIndex = 2;
    let whereConditions = [];

    // Diet Type Filter
    if (prefs.diet_type) {
      if (prefs.diet_type === 'Veg') {
        whereConditions.push(`dietary_preference = 'Veg'`);
        console.log("🔒 STRICT FILTER: dietary_preference = 'Veg'");
      } else if (prefs.diet_type === 'Vegan') {
        whereConditions.push(`dietary_preference = 'Vegan'`);
        console.log("🔒 STRICT FILTER: dietary_preference = 'Vegan'");
      } else if (prefs.diet_type === 'Non-Veg') {
        whereConditions.push(`dietary_preference IN ('Non-Veg', 'Veg')`);
        console.log("🔒 STRICT FILTER: dietary_preference = 'Non-Veg' or 'Veg'");
      }
    }

    // Meal Goal Filter
    if (prefs.meal_goal) {
      whereConditions.push(`meal_type = $${paramIndex}`);
      params.push(prefs.meal_goal);
      console.log(`🔒 STRICT FILTER: meal_type = '${prefs.meal_goal}'`);
      paramIndex++;
    }

    // Cuisine Filter
    if (prefs.cuisines && Array.isArray(prefs.cuisines) && prefs.cuisines.length > 0) {
      const validCuisines = prefs.cuisines.filter(c => c && c !== 'None' && c !== '(None)');
      if (validCuisines.length > 0) {
        whereConditions.push(`cuisine_type = ANY($${paramIndex})`);
        params.push(validCuisines);
        console.log(`🔒 STRICT FILTER: cuisine_type IN`, validCuisines);
        paramIndex++;
      }
    }

    // Exclude allergens
    if (prefs.allergies && Array.isArray(prefs.allergies) && prefs.allergies.length > 0) {
      const validAllergens = prefs.allergies.filter(a => a && a !== 'None');
      if (validAllergens.length > 0) {
        validAllergens.forEach(allergen => {
          whereConditions.push(`(allergens IS NULL OR allergens NOT ILIKE $${paramIndex})`);
          params.push(`%${allergen}%`);
          console.log(`🔒 STRICT FILTER: EXCLUDE allergen '${allergen}'`);
          paramIndex++;
        });
      }
    }

    let query = `
      SELECT r.*,
        CASE WHEN uf.recipe_id IS NOT NULL THEN true ELSE false END as is_favorite
      FROM recipes r
      LEFT JOIN user_favorites uf ON r.recipe_id = uf.recipe_id AND uf.user_id = $1
    `;

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ` ORDER BY rating DESC, created_at DESC`;

    console.log("\n📡 STRICT MATCHING QUERY:");
    console.log(query);
    console.log("\n📡 PARAMETERS:");
    params.forEach((p, i) => console.log(`  $${i + 1} →`, p));

    const result = await pool.query(query, params);

    console.log(`\n✅ FOUND ${result.rows.length} RECIPES MATCHING ALL PREFERENCES`);

    if (result.rows.length > 0) {
      console.log("\n📊 MATCHING RECIPES:");
      result.rows.slice(0, 10).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.title} (${r.dietary_preference}, ${r.meal_type}, ${r.cuisine_type})`);
      });
    } else {
      console.log("\n⚠️ NO RECIPES MATCH ALL USER PREFERENCES");
    }

    console.log("========================================\n");
    res.json(result.rows.map(r => ({ ...r, image_url: buildImageUrl(r.image_url) })));

  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error("Stack:", error.stack);
    res.status(500).json({ error: error.message });
  }
};

// ========================================
// ✅ INGREDIENT SEARCH WITH PRIORITY MATCHING
// ========================================
exports.getRecipes = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { search, ingredients, difficulty, mealType, dietary, cuisine, servings } = req.query;

    console.log("\n========================================");
    console.log("🔍 INGREDIENT-PRIORITY SEARCH");
    console.log("Search params:", { ingredients, difficulty, mealType, dietary, cuisine, servings });
    console.log("User ID:", userId);

    let mandatoryConditions = [];
    let params = [userId || null];
    let paramIndex = 2;

    if (ingredients) {
      const ingredientList = ingredients.split(',').map(i => i.trim());
      console.log("\n🥘 PRIORITY 1 - MANDATORY INGREDIENTS:", ingredientList);

      ingredientList.forEach(ing => {
        mandatoryConditions.push(`LOWER(ingredients) LIKE $${paramIndex}`);
        params.push(`%${ing.toLowerCase()}%`);
        paramIndex++;
      });
      console.log("✅ Recipe MUST contain ALL these ingredients");
    }

    if (dietary) {
      const diets = dietary.split(',').map(d => d.trim());
      mandatoryConditions.push(`dietary_preference = ANY($${paramIndex})`);
      params.push(diets);
      console.log("\n🥗 PRIORITY 2 - MANDATORY DIETARY:", diets);
      paramIndex++;
    }

    if (difficulty) {
      mandatoryConditions.push(`difficulty_level = $${paramIndex}`);
      params.push(difficulty);
      console.log("\n🎯 PRIORITY 3 - MANDATORY DIFFICULTY:", difficulty);
      paramIndex++;
    }

    if (mealType) {
      const types = mealType.split(',').map(m => m.trim());
      mandatoryConditions.push(`meal_type = ANY($${paramIndex})`);
      params.push(types);
      console.log("\n🍽️ PRIORITY 4 - MANDATORY MEAL TYPE:", types);
      paramIndex++;
    }

    if (cuisine) {
      const cuisines = cuisine.split(',').map(c => c.trim());
      mandatoryConditions.push(`cuisine_type = ANY($${paramIndex})`);
      params.push(cuisines);
      console.log("\n🌍 PRIORITY 5 - MANDATORY CUISINE:", cuisines);
      paramIndex++;
    }

    if (userId) {
      try {
        const prefQuery = `
          SELECT diet_type, allergies
          FROM user_preferences
          WHERE user_id = $1
        `;
        const prefResult = await pool.query(prefQuery, [userId]);

        if (prefResult.rows.length > 0) {
          const prefs = prefResult.rows[0];

          if (prefs.allergies && Array.isArray(prefs.allergies) && prefs.allergies.length > 0) {
            const validAllergens = prefs.allergies.filter(a => a && a !== 'None');
            if (validAllergens.length > 0) {
              validAllergens.forEach(allergen => {
                mandatoryConditions.push(`(allergens IS NULL OR allergens NOT ILIKE $${paramIndex})`);
                params.push(`%${allergen}%`);
                console.log(`🔒 EXCLUDING ALLERGEN: ${allergen}`);
                paramIndex++;
              });
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Could not fetch user preferences:", err.message);
      }
    }

    let query = `
      SELECT r.*,
        CASE WHEN uf.recipe_id IS NOT NULL THEN true ELSE false END as is_favorite
      FROM recipes r
      LEFT JOIN user_favorites uf ON r.recipe_id = uf.recipe_id AND uf.user_id = $1
    `;

    if (mandatoryConditions.length > 0) {
      query += ` WHERE ${mandatoryConditions.join(' AND ')}`;
    }

    query += ` ORDER BY rating DESC, created_at DESC`;

    console.log("\n📡 FINAL QUERY:");
    console.log(query);
    console.log("\n📡 PARAMETERS:");
    params.forEach((p, i) => console.log(`  $${i + 1} →`, p));

    const result = await pool.query(query, params);

    console.log(`\n✅ FOUND ${result.rows.length} RECIPES`);

    if (result.rows.length === 0) {
      console.log("\n⚠️ NO RESULTS - SUGGESTIONS:");
      console.log("  1. Check if ingredients are in database");
      console.log("  2. Verify dietary preference exists");
      console.log("  3. Try relaxing some filters");
    } else if (result.rows.length > 0) {
      console.log("\n📊 SAMPLE RESULTS:");
      result.rows.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.title}`);
        console.log(`     - Cuisine: ${r.cuisine_type}`);
        console.log(`     - Dietary: ${r.dietary_preference}`);
        console.log(`     - Difficulty: ${r.difficulty_level}`);
        console.log(`     - Meal: ${r.meal_type}`);
      });
    }

    console.log("========================================\n");

    res.json(result.rows.map(r => ({ ...r, image_url: buildImageUrl(r.image_url) })));

  } catch (error) {
    console.error("❌ ERROR:", error.message);
    console.error("Stack:", error.stack);
    res.status(500).json({ error: error.message });
  }
};

// ========================================
// ✅ GET ALL RECIPES - WITH MEALTYPE, CUISINE, AND SEARCH SUPPORT
// ========================================
exports.getAllRecipes = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { search, sortBy, mealType, cuisine } = req.query;

    console.log("\n========================================");
    console.log("📋 GET ALL RECIPES");
    console.log("Search query:", search);
    console.log("Sort by:", sortBy);
    console.log("Meal Type:", mealType);
    console.log("Cuisine:", cuisine);
    console.log("User ID:", userId);

    let params = [userId || null];
    let paramIndex = 2;
    let whereConditions = [];


    if (mealType && mealType.trim()) {
      whereConditions.push(`r.meal_type = $${paramIndex}`);
      params.push(mealType.trim());
      console.log("🍽️ Filtering by meal type:", mealType);
      paramIndex++;
    }


    if (cuisine && cuisine.trim()) {
      whereConditions.push(`r.cuisine_type = $${paramIndex}`);
      params.push(cuisine.trim());
      console.log("🌍 Filtering by cuisine:", cuisine);
      paramIndex++;
    }


    if (search && search.trim()) {
      whereConditions.push(`(
        LOWER(r.title) LIKE $${paramIndex} OR
        LOWER(r.description) LIKE $${paramIndex} OR
        LOWER(r.ingredients) LIKE $${paramIndex}
      )`);
      params.push(`%${search.toLowerCase().trim()}%`);
      console.log("🔍 Filtering by search term:", search);
      paramIndex++;
    }


    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    }

    // Determine sort order
    let orderBy = 'r.created_at DESC';
    if (sortBy === 'popularity') {
      orderBy = 'r.rating DESC, r.created_at DESC';
    } else if (sortBy === 'rating') {
      orderBy = 'r.rating DESC';
    }

    const query = `
      SELECT r.*,
        CASE WHEN uf.recipe_id IS NOT NULL THEN true ELSE false END as is_favorite
      FROM recipes r
      LEFT JOIN user_favorites uf ON r.recipe_id = uf.recipe_id AND uf.user_id = $1
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT 100
    `;

    console.log("\n📡 QUERY:");
    console.log(query);
    console.log("\n📡 PARAMETERS:");
    params.forEach((p, i) => console.log(`  $${i + 1} →`, p));

    const result = await pool.query(query, params);

    console.log(`\n✅ FOUND ${result.rows.length} RECIPES`);

    if (result.rows.length > 0 && (mealType || cuisine)) {
      console.log("\n📊 SAMPLE RESULTS:");
      result.rows.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.title}`);
        console.log(`     - Meal Type: ${r.meal_type}`);
        console.log(`     - Cuisine: ${r.cuisine_type}`);
      });
    }

    console.log("========================================\n");

    res.json(result.rows.map(r => ({ ...r, image_url: buildImageUrl(r.image_url) })));
  } catch (error) {
    console.error("❌ getAllRecipes error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ========================================
// ✅ GET RECIPE BY ID
// ========================================
exports.getRecipeById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    console.log("\n========================================");
    console.log("📖 GET RECIPE BY ID");
    console.log("Recipe ID:", id);
    console.log("User ID:", userId);

    const query = `
      SELECT r.*,
        CASE WHEN uf.recipe_id IS NOT NULL THEN true ELSE false END as is_favorite
      FROM recipes r
      LEFT JOIN user_favorites uf ON r.recipe_id = uf.recipe_id AND uf.user_id = $1
      WHERE r.recipe_id = $2
    `;

    const result = await pool.query(query, [userId || null, id]);

    if (result.rows.length === 0) {
      console.log("❌ Recipe not found");
      console.log("========================================\n");
      return res.status(404).json({ message: "Recipe not found" });
    }

    console.log("✅ Recipe found:");
    console.log("   Title:", result.rows[0].title);
    console.log("   is_favorite:", result.rows[0].is_favorite);
    console.log("========================================\n");

    res.json({ ...result.rows[0], image_url: buildImageUrl(result.rows[0].image_url) });
  } catch (error) {
    console.error("❌ getRecipeById error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ========================================
// TOGGLE FAVORITE
// ========================================
exports.toggleFavorite = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { recipeId } = req.params;

    console.log("\n========================================");
    console.log("💖 TOGGLE FAVORITE");
    console.log("User ID:", userId);
    console.log("Recipe ID:", recipeId);

    if (!userId) {
      console.log("❌ Not authenticated");
      console.log("========================================\n");
      return res.status(401).json({ message: "Not authenticated" });
    }

    const check = await pool.query(
      "SELECT * FROM user_favorites WHERE user_id = $1 AND recipe_id = $2",
      [userId, recipeId]
    );

    if (check.rows.length > 0) {
      await pool.query(
        "DELETE FROM user_favorites WHERE user_id = $1 AND recipe_id = $2",
        [userId, recipeId]
      );
      console.log("💔 Removed from favorites");
      console.log("========================================\n");
      res.json({ message: "Removed from favorites", is_favorite: false });
    } else {
      await pool.query(
        "INSERT INTO user_favorites (user_id, recipe_id) VALUES ($1, $2)",
        [userId, recipeId]
      );
      console.log("❤️ Added to favorites");
      console.log("========================================\n");
      res.json({ message: "Added to favorites", is_favorite: true });
    }
  } catch (error) {
    console.error("❌ toggleFavorite error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ========================================
// GET FAVORITES
// ========================================
exports.getFavorites = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const query = `
      SELECT r.*, true as is_favorite
      FROM recipes r
      INNER JOIN user_favorites uf ON r.recipe_id = uf.recipe_id
      WHERE uf.user_id = $1
      ORDER BY uf.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    res.json(result.rows.map(r => ({ ...r, image_url: buildImageUrl(r.image_url) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ========================================
// DELETE FAVORITE
// ========================================
exports.deleteFavorite = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { recipeId } = req.params;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    await pool.query(
      "DELETE FROM user_favorites WHERE user_id = $1 AND recipe_id = $2",
      [userId, recipeId]
    );
    res.json({ message: "Removed from favorites", is_favorite: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

console.log("✅ Ingredient-Priority Search Controller loaded\n");
console.log("📌 Search Logic:");
console.log("   1. Ingredients = MANDATORY (must contain ALL)");
console.log("   2. Dietary preference = MANDATORY (if selected)");
console.log("   3. Difficulty, Meal Type, Cuisine = MANDATORY (if selected)");
console.log("   4. Frontend calculates match % and sorts results");
console.log("   5. Meal Type and Cuisine filtering in getAllRecipes");
console.log("");

module.exports = exports;