// Usage: npm run migrate   (creates DB if allowed, applies schema.sql, upgrades old tables, seeds colleges + principals + admin)
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });
const mysql = require("mysql2/promise");
const pool = require("./pool");
const { hashPassword } = require("../core/security");
const { COLLEGES, defaultPassword, collegeAdminEmail } = require("../core/org");

const has = async (sql, params) => (await pool.query(sql, params))[0].length > 0;
const columnExists = (t, c) => has("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?", [t, c]);
const indexExists = (t, i) => has("SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?", [t, i]);

// Brings a database created by an earlier version up to the current users table.
async function upgradeUsers() {
  const add = { lab_id: "INT UNSIGNED NULL", college_id: "INT UNSIGNED NULL", department: "VARCHAR(120) NULL", lab_name: "VARCHAR(160) NULL", created_by: "INT UNSIGNED NULL", must_change_password: "TINYINT(1) NOT NULL DEFAULT 1" };
  for (const [col, def] of Object.entries(add)) if (!(await columnExists("users", col))) await pool.query(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
  if (await indexExists("users", "email")) await pool.query("ALTER TABLE users DROP INDEX email");
  if (!(await indexExists("users", "uq_user_college_email"))) await pool.query("ALTER TABLE users ADD UNIQUE KEY uq_user_college_email (college_id, email)");
  if (!(await indexExists("users", "idx_users_scope"))) await pool.query("ALTER TABLE users ADD KEY idx_users_scope (college_id, role, department)");
}

// Older databases had a simple equipment table (used by the first chatbot version); add the new columns.
async function upgradeEquipment() {
  const add = {
    college_id: "INT UNSIGNED NULL", lab_id: "INT UNSIGNED NULL", template_key: "VARCHAR(40) NULL", data: "LONGTEXT NULL",
    status: "ENUM('draft','submitted','verified','approved','rejected') NOT NULL DEFAULT 'draft'", review_note: "TEXT NULL", created_by: "INT UNSIGNED NULL",
    submitted_at: "TIMESTAMP NULL", verified_by: "INT UNSIGNED NULL", verified_at: "TIMESTAMP NULL", approved_by: "INT UNSIGNED NULL", approved_at: "TIMESTAMP NULL",
    updated_at: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  };
  for (const [col, def] of Object.entries(add)) if (!(await columnExists("equipment", col))) await pool.query(`ALTER TABLE equipment ADD COLUMN ${col} ${def}`);
  await pool.query("ALTER TABLE users MODIFY role ENUM('student','faculty','external','lab_incharge','event_coordinator','event_member','hod','principal','college_admin','admin') NOT NULL DEFAULT 'student'");
  for (const [t, col, def] of [["users", "event_id", "INT UNSIGNED NULL"], ["labs", "contact_name", "VARCHAR(160)"], ["labs", "contact_email", "VARCHAR(190)"], ["labs", "contact_phone", "VARCHAR(40)"], ["colleges", "address", "VARCHAR(300)"]])
    if (!(await columnExists(t, col))) await pool.query(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`);
  if (!(await columnExists("equipment_catalog", "type_key"))) await pool.query("ALTER TABLE equipment_catalog ADD COLUMN type_key VARCHAR(40) NULL");
  // The published (last approved) copy of each equipment; public pages read this, so edits wait for the HOD's approval.
  if (!(await columnExists("equipment", "pub_data"))) await pool.query("ALTER TABLE equipment ADD COLUMN pub_data LONGTEXT NULL");
  await pool.query("UPDATE equipment SET pub_data = data WHERE status IN ('approved', 'verified') AND pub_data IS NULL AND data IS NOT NULL");
  for (const [col, def] of [["approved_at", "TIMESTAMP NULL"], ["approved_by", "INT UNSIGNED NULL"]]) if (!(await columnExists("labs", col))) await pool.query(`ALTER TABLE labs ADD COLUMN ${col} ${def}`);
  if (!(await indexExists("equipment", "idx_equipment_lab"))) await pool.query("ALTER TABLE equipment ADD KEY idx_equipment_lab (lab_id, status)");
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
  await upgradeEquipment();
  console.log("Schema applied.");

  // Colleges
  for (const [i, c] of COLLEGES.entries()) {
    await pool.query(
      "INSERT INTO colleges (code, name, city, address, is_central, sort_order) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name = VALUES(name), city = VALUES(city), address = COALESCE(VALUES(address), address), is_central = VALUES(is_central), sort_order = VALUES(sort_order)",
      [c.code, c.name, c.city, c.address || null, c.central ? 1 : 0, i]
    );
  }
  const [rows] = await pool.query("SELECT id, code, name FROM colleges");
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
  console.log(`Colleges ready: ${rows.length}`);

  // Nobody is forced to change the default password any more (they can do it any time from "Change password").
  await pool.query("UPDATE users SET must_change_password = 0 WHERE must_change_password = 1");
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

  // One administrator login per college (full rights inside that college only). Created once; an existing one is never overwritten.
  for (const c of COLLEGES.filter((x) => !x.central)) {
    const e = collegeAdminEmail(c);
    if (!(await has("SELECT 1 FROM users WHERE college_id = ? AND email = ?", [byCode[c.code].id, e]))) {
      await pool.query("INSERT INTO users (college_id, name, email, password_hash, role, must_change_password) VALUES (?,?,?,?, 'college_admin', 0)", [byCode[c.code].id, `${c.code} Administrator`, e, hashPassword(defaultPassword())]);
      console.log(`College administrator created: ${e} (${c.code})`);
    }
  }

  // One default principal account per college, using the official principal email. Existing principals get their email corrected.
  let made = 0, fixed = 0;
  for (const c of COLLEGES.filter((x) => !x.central)) {
    const cid = byCode[c.code].id;
    const [[p]] = await pool.query("SELECT id, email FROM users WHERE college_id = ? AND role = 'principal' LIMIT 1", [cid]);
    if (!p) {
      await pool.query("INSERT INTO users (college_id, name, email, password_hash, role, must_change_password) VALUES (?,?,?,?, 'principal', 0)", [cid, `Principal, ${c.code}`, c.principal, hashPassword(defaultPassword())]);
      made++;
    } else if (p.email !== c.principal && !(await has("SELECT 1 FROM users WHERE college_id = ? AND email = ? AND id <> ?", [cid, c.principal, p.id]))) {
      await pool.query("UPDATE users SET email = ? WHERE id = ?", [c.principal, p.id]);
      fixed++;
    }
  }
  const [mv] = await pool.query("UPDATE equipment SET status = 'approved', approved_by = verified_by, approved_at = verified_at WHERE status = 'verified'");
  if (mv.affectedRows) console.log(`Records that were awaiting Principal approval are now published: ${mv.affectedRows}`);
  console.log(`Principal accounts: ${made} created, ${fixed} email(s) corrected.`);

  // Every lab coordinator owns a lab record (created when the HOD adds the coordinator; backfilled here for older accounts).
  const [orphans] = await pool.query("SELECT id, college_id, department, lab_name FROM users WHERE role = 'lab_incharge' AND lab_id IS NULL AND lab_name IS NOT NULL");
  for (const u of orphans) {
    await pool.query("INSERT IGNORE INTO labs (college_id, department, name, incharge_user_id) VALUES (?,?,?,?)", [u.college_id, u.department, u.lab_name, u.id]);
    const [[lab]] = await pool.query("SELECT id FROM labs WHERE college_id = ? AND department = ? AND name = ?", [u.college_id, u.department, u.lab_name]);
    await pool.query("UPDATE users SET lab_id = ? WHERE id = ?", [lab.id, u.id]);
  }
  if (orphans.length) console.log(`Lab records created for ${orphans.length} existing coordinator(s).`);
  await pool.end();
})().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
