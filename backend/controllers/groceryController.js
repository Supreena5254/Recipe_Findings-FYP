
const pool = require("../config/db");

// Get user's grocery list
exports.getGroceryList = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT
        g.grocery_id,
        g.recipe_id,
        r.title as recipe_name,
        g.ingredients,
        g.created_at
      FROM grocery_list g
      LEFT JOIN recipes r ON g.recipe_id = r.recipe_id
      WHERE g.user_id = $1
      ORDER BY g.created_at DESC
    `;

    const result = await pool.query(query, [userId]);

    // Parse ingredients JSON
    const groceryList = result.rows.map(item => ({
      ...item,
      ingredients: typeof item.ingredients === 'string'
        ? JSON.parse(item.ingredients)
        : item.ingredients
    }));

    res.json(groceryList);
  } catch (error) {
    console.error("Error fetching grocery list:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add recipe to grocery list
exports.addRecipeToGrocery = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipeId } = req.params;

    console.log("\n========================================");
    console.log("🛒 ADDING RECIPE TO GROCERY LIST");
    console.log("========================================");
    console.log("User ID:", userId);
    console.log("Recipe ID:", recipeId);

    // Get recipe details - EXPLICITLY SELECT THE QUANTITY COLUMN
    const recipeQuery = `
      SELECT
        recipe_id,
        title,
        ingredients,
        quantity
      FROM recipes
      WHERE recipe_id = $1
    `;

    const recipeResult = await pool.query(recipeQuery, [recipeId]);

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ message: "Recipe not found" });
    }

    const recipe = recipeResult.rows[0];

    console.log("\n📊 RECIPE DATA FROM DATABASE:");
    console.log("Recipe Title:", recipe.title);
    console.log("Raw ingredients field:", recipe.ingredients);
    console.log("Raw quantity field:", recipe.quantity);
    console.log("Type of ingredients:", typeof recipe.ingredients);
    console.log("Type of quantity:", typeof recipe.quantity);

    // Check if recipe already in grocery list
    const checkQuery = "SELECT * FROM grocery_list WHERE user_id = $1 AND recipe_id = $2";
    const checkResult = await pool.query(checkQuery, [userId, recipeId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: "Recipe already in grocery list" });
    }

    // Parse ingredients
    let ingredients = [];
    if (typeof recipe.ingredients === 'string') {
      // Try splitting by newline first
      if (recipe.ingredients.includes('\n')) {
        ingredients = recipe.ingredients.split('\n').map(i => i.trim()).filter(i => i);
      } else {
        // Fall back to semicolon
        ingredients = recipe.ingredients.split(';').map(i => i.trim()).filter(i => i);
      }
    } else if (Array.isArray(recipe.ingredients)) {
      ingredients = recipe.ingredients;
    }

    console.log("\n✅ Parsed ingredients:", ingredients);

    // Parse quantities - CRITICAL: Use 'quantity' NOT 'quantities'
    let quantities = [];
    if (typeof recipe.quantity === 'string') {
      // Try splitting by newline first (matching database format)
      if (recipe.quantity.includes('\n')) {
        quantities = recipe.quantity.split('\n').map(q => q.trim()).filter(q => q);
      } else {
        // Fall back to semicolon
        quantities = recipe.quantity.split(';').map(q => q.trim()).filter(q => q);
      }
    } else if (Array.isArray(recipe.quantity)) {
      quantities = recipe.quantity;
    }

    console.log("✅ Parsed quantities:", quantities);
    console.log("✅ Ingredients count:", ingredients.length);
    console.log("✅ Quantities count:", quantities.length);

    // Create ingredients array with checked status AND quantities
    const ingredientsData = ingredients.map((ing, index) => {
      const item = {
        name: ing,
        quantity: quantities[index] || '',
        checked: false
      };
      console.log(`   [${index}] ${item.name} → ${item.quantity}`);
      return item;
    });

    console.log("\n📦 Final ingredients data:", JSON.stringify(ingredientsData, null, 2));

    // Insert into grocery_list
    const insertQuery = `
      INSERT INTO grocery_list (user_id, recipe_id, ingredients)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      userId,
      recipeId,
      JSON.stringify(ingredientsData)
    ]);

    console.log("✅ Successfully inserted into grocery_list");
    console.log("========================================\n");

    res.json({
      message: "Added to grocery list",
      groceryItem: {
        ...result.rows[0],
        recipe_name: recipe.title,
        ingredients: ingredientsData
      }
    });
  } catch (error) {
    console.error("❌ Error adding to grocery list:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Toggle ingredient checked status
exports.toggleIngredient = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groceryItemId } = req.params;
    const { ingredientIndex } = req.body;

    // Get current grocery item
    const query = "SELECT * FROM grocery_list WHERE grocery_id = $1 AND user_id = $2";
    const result = await pool.query(query, [groceryItemId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Grocery item not found" });
    }

    const groceryItem = result.rows[0];
    const ingredients = typeof groceryItem.ingredients === 'string'
      ? JSON.parse(groceryItem.ingredients)
      : groceryItem.ingredients;

    // Toggle checked status
    if (ingredientIndex >= 0 && ingredientIndex < ingredients.length) {
      ingredients[ingredientIndex].checked = !ingredients[ingredientIndex].checked;

      // Update in database
      const updateQuery = `
        UPDATE grocery_list
        SET ingredients = $1
        WHERE grocery_id = $2 AND user_id = $3
        RETURNING *
      `;

      const updateResult = await pool.query(updateQuery, [
        JSON.stringify(ingredients),
        groceryItemId,
        userId
      ]);

      res.json({
        message: "Ingredient updated",
        groceryItem: {
          ...updateResult.rows[0],
          ingredients
        }
      });
    } else {
      res.status(400).json({ message: "Invalid ingredient index" });
    }
  } catch (error) {
    console.error("Error toggling ingredient:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete grocery item
exports.deleteGroceryItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groceryItemId } = req.params;

    const query = "DELETE FROM grocery_list WHERE grocery_id = $1 AND user_id = $2 RETURNING *";
    const result = await pool.query(query, [groceryItemId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Grocery item not found" });
    }

    res.json({ message: "Grocery item deleted" });
  } catch (error) {
    console.error("Error deleting grocery item:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Clear entire grocery list
exports.clearGroceryList = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = "DELETE FROM grocery_list WHERE user_id = $1";
    await pool.query(query, [userId]);

    res.json({ message: "Grocery list cleared" });
  } catch (error) {
    console.error("Error clearing grocery list:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = exports;