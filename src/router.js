import { readFileSync } from 'node:fs';

const routing = JSON.parse(readFileSync(new URL('../config/routing.json', import.meta.url), 'utf-8'));

export function resolveDestination(classification) {
  const { type, venture } = classification;
  const typeRoutes = routing.routes[type];

  if (!typeRoutes) return routing.fallbackChannel;
  if (typeRoutes.action === 'log-only') return null; // spam
  return typeRoutes[venture] || typeRoutes.default || routing.fallbackChannel;
}

function formatConsole(normalized, classification, enrichment, destination) {
  const prefix = routing.urgencyPrefix[classification.urgency] || '--';
  const lines = [
    '',
    `${prefix} [${classification.type.toUpperCase()}] ${classification.urgency.toUpperCase()} — ${classification.venture}`,
    `   From: ${normalized.sender.name} <${normalized.sender.email}>`,
    enrichment.pageTitle ? `   Company: ${enrichment.pageTitle}` : null,
    normalized.subject ? `   Subject: ${normalized.subject}` : null,
    `   Reasoning: ${classification.reasoning}`,
    `   Action: ${classification.suggestedAction}`,
    destination ? `   Route: ${destination}` : `   Route: (log-only, filtered)`,
    '',
  ];
  return lines.filter(Boolean).join('\n');
}

function formatSlackBlocks(normalized, classification, enrichment, destination) {
  const prefix = routing.urgencyPrefix[classification.urgency] || '--';
  return {
    text: `${prefix} New ${classification.type}: ${normalized.subject || '(no subject)'}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${prefix} ${classification.type.toUpperCase()} — ${classification.urgency}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*From:*\n${normalized.sender.name} <${normalized.sender.email}>` },
          { type: 'mrkdwn', text: `*Venture:*\n${classification.venture}` },
          { type: 'mrkdwn', text: `*Confidence:*\n${Math.round(classification.typeConfidence * 100)}%` },
          enrichment.pageTitle
            ? { type: 'mrkdwn', text: `*Company:*\n${enrichment.pageTitle}` }
            : { type: 'mrkdwn', text: `*Domain:*\n${enrichment.domain || 'n/a'}` },
        ],
      },
      normalized.subject ? {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Subject:* ${normalized.subject}` },
      } : null,
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Reasoning:* ${classification.reasoning}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Suggested Action:* ${classification.suggestedAction}` },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Routed to \`${destination}\` | Spam score: ${classification.spamScore}` },
        ],
      },
    ].filter(Boolean),
  };
}

export async function route(normalized, classification, enrichment) {
  const destination = resolveDestination(classification);
  const deliveryMode = process.env.DELIVERY_MODE || 'console';

  // Spam: log only, no delivery
  if (destination === null) {
    return { destination: '(log-only)', delivered: true, mode: 'filtered' };
  }

  if (deliveryMode === 'slack' && process.env.SLACK_WEBHOOK_URL) {
    try {
      const payload = formatSlackBlocks(normalized, classification, enrichment, destination);
      const res = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Slack returned ${res.status}`);
      return { destination, delivered: true, mode: 'slack' };
    } catch (err) {
      console.error(`[router] Slack delivery failed: ${err.message}`);
      // Fall through to console
    }
  }

  // Console delivery (default or Slack fallback)
  const output = formatConsole(normalized, classification, enrichment, destination);
  console.log(output);
  return { destination, delivered: true, mode: 'console' };
}
