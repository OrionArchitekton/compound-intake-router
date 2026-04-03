import { normalize } from './normalizer.js';
import { classify } from './classifier.js';
import { enrich } from './enricher.js';
import { route } from './router.js';
import { logIntake } from './logger.js';
import { timer } from './utils.js';

async function runStage(name, fn) {
  try {
    const result = await fn();
    return { status: 'ok', result };
  } catch (err) {
    console.error(`[pipeline:${name}] ${err.message}`);
    return { status: 'failed', error: err.message, result: null };
  }
}

export async function processIntake(rawPayload) {
  const elapsed = timer();

  // 1. Normalize
  const normalized = normalize(rawPayload);
  if (!normalized.ok) {
    return {
      status: 'rejected',
      errors: normalized.errors,
      processingMs: elapsed(),
    };
  }

  const payload = normalized.payload;
  const pipeline = { normalize: 'ok' };

  // 2. Classify
  const classifyResult = await runStage('classify', () => classify(payload));
  let classification;
  if (classifyResult.status === 'ok') {
    pipeline.classify = 'ok';
    classification = classifyResult.result;
  } else {
    pipeline.classify = 'degraded';
    classification = {
      type: 'unknown', typeConfidence: 0, urgency: 'medium',
      venture: 'general', ventureConfidence: 0,
      reasoning: 'Classifier unavailable — routed to manual review',
      suggestedAction: 'Review manually',
      spamScore: 0,
    };
  }

  // 3. Enrich
  const enrichResult = await runStage('enrich', () => enrich(payload.sender));
  pipeline.enrich = enrichResult.status;
  const enrichment = enrichResult.result || {
    domain: payload.sender.domain, hasWebsite: false, pageTitle: null, status: 'failed',
  };

  // 4. Route
  const routeResult = await runStage('route', () => route(payload, classification, enrichment));
  pipeline.route = routeResult.status;
  const routing = routeResult.result || { destination: '#intake-review', delivered: false, mode: 'failed' };

  // 5. Log
  const processingMs = elapsed();
  const logResult = await runStage('log', () => {
    logIntake({
      id: payload.id,
      received_at: payload.receivedAt,
      processed_at: new Date().toISOString(),
      sender_email: payload.sender.email,
      sender_domain: payload.sender.domain,
      subject: payload.subject,
      body_preview: payload.bodyPreview,
      type: classification.type,
      type_confidence: classification.typeConfidence ?? 0,
      urgency: classification.urgency,
      venture: classification.venture,
      venture_confidence: classification.ventureConfidence ?? 0,
      spam_score: classification.spamScore ?? 0,
      suggested_action: classification.suggestedAction,
      route_destination: routing.destination,
      route_success: routing.delivered ? 1 : 0,
      delivery_mode: routing.mode,
      processing_ms: processingMs,
      raw_payload: JSON.stringify(rawPayload),
      classification_raw: JSON.stringify(classification),
      pipeline_status: JSON.stringify(pipeline),
    });
  });
  pipeline.log = logResult.status;

  return {
    status: 'processed',
    id: payload.id,
    classification: {
      type: classification.type,
      urgency: classification.urgency,
      venture: classification.venture,
      reasoning: classification.reasoning,
      suggestedAction: classification.suggestedAction,
    },
    enrichment: {
      domain: enrichment.domain,
      hasWebsite: enrichment.hasWebsite,
      pageTitle: enrichment.pageTitle,
    },
    routing: {
      destination: routing.destination,
      delivered: routing.delivered,
      mode: routing.mode,
    },
    pipeline,
    processingMs: elapsed(),
  };
}
