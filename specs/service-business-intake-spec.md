# Service business intake

## Scenarios and acceptance

1. A service business owner selects a JSON profile defining message types, business groups and deterministic destinations. Claude receives those definitions; only configured values can route. Invalid model output goes to manual review. The existing `venture` response field remains compatible and means business group; confidence values retain their existing SQLite audit fields. A legacy studio profile remains available.
2. The owner selects console, Slack, email (Resend) or generic JSON webhook delivery. Slack is optional. A remote destination is configured by the owner, never by a lead or model output. A 2xx receiver response proves acceptance only. Non-2xx, timeout, missing settings or unknown delivery modes cannot be reported as successful delivery. Spam remains log-only.
3. A caller submits a lead through the HTTP API and receives its classification, route and stage status, with the same result persisted in SQLite. Invalid input returns 400; unexpected faults return a generic 500 without input, endpoint URLs or credentials in logs. An optional inbound bearer token protects `/intake`; loopback is the default bind. The supplied hosted path requires the token.
4. An owner can run a synthetic offline demo without an API key, paid API requests, enrichment fetches or real alert delivery. The demo is a separate script; the live endpoint has no unauthenticated demo bypass.

The application stores inbound content in SQLite; it is not a no-storage service. There is no queue, automatic retry, replay protection, CRM, inbox synchronization or multi-tenant boundary. Sender websites are never fetched. Website enrichment fields remain skipped for compatibility, and the legacy opt-in startup setting is rejected.

## Test seams

Use Node's built-in test runner at the HTTP API seam with injected model responses and a temporary SQLite path. Use local HTTP receivers for webhook transport proof and intercepted requests for fixed external email/Slack APIs. No production credentials or actual sends.
