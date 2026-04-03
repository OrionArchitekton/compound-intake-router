import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { truncate } from './utils.js';

const ventures = JSON.parse(readFileSync(new URL('../config/ventures.json', import.meta.url), 'utf-8'));

const CLASSIFY_PROMPT = `You are an intake classifier for a venture studio that operates these ventures:

${ventures.map(v => `- ${v.id}: ${v.description}`).join('\n')}

Classify the following inbound message. Respond with JSON only, no markdown fences.

{
  "type": "lead" | "partnership" | "support" | "applicant" | "spam" | "unknown",
  "typeConfidence": 0.0 to 1.0,
  "urgency": "high" | "medium" | "low",
  "venture": "${ventures.map(v => v.id).join('" | "')}",
  "ventureConfidence": 0.0 to 1.0,
  "reasoning": "one sentence explaining the classification",
  "suggestedAction": "specific recommended next step",
  "spamScore": 0.0 to 1.0
}`;

const FALLBACK = {
  type: 'unknown',
  typeConfidence: 0,
  urgency: 'medium',
  venture: 'general',
  ventureConfidence: 0,
  reasoning: 'Classifier unavailable',
  suggestedAction: 'Review manually',
  spamScore: 0,
};

let client = null;

function getClient() {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export async function classify(normalized) {
  const { sender, subject, body } = normalized;

  const message = [
    `FROM: ${sender.name} <${sender.email}> (${sender.company || 'unknown'})`,
    subject ? `SUBJECT: ${subject}` : null,
    `BODY:\n${truncate(body, 3000)}`,
  ].filter(Boolean).join('\n');

  try {
    const response = await getClient().messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        { role: 'user', content: `${CLASSIFY_PROMPT}\n\n---\n\n${message}` },
      ],
    });

    const text = response.content[0].text.trim();
    const parsed = JSON.parse(text);

    // Validate required fields, fill gaps
    return {
      type: parsed.type || 'unknown',
      typeConfidence: parsed.typeConfidence ?? 0.5,
      urgency: parsed.urgency || 'medium',
      venture: parsed.venture || 'general',
      ventureConfidence: parsed.ventureConfidence ?? 0.5,
      reasoning: parsed.reasoning || 'No reasoning provided',
      suggestedAction: parsed.suggestedAction || 'Review manually',
      spamScore: parsed.spamScore ?? 0,
    };
  } catch (err) {
    console.error(`[classifier] failed: ${err.message}`);
    throw err;
  }
}
