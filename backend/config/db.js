const { Pool } = require("pg");
require("dotenv").config();

// ✅ FIX 1: Reduced max from 20 → 5 to prevent "too many clients" error
// PostgreSQL default max_connections = 100
// Multiple restarts × 20 connections = overflow!
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 5,                    // ✅ Was 20 — way too high for local dev
  min: 1,                    // Keep at least 1 connection alive
  idleTimeoutMillis: 30000,  // Release idle connections after 30s
  connectionTimeoutMillis: 10000,
});

// Handle pool errors WITHOUT crashing the server
pool.on("error", (err) => {
  console.error("⚠️ Unexpected database pool error:", err.message);
});

// ✅ FIX 2: Test connection and log clearly
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    console.error("💡 Make sure PostgreSQL is running!");
    console.error("💡 Run this in pgAdmin to free connections:");
    console.error("   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'recipefinder' AND pid <> pg_backend_pid();");
  } else {
    console.log("✅ Database connected successfully");
    release(); // ✅ CRITICAL: Always release the test connection!
  }
});

module.exports = pool;