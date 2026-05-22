const express = require("express");
const router = express.Router();
const adminMiddleware = require("../middleware/adminMiddleware");
const adminController = require("../controllers/adminController");

// All admin routes are protected by adminMiddleware
router.use(adminMiddleware);

// ── Dashboard ──────────────────────────────────────────────
router.get("/stats",          adminController.getStats);

// ── Recipes ───────────────────────────────────────────────
router.get("/recipes",        adminController.getAllRecipes);
router.get("/recipes/:id",    adminController.getRecipe);
router.post("/recipes",       adminController.createRecipe);
router.put("/recipes/:id",    adminController.updateRecipe);
router.delete("/recipes/:id", adminController.deleteRecipe);

// ── Image upload ──────────────────────────────────────────
router.post("/upload",        adminController.uploadImage);

// ── Users ─────────────────────────────────────────────────
router.get("/users",          adminController.getAllUsers);

// ── Ratings ───────────────────────────────────────────────
router.get("/ratings",        adminController.getAllRatings);

module.exports = router;