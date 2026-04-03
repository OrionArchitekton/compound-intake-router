# Compound Intake Router

A webhook-driven pipeline that classifies, enriches, routes, and logs inbound messages across a venture studio.

Built as an application project for [Compound Ventures](https://compoundventures.ai) — AI Systems Builder, Founding Team.

## What It Does

Send any inbound message to a single webhook. The system:

1. **Normalizes** the payload into a consistent format
2. **Classifies** it with Claude (lead, partnership, support, applicant, spam)
3. **Assigns** it to the right venture (real estate, finance, hospitality, general)
4. **Determines** urgency (high, medium, low)
5. **Enriches** the sender with basic domain info
6. **Recommends** a next action
7. **Routes** a formatted alert to the correct Slack channel (or console)
8. **Logs** an audit trail to SQLite

If any stage fails, the pipeline continues with degraded output. It never crashes.

## Quick Start

```bash
git clone <repo-url> && cd compound-intake-router
npm install
cp .env.example .env    # add your ANTHROPIC_API_KEY
npm start               # starts on :3747
bash examples/send-all.sh   # send 5 test messages
```

## Example Output

```
!!! [LEAD] HIGH — real-estate
   From: Marcus Rivera <marcus@sunbeltcapital.com>
   Company: Sunbelt Capital
   Subject: AI tools for multifamily deal analysis?
   Reasoning: Sender runs a real estate fund seeking AI underwriting tools.
   Action: Schedule discovery call within 24 hours
   Route: #re-inbound
```

## Architecture

```
POST /intake
  → Normalizer (validate, extract fields, generate ID)
  → Classifier (Claude API → type, venture, urgency, action)
  → Enricher (domain check, page title)
  → Router (config-driven rules → Slack or console)
  → Logger (SQLite audit trail)
  → Response (structured JSON with pipeline status)
```

Each stage is independently fallible. The pipeline wraps every stage in error handling and continues with degraded output if any stage fails.

## Configuration

**Routing rules** — `config/routing.json`: Maps classification type + venture to Slack channel. Change routing without touching code.

**Ventures** — `config/ventures.json`: Venture definitions fed to the classifier. Add a venture by adding an entry.

**Delivery mode** — `.env`: Set `DELIVERY_MODE=console` or `DELIVERY_MODE=slack` with a `SLACK_WEBHOOK_URL`.

## Design Decisions

- **AI classifies. Rules route.** The LLM handles ambiguous judgment (what type is this? how urgent?). Routing is a deterministic config lookup. This makes routing predictable and debuggable even when classification is imperfect.

- **Every stage degrades gracefully.** If the classifier fails, the message routes to `#intake-review` with `type: unknown`. If Slack fails, it falls back to console. If SQLite fails, it dumps to stderr. No silent drops.

- **Config over code.** Routing rules, venture definitions, and delivery mode are all configuration. The system adapts to new ventures or new routing without code changes.

- **One LLM call per message.** Classification runs in a single Claude call (~2s, ~$0.002). No chains, no agents, no unnecessary complexity.

## API

### POST /intake

Send a JSON payload:
```json
{
  "sender": { "name": "...", "email": "..." },
  "subject": "...",
  "body": "...",
  "source": "email"
}
```

Minimum required: `sender.email` and `body`.

Returns structured result with classification, enrichment, routing, and pipeline status.

### GET /health

Returns uptime and delivery mode.

## Audit Log

All intakes are persisted to SQLite at `data/intakes.db`.

```bash
npm run view-log    # pretty-print recent records
```

## Stack

Node.js, Express, Anthropic SDK, better-sqlite3, dotenv. No frameworks, no UI, no auth.
