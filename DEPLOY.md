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
4. In a terminal as the account user (not root), activate the Node environment shown on the app page, `cd ~/svesconnect`, then run:
   `npm install --include=dev --ignore-scripts && npm run build && npm run migrate`
   (`--ignore-scripts` avoids the `sharp` binary download, which can time out on servers; the AI assistant then loads its libraries on first use and the rest of the site is unaffected.)
5. Restart the app and open https://svesconnect.in (enable AutoSSL in cPanel for HTTPS).

## Notes
- The AI assistant downloads a small embedding model on first use and needs about 1 GB of RAM; CloudLinux limits may need raising in WHM (LVE Manager).
- Uploaded files for later modules will live outside `public_html` under `~/svesconnect/storage`.

## Updating an existing deployment
After `git pull`, always run `npm install --include=dev --ignore-scripts && npm run build && npm run migrate`, then Restart the app. `migrate` is safe to repeat: it upgrades tables, seeds colleges and creates any missing principal accounts.

## Uploaded equipment documents
Files are stored on disk in `storage/` inside the app folder (or `STORAGE_DIR`), never in `public_html`. Back this folder up with the database. Uploads are sent as JSON (up to 8 MB per file); if uploads fail on the server, check ModSecurity / PHP-style body-size limits in WHM and the free disk space.

## Search and the AI assistant on the server
The semantic (embedding) search needs the optional `sharp` native binary, which often cannot be downloaded on shared/VPS hosts. That is fine: search automatically falls back to keyword ranking and `/api/health` reports `searchMode`. Add `GROK_API_KEY` later to get written answers from the assistant; until then it lists the closest records with links.

## Bringing the old BAJA data into Events
The old BAJA prototype kept everything in the browser it was used in, so the data has to be exported from there once:
1. Open the old prototype in the SAME browser (and address) where the BAJA files were uploaded: on that computer run `cd svecw-main && npm start`, open http://localhost:3000, sign in as an admin and press **Export backup**. It downloads `sves-baja-backup-<date>.json` (files included).
2. Copy that JSON to the server (cPanel File Manager, e.g. into `/home/svesconnect/`).
3. In the Node terminal (same steps as an update): `npm run import:baja -- /home/svesconnect/sves-baja-backup-<date>.json` (add `--publish` to make the events public at once).
Every college > year > folder becomes an event, every file lands in its category folder with a summary. It is safe to run twice (nothing is duplicated). Files over the browser's limits or of blocked types are listed and skipped.

## Loading the Vishnu Motorsports (BAJA, REEV ...) records
The records in `reference/connectfiles` (2.6 GB: SVECW/VWU, VIT, BVRIT, BVRITH; 2022-2026) are far too big for git, so the data and the files travel separately.
- **In git (already prepared):** `data/motorsport/manifest.json` = 21 events and one metadata record per file (title, folder, sub-folder = vehicle subsystem, tags, credit, date, summary, public/team-only). `data/motorsport/files-from.txt` (all files) and `files-public-from.txt` (public ones only) are the lists to copy. Regenerate after changing the rules with `npm run prepare:motorsport -- "reference/connectfiles"`.
- **Rules used:** PDF, Word, PowerPoint and photos are PUBLIC (143 files, 0.15 GB); CAD/3D files (SolidWorks, STL, IGES, CATIA ...) and spreadsheets are TEAM-ONLY; accounts, indents, payment proofs and bills are never imported. Events with at least one public file are published.
1. Copy the files (run on YOUR computer, in the project folder; use the server's SSH address). Public files only is quick: 
   `rsync -av --files-from=data/motorsport/files-public-from.txt reference/connectfiles/ root@103.185.75.85:/home/svesconnect/motorsport/`
   Everything incl. CAD (2.6 GB): use `files-from.txt` instead. Then on the server (WHM terminal, as root): `chown -R svesconnect:svesconnect /home/svesconnect/motorsport`.
2. On the server as the app user (same shell as for updates): `git pull`, `npm run migrate`, then
   `npm run import:motorsport -- --from /home/svesconnect/motorsport` (add `--only-public` if you copied only the public list). Safe to repeat.
3. Restart the app. Check https://svesconnect.in/events. After checking, `/home/svesconnect/motorsport` can be deleted (the files now live in the app's `storage/` folder).

## Updating the live site in two clicks (no terminal)
1. Push/merge your changes to `main` on GitHub.
2. cPanel > **Git Version Control** > *Manage* on the repository > **Pull or Deploy** tab > **Update from Remote**, then **Deploy HEAD Commit**.
That runs `.cpanel.yml` > `scripts/deploy.sh`, which does `npm ci`, `npm run build`, `npm run migrate` and restarts the app. The log is in `deploy.log` in the app folder. cPanel refuses to deploy if the server copy has uncommitted changes, so never edit files on the server.
By hand (terminal) the same thing is: `git pull origin main && npm run deploy`.
Make sure the repository in cPanel is on the `main` branch (the Basic Info tab shows "Checked-Out Branch").
