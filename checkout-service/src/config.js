export function readConfig(env = process.env) {
  const mode = env.STRIPE_MODE || 'test';
  if (!['test', 'live'].includes(mode)) throw new Error('STRIPE_MODE must be test or live');
  const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_ACCOUNT_ID',
    'STRIPE_PAYMENT_LINK_ID', 'STRIPE_PRICE_ID', 'WORKSHOP_COHORT_ID', 'DATABASE_PATH'];
  for (const name of required) {
    if (!env[name]) throw new Error(`Missing configuration: ${name}`);
  }
  if (!env.STRIPE_SECRET_KEY.startsWith(`sk_${mode}_`) &&
      !env.STRIPE_SECRET_KEY.startsWith(`rk_${mode}_`)) {
    throw new Error('Stripe key does not match STRIPE_MODE');
  }
  for (const [name, prefix] of [['STRIPE_WEBHOOK_SECRET', 'whsec_'], ['STRIPE_ACCOUNT_ID', 'acct_'],
    ['STRIPE_PAYMENT_LINK_ID', 'plink_'], ['STRIPE_PRICE_ID', 'price_']]) {
    if (!env[name].startsWith(prefix)) throw new Error(`Invalid configuration: ${name}`);
  }
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
    paymentLinkId: env.STRIPE_PAYMENT_LINK_ID, priceId: env.STRIPE_PRICE_ID,
    cohortId: env.WORKSHOP_COHORT_ID, currency: 'usd', unitAmount: 9700,
    origins, databasePath: env.DATABASE_PATH, port: Number(env.PORT || 3000)
  };
}
