const mysql = require("mysql2/promise");

// Credentials come from .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "svesconnect",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

module.exports = pool;
