# AGENTS.md

## Cursor Cloud specific instructions

This is a single-service Node.js (ES Modules) Express application — no Docker, no external databases, no build step.

### Services

| Service | Port | Start command |
|---|---|---|
| Intake Router (Express) | 3747 | `npm start` |

### Key commands

- **Install deps:** `npm install`
- **Start server:** `npm start` (runs `node src/server.js` on port 3747)
- **Health check:** `curl http://localhost:3747/health`
- **Demo (5 payloads):** `bash examples/send-all.sh`
- **View audit log:** `npm run view-log`

### Environment

- Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` to a valid key (injected as env var in Cloud Agent VMs).
- `DELIVERY_MODE=console` is the default and works without any external services.
- SQLite DB is embedded via `better-sqlite3` — auto-created at `data/intakes.db` on first start.

### Gotchas

- There is no lockfile in the repo; `npm install` generates `package-lock.json` locally.
- No ESLint, Prettier, or test framework is configured in this project.
- The `.env` file must exist before `npm start` — dotenv loads on import.
- `better-sqlite3` compiles native bindings during `npm install`; ensure a C++ toolchain is available (`build-essential` on Ubuntu).
