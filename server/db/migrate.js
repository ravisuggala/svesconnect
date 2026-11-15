// Usage: npm run migrate   (creates the database if allowed, applies schema.sql, creates the first admin)
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });
const mysql = require("mysql2/promise");
const pool = require("./pool");
const { hashPassword } = require("../core/security");

(async () => {
  const db = process.env.DB_NAME || "svesconnect";
  try {
    const c = await mysql.createConnection({ host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "" });
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4`);
    await c.end();
  } catch (e) {
    console.log("Could not create database (on cPanel create it in 'MySQL Databases' first):", e.message);
  }
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  for (const stmt of sql.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await pool.query(stmt);
  console.log("Schema applied.");

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [ADMIN_EMAIL.toLowerCase()]);
    if (!rows.length) {
      await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?, 'admin')", ["Administrator", ADMIN_EMAIL.toLowerCase(), hashPassword(ADMIN_PASSWORD)]);
      console.log(`Admin user created: ${ADMIN_EMAIL}`);
    }
  }
  await pool.end();
})().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
