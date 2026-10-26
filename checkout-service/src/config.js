export function readConfig(env = process.env) {
  const mode = env.STRIPE_MODE || 'test';
  if (!['test', 'live'].includes(mode)) throw new Error('STRIPE_MODE must be test or live');
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_ACCOUNT_ID',
    'STRIPE_PRICE_ID', 'WORKSHOP_COHORT_ID', 'DATABASE_PATH'];
  for (const name of required) {
    if (!env[name]) throw new Error(`Missing configuration: ${name}`);
  }
  if (!env.STRIPE_SECRET_KEY.startsWith(`sk_${mode}_`) &&
      !env.STRIPE_SECRET_KEY.startsWith(`rk_${mode}_`)) {
    throw new Error('Stripe key does not match STRIPE_MODE');
  }
  for (const [name, prefix] of [['STRIPE_WEBHOOK_SECRET', 'whsec_'], ['STRIPE_ACCOUNT_ID', 'acct_'],
    ['STRIPE_PRICE_ID', 'price_']]) {
    if (!env[name].startsWith(prefix)) throw new Error(`Invalid configuration: ${name}`);
  }
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(env.WORKSHOP_COHORT_ID)) throw new Error('Invalid cohort ID');
  const siteOrigin = env.SITE_ORIGIN || 'https://aliqureshi.co';
  const site = new URL(siteOrigin);
  if (site.origin !== siteOrigin || (site.protocol !== 'https:' &&
      !(mode === 'test' && site.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(site.hostname)))) {
    throw new Error('SITE_ORIGIN must be an exact HTTPS origin (local HTTP in test mode only)');
  }
  const checkoutEnabled = env.CHECKOUT_ENABLED === 'true';
  const startAt = Date.parse(env.WORKSHOP_START_AT || '');
  if (mode === 'live' && checkoutEnabled) {
    throw new Error('Live checkout activation is not configured; agree schedule, tax, terms and fulfillment after testing');
  }
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  if (![0, 1].includes(trustProxyHops)) throw new Error('TRUST_PROXY_HOPS must be 0 or 1');
  const origins = (env.ALLOWED_ORIGINS || 'https://aliqureshi.co,https://www.aliqureshi.co')
    .split(',').map(value => value.trim()).filter(Boolean);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['https:', 'http:'].includes(url.protocol) ||
        (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname))) {
      throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins (HTTP only for local development)');
    }
  }
  return {
    mode, live: mode === 'live', secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET, accountId: env.STRIPE_ACCOUNT_ID,
    priceId: env.STRIPE_PRICE_ID, checkoutEnabled, siteOrigin, startAt, trustProxyHops,
    cohortId: env.WORKSHOP_COHORT_ID, currency: 'usd', unitAmount: 9700,
    origins, databasePath: env.DATABASE_PATH, port: Number(env.PORT || 3000)
  };
}
