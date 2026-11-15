// Password hashing (scrypt) and signed tokens (HS256 JWT) using only Node's built-in crypto: no extra packages to install on the host.
const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function secret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set in .env");
  return process.env.JWT_SECRET;
}

function signToken(payload, ttlSeconds = 60 * 60 * 12) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
  const sig = crypto.createHmac("sha256", secret()).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

function verifyToken(token) {
  const [head, body, sig] = String(token).split(".");
  if (!head || !body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(`${head}.${body}`).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  return payload.exp > Date.now() / 1000 ? payload : null;
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
