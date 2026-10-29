# Swap Meet listing draft

Status: proposal for Dan and Lucas; not submitted.

- **Title:** Small-business lead triage, set up for you
- **One-liner:** Sort inbound enquiries with Claude, apply your routing rules and send an optional Slack, email or webhook alert.
- **Suggested price text:** TODO: Dan to decide. Proposal: **$499 USD one-time setup**, provider/hosting usage extra.
- **Checkout link:** TODO: Dan to supply an approved public HTTPS Stripe Payment Link, Gumroad or Lemon Squeezy checkout. No link created.
- **Apps replaced (narrow workflow):** Zapier, Make, HubSpot-style lead routing.
- **Problem solved:** Get a new enquiry to a human with a suggested next action and audit trail.
- **Features left out:** CRM, inbox/form connectors, workflow builder, campaigns, queue, automatic retry, replay protection, round-robin assignment, multi-user permissions and billing. Route names are labels; one physical alert destination per selected adapter.
- **Setup scope:** One profile, deployment, buyer-connected inbound source and alert destination; synthetic acceptance test and 60-minute handoff. No unlimited integration work or ongoing support.
- **Requirements:** Node.js 22+ or Docker; buyer's Anthropic account; optional Resend/Slack/receiver; persistent storage/backups. Provider usage and hosting paid separately.
- **Privacy:** Raw inputs persist in SQLite. Model/selected alert providers receive content; enrichment defaults off.
- **Screenshot:** [Actual offline output](docs/images/offline-demo.png). `npm run demo` uses a fictional model fixture, not live AI.
- **License:** Existing MIT retained.

If submitted as a Template instead of a setup service, price text must be **Ask**, with the same problem and omissions. Before listing: Dan approves terms, supplies checkout; Lucas reviews. $0 eligibility is unresolved and not assumed.
