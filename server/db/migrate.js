// Usage: npm run migrate   (creates DB if allowed, applies schema.sql, upgrades old tables, seeds colleges + principals + admin)
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });
const mysql = require("mysql2/promise");
const pool = require("./pool");
const { hashPassword } = require("../core/security");
const { COLLEGES, defaultPassword, principalEmail } = require("../core/org");

const has = async (sql, params) => (await pool.query(sql, params))[0].length > 0;
const columnExists = (t, c) => has("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?", [t, c]);
const indexExists = (t, i) => has("SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?", [t, i]);

// Brings a database created by an earlier version up to the current users table.
async function upgradeUsers() {
  const add = { college_id: "INT UNSIGNED NULL", department: "VARCHAR(120) NULL", lab_name: "VARCHAR(160) NULL", created_by: "INT UNSIGNED NULL", must_change_password: "TINYINT(1) NOT NULL DEFAULT 1" };
  for (const [col, def] of Object.entries(add)) if (!(await columnExists("users", col))) await pool.query(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
  if (await indexExists("users", "email")) await pool.query("ALTER TABLE users DROP INDEX email");
  if (!(await indexExists("users", "uq_user_college_email"))) await pool.query("ALTER TABLE users ADD UNIQUE KEY uq_user_college_email (college_id, email)");
  if (!(await indexExists("users", "idx_users_scope"))) await pool.query("ALTER TABLE users ADD KEY idx_users_scope (college_id, role, department)");
}

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
  await upgradeUsers();
  console.log("Schema applied.");

  // Colleges
  for (const [i, c] of COLLEGES.entries()) {
    await pool.query(
      "INSERT INTO colleges (code, name, city, is_central, sort_order) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name = VALUES(name), city = VALUES(city), is_central = VALUES(is_central), sort_order = VALUES(sort_order)",
      [c.code, c.name, c.city, c.central ? 1 : 0, i]
    );
  }
  const [rows] = await pool.query("SELECT id, code, name FROM colleges");
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
  console.log(`Colleges ready: ${rows.length}`);

  // Admin (belongs to the central office); pre-existing admins are attached to it.
  await pool.query("UPDATE users SET college_id = ?, must_change_password = 0 WHERE role = 'admin' AND college_id IS NULL", [byCode.CENTRAL.id]);
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const e = ADMIN_EMAIL.toLowerCase();
    if (!(await has("SELECT 1 FROM users WHERE college_id = ? AND email = ?", [byCode.CENTRAL.id, e]))) {
      await pool.query("INSERT INTO users (college_id, name, email, password_hash, role, must_change_password) VALUES (?,?,?,?, 'admin', 0)", [byCode.CENTRAL.id, "Administrator", e, hashPassword(ADMIN_PASSWORD)]);
      console.log(`Admin user created: ${e}`);
    }
  }

  // One default principal account per college.
  let made = 0;
  for (const c of COLLEGES.filter((x) => !x.central)) {
    const email = principalEmail(c.code);
    if (await has("SELECT 1 FROM users WHERE college_id = ? AND role = 'principal'", [byCode[c.code].id])) continue;
    await pool.query("INSERT INTO users (college_id, name, email, password_hash, role, must_change_password) VALUES (?,?,?,?, 'principal', 1)", [byCode[c.code].id, `Principal, ${c.code}`, email, hashPassword(defaultPassword())]);
    made++;
  }
  console.log(`Default principal accounts created: ${made} (email pattern principal.<code>@svesconnect.in)`);
  await pool.end();
})().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
