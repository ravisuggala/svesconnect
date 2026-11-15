# SVES Connect

One app combining:
- **Document Portal** (`/documents`): login, role-based upload/search/preview of college event files (photos, designs, reports). Ported from `svecw-main`; data is stored in the browser (IndexedDB).
- **AI Chatbot** (`/chatbot`): RAG chatbot over MongoDB `Equipment` data (local MiniLM embeddings + Groq LLM). Ported from `bvritn-main`.

## Stack
React 19 + Vite 7 + React Router (frontend, `src/`) · Express 5 (backend, `server/`) · Mongoose 9 · MongoDB.

## Setup
    npm install
    cp .env.example .env        # set MONGO_URI and GROK_API_KEY (a Groq key)
    npm run seed                # optional: sample equipment data

## Run
    npm run dev                 # API :5000 + Vite :5173 (proxies /api)
    npm run build && npm start  # production: Express serves dist/ on PORT

## Layout
    src/App.jsx              nav + routes
    src/pages/Documents.jsx  document portal
    src/pages/Chatbot.jsx    chatbot UI
    server/server.js         API, embeddings, Groq call, static serving
    server/models/Equipment.js   the only DB schema
    server/seed.js           sample data
