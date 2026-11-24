# Deploying dear, me.

The frontend goes on **Vercel**. The backend (Express + SQLite + uploads + WebSockets) goes on **Railway**,
because Vercel can't keep a database file or hold WebSocket connections.

## 1. Backend on Railway
1. Push this project to GitHub.
2. railway.app → New Project → Deploy from GitHub repo → pick it.
3. Service → Settings:
   - Build command: `npm install`
   - Start command: `npm start`
4. Service → add a **Volume**, mount path `/data`.
5. Service → Variables:
   - `DATA_DIR` = `/data`
   - `GEMINI_API_KEY` = your key
   - `CORS_ORIGIN` = your Vercel URL, e.g. `https://dear-me.vercel.app`
6. Settings → Networking → **Generate Domain**. Copy it (e.g. `https://dear-me-production.up.railway.app`).
7. Check `https://<that-domain>/healthz` shows `{"ok":true}`.

## 2. Frontend on Vercel
1. In `vercel.json`, replace `YOUR-BACKEND-URL` with the Railway domain (no `https://` twice, no trailing slash).
2. Vercel → Project → Settings → Environment Variables:
   - `VITE_API_URL` = `https://<railway-domain>`
3. Framework preset: **Vite**. Build `npm run build`, output `dist`.
4. Redeploy (env vars only apply to new builds).
