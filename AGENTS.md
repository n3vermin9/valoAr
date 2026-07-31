# AGENTS.md

## Cursor Cloud specific instructions

### What this is
`valoAr` is a single mobile-first **React 19 + Vite** SPA (package name `valoar`). There is **no backend in this repo** — all auth, data, realtime, and file storage go through a **hosted Firebase project** (Auth, Firestore, Realtime Database, Storage). There is no monorepo, no local API server, and no Firebase Emulator wiring in the code.

### Standard commands (see `package.json`)
- Dev server: `npm run dev` → Vite on `http://localhost:5173`.
- Build: `npm run build`.
- Lint: `npm run lint`.
- No automated tests are configured (`package.json` has no `test` script; no test files exist).

### Firebase credentials are required to run the app meaningfully (non-obvious)
- Firebase config is read from `VITE_FIREBASE_*` variables in `src/firebase/config.js`. Vite exposes any **`VITE_`-prefixed environment variable** (highest priority) as well as values from a local `.env` file, so credentials can be provided **either** as Cloud Agent secrets named `VITE_FIREBASE_*` **or** via a `.env` file (see `.env.example`). `.env` is gitignored.
- Required vars: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_URL`.
- Gotcha: `src/firebase/config.js` calls `getDatabase()`, which throws on import if `VITE_FIREBASE_DATABASE_URL` is missing/blank — that produces a blank white screen. Provide at least a URL-shaped value so the app can boot.
- With placeholder/invalid credentials the app still boots and renders `/login` and `/register`, but any auth/data call fails against real Google endpoints (e.g. `identitytoolkit.googleapis.com` returns `auth/api-key-not-valid`). To sign up / log in / chat you need a **real** Firebase project.
- After changing env vars or `.env`, restart `npm run dev` (Vite does not hot-reload env changes).

### Firebase project setup (only when using a real project; not needed just to boot the SPA)
- Rules/indexes live in `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `database.rules.json`, `storage.rules`. Deploy with `firebase deploy --only firestore:rules,firestore:indexes,database,storage` — this needs the `firebase-tools` CLI (NOT an npm dependency here) plus `firebase login` and a linked project (no `.firebaserc` in repo). Firestore composite indexes are required for several queries.

### Dev-only shortcuts (from README)
- Tap the logo on Login/Register to generate a random dev account.
- Double-tap the Chats tab or visit `/debug` for seed/reset tools (only when running in Vite dev mode).
