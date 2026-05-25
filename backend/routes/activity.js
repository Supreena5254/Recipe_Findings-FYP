// backend/routes/activity.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

// ============================================
// LOG A COOKED RECIPE
// POST /api/activity/cooked
// ============================================
router.post("/cooked", authMiddleware, async (req, res) => {
  const { recipe_id, calories, protein, carbs, fats, cuisine, meal_type, title } = req.body;
  const userId = req.user.id;

  try {
    // Prevent duplicate entries for same recipe on same day
    const existing = await pool.query(
      `SELECT id FROM cooked_recipes
       WHERE user_id = $1 AND recipe_id = $2
       AND DATE(cooked_at) = CURRENT_DATE`,
      [userId, recipe_id]
    );

    if (existing.rows.length > 0) {
      return res.json({ message: "Already logged today", alreadyLogged: true });
    }

    await pool.query(
      `INSERT INTO cooked_recipes
       (user_id, recipe_id, title, calories, protein, carbs, fats, cuisine, meal_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, recipe_id, title, calories || 0, protein || 0, carbs || 0, fats || 0, cuisine || "", meal_type || ""]
    );

    console.log(`✅ Cooked recipe logged: user=${userId}, recipe=${recipe_id}`);
    res.json({ message: "Cooked recipe logged successfully", alreadyLogged: false });
  } catch (err) {
    console.error("❌ Error logging cooked recipe:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// LOG A VIEWED RECIPE
// POST /api/activity/viewed
// ============================================
router.post("/viewed", authMiddleware, async (req, res) => {
  const { recipe_id, title, calories, cuisine, meal_type } = req.body;
  const userId = req.user.id;

  try {
    // Only log once per recipe per day
    const existing = await pool.query(
      `SELECT id FROM viewed_recipes
       WHERE user_id = $1 AND recipe_id = $2
       AND DATE(viewed_at) = CURRENT_DATE`,
      [userId, recipe_id]
    );

    if (existing.rows.length > 0) {
      return res.json({ message: "Already viewed today" });
    }

    await pool.query(
      `INSERT INTO viewed_recipes (user_id, recipe_id, title, calories, cuisine, meal_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, recipe_id, title || "", calories || 0, cuisine || "", meal_type || ""]
    );

    console.log(`✅ Viewed recipe logged: user=${userId}, recipe=${recipe_id}`);
    res.json({ message: "View logged successfully" });
  } catch (err) {
    console.error("❌ Error logging viewed recipe:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET WEEKLY SUMMARY
// GET /api/activity/weekly-summary
// ============================================
router.get("/weekly-summary", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // Get all cooked recipes in last 7 days
    const cookedResult = await pool.query(
      `SELECT
        cr.id,
        cr.recipe_id,
        cr.title,
        cr.calories,
        cr.protein,
        cr.carbs,
        cr.fats,
        cr.cuisine,
        cr.meal_type,
        cr.cooked_at
       FROM cooked_recipes cr
       WHERE cr.user_id = $1
       AND cr.cooked_at >= NOW() - INTERVAL '7 days'
       ORDER BY cr.cooked_at DESC`,
      [userId]
    );

    // Get distinct viewed recipes in last 7 days (deduplicated per recipe)
    const viewedResult = await pool.query(
      `SELECT DISTINCT ON (recipe_id)
        id,
        recipe_id,
        title,
        calories,
        cuisine,
        meal_type,
        viewed_at
       FROM viewed_recipes
       WHERE user_id = $1
       AND viewed_at >= NOW() - INTERVAL '7 days'
       ORDER BY recipe_id, viewed_at DESC`,
      [userId]
    );

    console.log(`✅ Weekly summary: ${cookedResult.rows.length} cooked, ${viewedResult.rows.length} viewed`);

    res.json({
      cooked: cookedResult.rows,
      viewed: viewedResult.rows,
    });
  } catch (err) {
    console.error("❌ Error fetching weekly summary:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;