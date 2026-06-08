# Compound Intake Router

A webhook-driven pipeline that classifies, enriches, routes, and logs inbound messages across a venture studio.

Built as an application project for [Compound Ventures](https://compoundventures.ai) — AI Systems Builder, Founding Team.

## What It Does

Send any inbound message to a single webhook. The system:

1. **Normalizes** the payload into a consistent format and assigns it an `int_<hex>` id
2. **Classifies** it with Claude (lead, partnership, support, applicant, spam, or unknown)
3. **Assigns** it to the right venture (real estate, finance, hospitality, general)
4. **Determines** urgency (high, medium, low)
5. **Enriches** the sender by fetching their domain to detect a website and read its page title
6. **Recommends** a next action
7. **Routes** a formatted alert to the correct Slack channel (or the console); spam is logged only
8. **Logs** a full audit row to SQLite

Steps 2 and 3 (type, urgency, venture, action) come from one Claude call. If any stage after normalization fails, the pipeline continues with degraded output instead of crashing.

## Quick Start

```bash
git clone <repo-url> && cd compound-intake-router
npm install
cp .env.example .env    # add your ANTHROPIC_API_KEY
npm start               # starts on :3747 (override with PORT)
npm run demo            # send 5 sample payloads (alias for: bash examples/send-all.sh)
```

Requires Node.js 21+ for stable built-in fetch without experimental warnings (developed and tested on Node 24; Node 18+ is supported but may emit experimental warnings).

## Example Output

Console delivery for the `lead.json` sample. The `Company` line is the page title fetched from the sender's domain during enrichment, not the sender's stated company — so its exact value depends on what `sunbeltcapital.com` returns at request time.

```
!!! [LEAD] HIGH — real-estate
   From: Marcus Rivera <marcus@sunbeltcapital.com>
   Company: <fetched page title of sunbeltcapital.com>
   Subject: AI tools for multifamily deal analysis?
   Reasoning: Sender runs a real estate fund seeking AI underwriting tools.
   Action: Schedule discovery call within 24 hours
   Route: #re-inbound
```

In Slack mode the same alert is delivered as Block Kit blocks (header, fields, reasoning, suggested action, and a context line with the route and spam score).

## Architecture

```
POST /intake
  → Normalizer (validate, extract fields, generate int_<hex> id)
  → Classifier (one Claude call → type, venture, urgency, action, confidence, spam score)
  → Enricher (HTTP GET the sender domain → website check + page title)
  → Router (config-driven rules → Slack Block Kit or console; spam = log-only)
  → Logger (SQLite audit row)
  → Response (structured JSON with per-stage pipeline status)
```

Each stage after normalization is wrapped in error handling. If the classifier fails, the message is routed to `#intake-review` with `type: unknown`. If Slack delivery fails, it falls back to console. If the SQLite write fails, the record is dumped to stderr. No silent drops.

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required. Read implicitly by the Anthropic SDK for the classifier call. |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Classifier model. |
| `PORT` | `3747` | HTTP listen port. |
| `DELIVERY_MODE` | `console` | `console` or `slack`. |
| `SLACK_WEBHOOK_URL` | — | Required when `DELIVERY_MODE=slack`; otherwise delivery falls back to console. |

Config files:

- **Routing rules** — `config/routing.json`: maps classification type + venture to a Slack channel. Change routing without touching code.
- **Ventures** — `config/ventures.json`: venture definitions fed to the classifier. Add a venture by adding an entry.

## Design Decisions

- **AI classifies. Rules route.** The LLM handles ambiguous judgment (what type is this? how urgent?). Routing is a deterministic config lookup. This keeps routing predictable and debuggable even when classification is imperfect.

- **Every stage degrades gracefully.** A failed classifier routes to `#intake-review` as `unknown`; a failed Slack post falls back to console; a failed SQLite write dumps to stderr. No silent drops.

- **Config over code.** Routing rules, venture definitions, and delivery mode are all configuration. The system adapts to new ventures or routing without code changes.

- **One LLM call per message.** Classification runs in a single Claude call against the default `claude-sonnet-4-20250514` — no chains, no agents. Latency and cost depend on the model and message size (bodies are truncated to ~3,000 characters before sending).

## API

### POST /intake

Send a JSON payload:

```json
{
  "sender": { "name": "...", "email": "...", "company": "..." },
  "subject": "...",
  "body": "...",
  "source": "email"
}
```

Minimum required: `sender.email`, plus either `body` or `subject`. (The normalizer also accepts `email`/`from` and `body`/`message`/`text` aliases.)

On success, returns `200` with a structured result: `id`, `classification`, `enrichment`, `routing`, per-stage `pipeline` status, and `processingMs`.

On validation failure, returns `400` with:

```json
{ "status": "rejected", "errors": ["sender.email is required"], "processingMs": 1 }
```

### GET /health

Returns `status`, `uptime` (seconds), and the active `delivery` mode.

## Audit Log

Every intake is persisted to SQLite at `data/intakes.db` (WAL mode). The `intakes` table stores 21 columns, including the raw payload, raw classification, and per-stage pipeline status as JSON blobs alongside confidence and spam scores.

```bash
npm run view-log    # pretty-print the 20 most recent records
```

## Operational Notes

- **Enrichment makes a live outbound request.** For each accepted message, the enricher issues an HTTP GET to the sender domain with a 3-second timeout and a custom User-Agent. Since the target domain is derived from sender-supplied input, front this with appropriate egress controls and consider response size limits to prevent memory exhaustion (OOM) from large payloads.
- **`/intake` is unauthenticated by design.** There is no auth on `POST /intake` or `GET /health`. For any non-local deployment, put it behind a gateway, shared secret, or signature check.

## Stack

Node.js (ESM), Express 5, the Anthropic SDK (`@anthropic-ai/sdk`), and `better-sqlite3`, with `dotenv` for config. The demo driver is a Bash script using `curl`. No web frameworks beyond Express, no UI, no auth.

## License

[MIT](LICENSE)
