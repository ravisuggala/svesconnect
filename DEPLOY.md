# Deploying SVES Connect to cPanel / WHM (svesconnect.in)

Do this in stages: deploy the shell first, add modules later by uploading a new release.

## 1. Build a release (on your computer)
    npm install
    npm run package        # creates release/svesconnect-release.zip

Or pull from GitHub with cPanel "Git Version Control" and run `npm run build` on the server.

## 2. Database (cPanel > MySQL Databases)
Create a database and a user, add the user to the database with ALL PRIVILEGES. cPanel prefixes names, e.g. `cpuser_svesconnect`.

## 3. Upload and configure
1. File Manager: create `~/svesconnect` (outside `public_html`) and extract the zip there.
2. cPanel > **Setup Node.js App** > Create application:
   - Node.js version 20 or newer, mode **Production**
   - Application root `svesconnect`, application URL `svesconnect.in`
   - Startup file `server/server.js`
3. Add environment variables (same names as `.env.example`): `DB_HOST=localhost`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GROK_API_KEY`, `GROQ_MODEL`, `NODE_ENV=production`.
4. Click **Run NPM Install**, then run `npm run migrate` from the app's terminal (or "Run JS script" > migrate).
5. Restart the app and open https://svesconnect.in (enable AutoSSL in cPanel for HTTPS).

## Notes
- The AI assistant downloads a small embedding model on first use and needs about 1 GB of RAM; CloudLinux limits may need raising in WHM (LVE Manager).
- Uploaded files for later modules will live outside `public_html` under `~/svesconnect/storage`.
