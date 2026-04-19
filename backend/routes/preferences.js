const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

//
router.put("/", authMiddleware, async (req, res) => {
  const {
    diet_type,
    allergies,
    cuisines,
    skill_level,
    meal_goal,
    health_goal,
  } = req.body;

  try {
    console.log("\n========================================");
    console.log("📥 SAVING USER PREFERENCES");
    console.log("========================================");
    console.log("User ID:", req.user.id);
    console.log("Diet Type:", diet_type);
    console.log("Allergies:", allergies, "- Type:", Array.isArray(allergies) ? "ARRAY" : typeof allergies);
    console.log("Cuisines:", cuisines, "- Type:", Array.isArray(cuisines) ? "ARRAY" : typeof cuisines);
    console.log("Skill Level:", skill_level);
    console.log("Meal Goal:", meal_goal);
    console.log("Health Goal:", health_goal);

    const result = await pool.query(
      `
      INSERT INTO user_preferences
      (user_id, diet_type, allergies, cuisines, skill_level, meal_goal, health_goal)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (user_id)
      DO UPDATE SET
        diet_type = EXCLUDED.diet_type,
        allergies = EXCLUDED.allergies,
        cuisines = EXCLUDED.cuisines,
        skill_level = EXCLUDED.skill_level,
        meal_goal = EXCLUDED.meal_goal,
        health_goal = EXCLUDED.health_goal,
        updated_at = NOW()
      RETURNING *
      `,
      [
        req.user.id,
        diet_type,
        allergies,
        cuisines,
        skill_level,
        meal_goal,
        health_goal,
      ]
    );

    console.log("✅ Preferences saved successfully");
    console.log("✅ Saved data:", result.rows[0]);
    console.log("========================================\n");

    res.json({ message: "Preferences saved successfully" });
  } catch (err) {
    console.error("❌ PREFERENCES ERROR:", err);
    console.error("Stack:", err.stack);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;