const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  generateOTP,
  generateVerificationToken,
  sendOTPEmail,
  sendVerificationLinkEmail,
} = require("../services/emailService");

/* ===========================
   REGISTER USER (with email verification)
=========================== */
exports.registerUser = async (req, res) => {
  try {
    let { full_name, email, password, date_of_birth } = req.body;

    // Validation
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Normalize
    email = email.toLowerCase().trim();
    full_name = full_name.trim();

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Auto-generate username
    const username = email.split("@")[0];

    // Check if user exists
    const userExists = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "User already exists with this email" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Insert user with unverified status
    const newUser = await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, date_of_birth, email_verified, verification_otp, otp_expiry)
       VALUES ($1, $2, $3, $4, $5, false, $6, $7)
       RETURNING id, full_name, username, email`,
      [full_name, username, email, hashedPassword, date_of_birth || null, otp, otpExpiry]
    );

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, full_name);

    if (!emailSent) {
      // Delete user if email fails
      await pool.query("DELETE FROM users WHERE id = $1", [newUser.rows[0].id]);
      return res.status(500).json({ error: "Failed to send verification email. Please try again." });
    }

    console.log("✅ User registered (pending verification):", email);

    res.status(201).json({
      message: "Registration successful! Please check your email for verification code.",
      user: newUser.rows[0],
      requiresVerification: true,
    });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
};

/* ===========================
   VERIFY OTP
=========================== */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const user = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email.toLowerCase().trim()]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = user.rows[0];

    // Check if already verified
    if (userData.email_verified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    // Check OTP expiry
    if (new Date() > new Date(userData.otp_expiry)) {
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    // Verify OTP
    if (userData.verification_otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Mark as verified
    await pool.query(
      "UPDATE users SET email_verified = true, verification_otp = NULL, otp_expiry = NULL WHERE id = $1",
      [userData.id]
    );

    console.log("✅ Email verified:", email);

    res.json({ message: "Email verified successfully!" });
  } catch (err) {
    console.error("❌ Verify OTP error:", err);
    res.status(500).json({ error: "Server error during verification" });
  }
};

/* ===========================
   RESEND OTP
=========================== */
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email.toLowerCase().trim()]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = user.rows[0];

    if (userData.email_verified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Update OTP
    await pool.query(
      "UPDATE users SET verification_otp = $1, otp_expiry = $2 WHERE id = $3",
      [otp, otpExpiry, userData.id]
    );

    // Send OTP
    await sendOTPEmail(email, otp, userData.full_name);

    console.log("✅ OTP resent to:", email);

    res.json({ message: "New OTP sent to your email" });
  } catch (err) {
    console.error("❌ Resend OTP error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/* ===========================
   LOGIN USER (only if verified)
=========================== */
exports.loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    email = email.toLowerCase().trim();

    const user = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const userData = user.rows[0];

    // Check if email is verified
    if (!userData.email_verified) {
      return res.status(403).json({
        error: "Please verify your email before logging in",
        requiresVerification: true,
      });
    }

    // Compare password
    const isValid = await bcrypt.compare(password, userData.password_hash);

    if (!isValid) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: userData.id, email: userData.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    console.log("✅ User logged in:", email);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: userData.id,
        full_name: userData.full_name,
        username: userData.username,
        email: userData.email,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
};

/* ===========================
   GET PROFILE WITH PREFERENCES
=========================== */
exports.getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        u.id, u.full_name, u.username, u.email, u.date_of_birth, u.created_at,
        p.diet_type, p.allergies, p.cuisines, p.skill_level, p.meal_goal, p.health_goal
       FROM users u
       LEFT JOIN user_preferences p ON u.id = p.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ Profile fetched for user:", req.user.id);

    res.json({
      message: "Profile retrieved",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/* ===========================
   UPDATE PROFILE
=========================== */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    let { full_name, date_of_birth } = req.body;

    full_name = full_name.trim();

    const updated = await pool.query(
      `UPDATE users
       SET full_name = $1, date_of_birth = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, full_name, username, email, date_of_birth`,
      [full_name, date_of_birth, userId]
    );

    console.log("✅ Profile updated for user:", userId);

    res.json({
      message: "Profile updated successfully",
      user: updated.rows[0],
    });
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/* ===========================
   UPDATE PREFERENCES
=========================== */
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    let {
      diet_type,
      allergies,
      cuisines,
      skill_level,
      meal_goal,
      health_goal,
    } = req.body;

    console.log("📥 Received preferences update for user:", userId);
    console.log("📋 Data received:", {
      diet_type,
      allergies,
      cuisines,
      skill_level,
      meal_goal,
      health_goal
    });


    // Handle allergies
    let allergiesArray = null;
    if (allergies) {
      if (typeof allergies === 'string') {
        // Convert "Milk, Eggs" to ["Milk", "Eggs"]
        allergiesArray = allergies.split(',').map(item => item.trim()).filter(Boolean);
      } else if (Array.isArray(allergies)) {
        allergiesArray = allergies;
      }
    }

    // Handle cuisines
    let cuisinesArray = null;
    if (cuisines) {
      if (typeof cuisines === 'string') {
        // Convert "Italian, Chinese" to ["Italian", "Chinese"]
        cuisinesArray = cuisines.split(',').map(item => item.trim()).filter(Boolean);
      } else if (Array.isArray(cuisines)) {
        cuisinesArray = cuisines;
      }
    }

    console.log("📦 Converted to arrays:", {
      allergiesArray,
      cuisinesArray
    });

    await pool.query(
      `INSERT INTO user_preferences
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
         updated_at = NOW()`,
      [userId, diet_type, allergiesArray, cuisinesArray, skill_level, meal_goal, health_goal]
    );

    console.log("✅ Preferences updated for user:", userId);

    res.json({ message: "Preferences saved successfully" });
  } catch (err) {
    console.error("❌ Preferences error FULL DETAILS:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
    });
    res.status(500).json({
      error: "Server error",
      details: err.message,
      hint: err.detail
    });
  }
};

/* ===========================
   CHANGE PASSWORD
=========================== */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({ error: "Both passwords required" });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(old_password, user.rows[0].password_hash);

    if (!valid) {
      return res.status(400).json({ error: "Old password is incorrect" });
    }

    const hashed = await bcrypt.hash(new_password, 10);

    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hashed, userId]
    );

    console.log("✅ Password changed for user:", userId);

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("❌ Change password error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/* ===========================
   LOGOUT
=========================== */
exports.logoutUser = (req, res) => {
  res.json({ message: "Logged out successfully" });
};

/* ===========================
   FORGOT PASSWORD - Send OTP
=========================== */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email.toLowerCase().trim()]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "No account found with this email" });
    }

    const userData = user.rows[0];

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP for password reset
    await pool.query(
      "UPDATE users SET verification_otp = $1, otp_expiry = $2 WHERE id = $3",
      [otp, otpExpiry, userData.id]
    );

    // Send OTP email
    await sendOTPEmail(email, otp, userData.full_name);

    console.log("✅ Password reset OTP sent to:", email);

    res.json({ message: "Password reset code sent to your email" });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/* ===========================
   RESET PASSWORD with OTP
=========================== */
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;

    if (!email || !otp || !new_password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email.toLowerCase().trim()]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = user.rows[0];

    // Check OTP expiry
    if (new Date() > new Date(userData.otp_expiry)) {
      return res.status(400).json({ error: "Reset code has expired. Please request a new one." });
    }

    // Verify OTP
    if (userData.verification_otp !== otp) {
      return res.status(400).json({ error: "Invalid reset code" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password and clear OTP
    await pool.query(
      "UPDATE users SET password_hash = $1, verification_otp = NULL, otp_expiry = NULL, updated_at = NOW() WHERE id = $2",
      [hashedPassword, userData.id]
    );

    console.log("✅ Password reset successful for:", email);

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("❌ Reset password error:", err);
    res.status(500).json({ error: "Server error" });
  }
};