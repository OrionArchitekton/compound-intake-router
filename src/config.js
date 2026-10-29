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
  return config;
}
