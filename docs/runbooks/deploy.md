---
verified: 2026-10-28
review_after: 2026-11-28
topics: [deployment, delivery, backup, rollback]
references: [Dockerfile, docker-compose.yml, .env.example, src/server.js, src/logger.js, config/service-business.json]
---

# Deploy and operate the intake router

The app is intended for a single business. This guide prepares a deployment; no hosted service or paid API call is made by the PR.

## Local Docker rollout

Copy `.env.example` to `.env`. Supply your Anthropic key locally and set a private `INTAKE_TOKEN`; do not commit it. Keep console delivery selected during setup. Sender website fetching is not included; remove a legacy `ENABLE_ENRICHMENT=true` setting because it now refuses startup. Docker binds internally on all interfaces, while Compose publishes only loopback. Compose refuses a missing/empty inbound token.

```sh
docker compose up --build -d
docker compose logs --tail 30
```

`GET http://127.0.0.1:3747/health` must include `status: "ok"`, uptime and delivery mode. An unauthenticated `POST /intake` must return 401. Configure your client to supply `Authorization: Bearer <your token>`; avoid putting real secrets in shell history or recorded demos. Send only a fictional lead for the first provider-backed test and explicitly approve the provider cost first. `npm run demo` is a separate offline check and never uses the server's credentials or alert settings.

The `intake-data` named volume stores `/app/data/intakes.db` and its WAL/SHM files. The image runs as the unprivileged `node` user. A host bind mount must be writable by UID/GID 1000. Do not mount the same SQLite store into multiple active writers across machines. Do not use volume-deleting Compose commands on real records.

## Hosted option: Render native Node service

Follow [Render's Express guide](https://render.com/docs/deploy-node-express-app). Create a service from your approved repository/branch. Use Node.js 22, build command `npm ci`, start command `npm start`, health path `/health`, and manual deploys during review.

Set `HOST=0.0.0.0`, a private `INTAKE_TOKEN`, the buyer's `ANTHROPIC_API_KEY`, `INTAKE_CONFIG=config/service-business.json`, the selected delivery settings. The server refuses a non-local bind without the token. Configure provider budgets and gateway rate limits; a token alone does not cap cost. Hosting/API/email charges are separate and require the buyer's approval.

Attach a paid [persistent disk](https://render.com/docs/disks) at `/var/data` and set `INTAKE_DB_PATH=/var/data/intakes.db`. Without a disk, audit records are lost on redeploy. Use one instance; disk-backed services have deployment downtime. Verify that the service can create a test audit row on the mounted path before accepting customer data. Do not claim a live hosted deployment from this source-only validation.

## Configuration and delivery validation

Select a profile, retaining `unknown` and `general` fallbacks. Restart after changes. The legacy studio profile is `config/venture-studio.json`; the combined profile now controls the app, not the old separate files.

Choose one adapter using `.env.example`. Slack incoming webhooks choose their actual channel; route labels are metadata, not channel overrides. Email uses [Resend's send-email API](https://resend.com/docs/api-reference/emails/send-email), a verified sender and configured recipients. Verify recipient receipt separately after an explicitly authorized synthetic send. A generic webhook gets JSON with intake ID, destination label, sender, subject, classification, enrichment and plain-text summary. Remote targets require HTTPS; only loopback HTTP is allowed for local receiver tests. No redirects or automatic retry.

Check the HTTP response and matching SQLite row: classification/group and destination must match, `pipeline.log` must be `ok`, and `routing.delivered` must reflect receiver acceptance. Spam is `filtered` without delivery. `pipeline.classify=degraded` means manual review. `pipeline.route=failed` or `pipeline.log=failed` requires investigation even when HTTP status is 200. Never infer recipient acknowledgement from a 2xx provider response.

## Monitoring and privacy

Watch health, failed/degraded stage counts, disk capacity and provider spend. Use `npm run view-log` privately; audit rows contain raw lead data. Console alerts also contain customer details. Do not publish DB exports or unrestricted logs. Keep inbound tokens and provider credentials in the hosting secret settings, not URLs, commits or screenshots.

The pipeline never fetches sender-controlled websites. The old fetching helper is removed, and enrichment fields remain skipped for response compatibility. Use TLS and body/rate limits at the edge. Set `INTAKE_TOKEN` before exposing any reverse proxy, tunnel or port forward, including a proxy to a loopback listener; loopback binding alone does not authenticate callers. There is no durable queue, replay/idempotency protection, quota or multi-tenant isolation. A timed-out send may already have reached the provider: inspect immutable evidence before any manual retry. Never replay the entire intake automatically, because that may duplicate both alerts and rows.

## Backup and rollback

Pause intake, stop the process, and copy the database plus any WAL/SHM files as one consistent stopped set; alternatively use SQLite's supported online backup API. Verify a restored copy separately. Do not copy only an active SQLite main file and call it a valid backup.

Stop Docker with `docker compose down`, preserving its named volume. For source rollback, redeploy the previously approved commit with its matching profile/environment and retained disk. Existing schema columns are unchanged. Back up the newer DB before replacing it with a stopped backup. Preserve evidence of uncertain sends; do not resubmit them as part of rollback.
