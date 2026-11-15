// Usage: npm run package  -> release/svesconnect-release.zip (upload via cPanel File Manager, then run NPM install there)
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
execSync("npm run build", { cwd: root, stdio: "inherit" });
const out = path.join(root, "release", "svesconnect-release.zip");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
// node_modules and .env are deliberately excluded: install dependencies on the server and create .env there.
execSync(`zip -rq "${out}" dist server package.json package-lock.json .env.example DEPLOY.md -x "*.DS_Store"`, { cwd: root, stdio: "inherit" });
console.log("Created", out);
