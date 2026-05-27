const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Registration & Login
router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);

// OTP Verification Routes - ADD THESE TWO LINES!
router.post("/verify-otp", authController.verifyOTP);
router.post("/resend-otp", authController.resendOTP);

// Add these lines to your PUBLIC ROUTES section
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// Profile Management
router.get("/profile", authMiddleware, authController.getProfile);
router.put("/profile", authMiddleware, authController.updateProfile);

// User Preferences
router.put("/preferences", authMiddleware, authController.updatePreferences);

// Password Management
router.put("/change-password", authMiddleware, authController.changePassword);

// Logout
router.post("/logout", authMiddleware, authController.logoutUser);

// Delete account
router.delete("/delete-account", authMiddleware, authController.deleteAccount);

module.exports = router;