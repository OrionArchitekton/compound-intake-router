// Render fields as data; retain original structured/audit values separately.
export const oneLine = value => String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ');

function endpoint(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new Error('Use HTTPS for remote alert receivers');
  }
  return url.href;
}

async function post(url, body, headers, fetchFn) {
  const res = await fetchFn(endpoint(url), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body), signal: AbortSignal.timeout(5000), redirect: 'error',
  });
  // Provider acceptance is not recipient acknowledgement. Never retry here.
  if (!res.ok) throw new Error('Receiver did not accept alert');
  if (res.body) await res.body.cancel();
}

export const adapters = {
  console: async (alert) => { console.log(alert.text); },
  slack: async (alert, env, fetchFn) => {
    if (!env.SLACK_WEBHOOK_URL) throw new Error('Missing Slack settings');
    await post(env.SLACK_WEBHOOK_URL, {
      text: alert.text, mrkdwn: false,
      blocks: [{ type: 'section', text: { type: 'plain_text', text: alert.text.slice(0, 3000) } }],
    }, {}, fetchFn);
  },
  email: async (alert, env, fetchFn) => {
    if (!env.RESEND_API_KEY || !env.ALERT_EMAIL_FROM || !env.ALERT_EMAIL_TO) {
      throw new Error('Missing email settings');
    }
    await post('https://api.resend.com/emails', {
      from: env.ALERT_EMAIL_FROM,
      to: env.ALERT_EMAIL_TO.split(',').map(x => x.trim()).filter(Boolean),
      subject: oneLine(`Intake ${alert.classification.type}: ${alert.subject || '(no subject)'}`).slice(0, 200),
      text: alert.text,
    }, { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Idempotency-Key': alert.id }, fetchFn);
  },
  webhook: async (alert, env, fetchFn) => {
    if (!env.ALERT_WEBHOOK_URL) throw new Error('Missing webhook settings');
    await post(env.ALERT_WEBHOOK_URL, alert, {}, fetchFn);
  },
};

export async function deliver(alert, env = process.env, fetchFn = fetch) {
  const mode = env.DELIVERY_MODE || 'console';
  if (!Object.hasOwn(adapters, mode)) throw new Error('Unknown delivery mode');
  await adapters[mode](alert, env, fetchFn);
  return mode;
}
