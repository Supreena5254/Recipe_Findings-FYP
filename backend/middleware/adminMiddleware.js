const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const adminMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader) return res.status(401).json({ error: "No token" });

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7) : authHeader;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check is_admin in DB (not just JWT)
    const result = await pool.query(
      "SELECT is_admin FROM users WHERE id = $1",
      [decoded.id]
    );

    if (!result.rows[0]?.is_admin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token is not valid" });
  }
};

module.exports = adminMiddleware;