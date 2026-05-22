const pool = require("../config/db");
const { minioClient, BUCKET_NAME, buildImageUrl } = require("../config/minio");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// GET all recipes (for admin list)
exports.getAllRecipes = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT recipe_id, title, cuisine_type, meal_type, dietary_preference, difficulty_level, calories, rating, rating_count, created_at FROM recipes ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Admin getAllRecipes:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET single recipe (for edit)
exports.getRecipe = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM recipes WHERE recipe_id = $1",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST create recipe
exports.createRecipe = async (req, res) => {
  try {
    const {
      title, description, ingredients, quantity, instructions,
      cooking_time, difficulty_level, dietary_preference,
      cuisine_type, meal_type, calories, protein, carbs, fats,
      allergens, image_url, servings
    } = req.body;

    if (!title || !ingredients || !instructions) {
      return res.status(400).json({ error: "title, ingredients, instructions are required" });
    }

    const result = await pool.query(
      `INSERT INTO recipes
        (title, description, ingredients, quantity, instructions,
         cooking_time, difficulty_level, dietary_preference,
         cuisine_type, meal_type, calories, protein, carbs, fats,
         allergens, image_url, servings, rating, rating_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,0,0)
       RETURNING *`,
      [
        title, description || null, ingredients, quantity || null, instructions,
        cooking_time || 30, difficulty_level || "Beginner", dietary_preference || "Veg",
        cuisine_type || "Nepali", meal_type || "Lunch",
        calories || 0, protein || 0, carbs || 0, fats || 0,
        allergens || null, image_url || null, servings || 2
      ]
    );

    res.status(201).json({ message: "Recipe created", recipe: result.rows[0] });
  } catch (err) {
    console.error("❌ Admin createRecipe:", err);
    res.status(500).json({ error: err.message });
  }
};

// PUT update recipe
exports.updateRecipe = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, ingredients, quantity, instructions,
      cooking_time, difficulty_level, dietary_preference,
      cuisine_type, meal_type, calories, protein, carbs, fats,
      allergens, image_url, servings
    } = req.body;

    const result = await pool.query(
      `UPDATE recipes SET
        title=$1, description=$2, ingredients=$3, quantity=$4, instructions=$5,
        cooking_time=$6, difficulty_level=$7, dietary_preference=$8,
        cuisine_type=$9, meal_type=$10, calories=$11, protein=$12,
        carbs=$13, fats=$14, allergens=$15, image_url=$16, servings=$17
       WHERE recipe_id=$18 RETURNING *`,
      [
        title, description, ingredients, quantity, instructions,
        cooking_time, difficulty_level, dietary_preference,
        cuisine_type, meal_type, calories, protein, carbs, fats,
        allergens, image_url, servings, id
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: "Recipe not found" });
    res.json({ message: "Recipe updated", recipe: result.rows[0] });
  } catch (err) {
    console.error("❌ Admin updateRecipe:", err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE recipe
exports.deleteRecipe = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM recipes WHERE recipe_id = $1 RETURNING title",
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Not found" });
    res.json({ message: `Recipe "${result.rows[0].title}" deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST upload image
exports.uploadImage = [
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const ext = req.file.originalname.split(".").pop();
      const fileName = `recipe-${uuidv4()}.${ext}`;
      await minioClient.putObject(
        BUCKET_NAME, fileName,
        req.file.buffer, req.file.buffer.length,
        { "Content-Type": req.file.mimetype }
      );
      console.log(`✅ Admin image uploaded: ${fileName}`);
      res.json({ success: true, imageUrl: fileName });
    } catch (err) {
      console.error("❌ Admin upload:", err);
      res.status(500).json({ error: err.message });
    }
  }
];

// GET dashboard stats
exports.getStats = async (req, res) => {
  try {
    const [recipes, users, ratings] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM recipes"),
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM ratings"),
    ]);
    res.json({
      totalRecipes: parseInt(recipes.rows[0].count),
      totalUsers: parseInt(users.rows[0].count),
      totalRatings: parseInt(ratings.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET all users ────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    console.log("✅ Admin getAllUsers called");
    const result = await pool.query(
      `SELECT
         id,
         full_name,
         username,
         email,
         is_admin,
         email_verified,
         date_of_birth,
         created_at
       FROM users
       ORDER BY created_at DESC`
    );
    console.log(`✅ Admin getAllUsers: found ${result.rows.length} users`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Admin getAllUsers:", err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET all ratings joined with recipe title + username ──
// Table columns: rating_id, recipe_id, user_id, rating, comment, created_at
exports.getAllRatings = async (req, res) => {
  try {
    console.log("✅ Admin getAllRatings called");
    const result = await pool.query(
      `SELECT
         r.rating_id,
         r.rating,
         r.comment      AS review,
         r.created_at,
         r.recipe_id,
         rec.title      AS recipe_title,
         r.user_id,
         u.full_name    AS user_name,
         u.username
       FROM ratings r
       LEFT JOIN recipes rec ON rec.recipe_id = r.recipe_id
       LEFT JOIN users   u   ON u.id = r.user_id
       ORDER BY r.created_at DESC`
    );
    console.log(`✅ Admin getAllRatings: found ${result.rows.length} ratings`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Admin getAllRatings:", err);
    res.status(500).json({ error: err.message });
  }
};