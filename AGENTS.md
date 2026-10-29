# AGENTS.md

## Cursor Cloud specific instructions

This is a single-service Node.js (ES Modules) Express application with optional Docker packaging, embedded SQLite and no JavaScript build step.

### Services

| Service | Port | Start command |
|---|---|---|
| Intake Router (Express) | 3747 | `npm start` |

### Key commands

- **Install deps:** `npm install`
- **Start server:** `npm start` (runs `node src/server.js` on port 3747)
- **Health check:** `curl http://localhost:3747/health`
- **Offline demo:** `npm run demo` (fixed model fixture; no real sends or API calls)
- **Live driver:** `npm run demo:live` (5 requests; requires explicit provider/send authority)
- **Tests:** `npm test` (built-in Node runner)
- **View audit log:** `npm run view-log`

### Environment

- Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` to a valid key (injected as env var in Cloud Agent VMs).
- `DELIVERY_MODE=console` is the default and works without any external services.
- SQLite DB is embedded via `better-sqlite3` — auto-created at `data/intakes.db` on first start.

### Gotchas

- `package-lock.json` is tracked; use `npm ci` for reproducible installs.
- No ESLint or Prettier configuration; tests use the built-in Node runner.
- `.env` is optional; dotenv loads it when present. Non-local binding requires `INTAKE_TOKEN`.
- `better-sqlite3` compiles native bindings during `npm install`; ensure a C++ toolchain is available (`build-essential` on Ubuntu).
