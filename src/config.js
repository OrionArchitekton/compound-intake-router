import { readFileSync } from 'node:fs';

export function loadConfig(path = process.env.INTAKE_CONFIG || new URL('../config/service-business.json', import.meta.url)) {
  const config = JSON.parse(readFileSync(path, 'utf8'));
  for (const key of ['types', 'ventures']) {
    if (!Array.isArray(config[key]) || !config[key].length || config[key].some(x =>
      !x || !/^[a-z][a-z0-9-]*$/.test(x.id) || typeof x.description !== 'string')) {
      throw new Error(`Invalid ${key} in intake profile`);
    }
    if (new Set(config[key].map(x => x.id)).size !== config[key].length) {
      throw new Error(`Duplicate ${key} in intake profile`);
    }
  }
  if (!config.types.some(x => x.id === 'unknown') || !config.ventures.some(x => x.id === 'general') ||
      typeof config.description !== 'string' || !config.routing?.routes ||
      typeof config.routing.fallbackChannel !== 'string' || !config.routing.fallbackChannel) {
    throw new Error('Profile needs unknown, general and a fallback destination');
  }
  if (Array.isArray(config.routing.routes) || typeof config.routing.routes !== 'object') {
    throw new Error('Invalid routing rules');
  }
  for (const [type, entry] of Object.entries(config.routing.routes)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid routing entry');
    for (const [group, value] of Object.entries(entry)) {
      if (group === 'action') {
        if (type !== 'spam' || value !== 'log-only') throw new Error('Only spam may bypass manual review');
      } else if (typeof value !== 'string' || !value.trim()) {
        throw new Error('Routing destinations must be non-empty text');
      }
    }
  }
  return config;
}
