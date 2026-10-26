import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createCheckout } from '../src/checkout.js';
import { createApp } from '../src/app.js';
import { openStore } from '../src/store.js';

const config = { checkoutEnabled: true, live: false, mode: 'test',
  siteOrigin: 'https://aliqureshi.co', cohortId: 'test-undated', priceId: 'price_fixture',
  origins: ['https://aliqureshi.co'], currency: 'usd', unitAmount: 9700 };

async function harness(t, overrides = {}, failure = false) {
  const calls = [];
  const stripe = { checkout: { sessions: { create: async (...args) => {
    calls.push(args);
    if (failure) throw new Error('Stripe unavailable');
    return { livemode: false, url: 'https://checkout.stripe.com/c/pay/cs_test_fixture' };
  } } } };
  const store = openStore(':memory:');
  const app = createApp({ stripe, config: { ...config, ...overrides }, store });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body = { attempt_id: randomUUID() }, origin = config.origins[0]) => fetch(`${base}/api/checkout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body)
  });
  return { calls, post, base };
}

test('checkout uses server price, cohort, redirects, session-only navy and USD settings', async t => {
  const h = await harness(t);
  const id = randomUUID();
  const body = { attempt_id: id, price: 'price_attacker', quantity: 100, success_url: 'https://evil.invalid' };
  assert.equal((await h.post(body)).status, 200);
  await h.post(body);
  const [params, options] = h.calls[0];
  assert.deepEqual(params.line_items, [{ price: config.priceId, quantity: 1 }]);
  assert.equal(params.metadata.cohort_id, config.cohortId);
  assert.equal(params.metadata.offer, 'ai-brain-workshop');
  assert.equal(params.success_url, `${config.siteOrigin}/workshops/build-your-ai-brain/booked/?session_id={CHECKOUT_SESSION_ID}`);
  assert.equal(params.branding_settings.background_color, '#07182d');
  assert.equal(params.branding_settings.display_name, 'AI with Ali');
  assert.equal(params.adaptive_pricing.enabled, false);
  assert.equal(params.automatic_tax.enabled, false);
  assert.deepEqual(params.payment_method_types, ['card']);
  assert.equal(params.customer, undefined);
  assert.equal(params.payment_intent_data, undefined);
  assert.equal(options.idempotencyKey, h.calls[1][1].idempotencyKey);
});

test('disabled checkout, untrusted origins and invalid attempts cannot create sessions', async t => {
  const h = await harness(t);
  for (const origin of [null, 'https://evil.invalid']) assert.equal((await h.post(undefined, origin)).status, 403);
  assert.equal((await h.post({ attempt_id: 'not-a-uuid' })).status, 400);
  assert.equal(h.calls.length, 0);
  const closed = await harness(t, { checkoutEnabled: false });
  assert.equal((await closed.post()).status, 503);
  assert.equal(closed.calls.length, 0);
  assert.equal((await fetch(`${closed.base}/preview`)).status, 404);
});

test('preflight, test launcher and request limits work without exposing data', async t => {
  const h = await harness(t);
  const response = await fetch(`${h.base}/api/checkout`, { method: 'OPTIONS', headers: { Origin: config.origins[0] } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), config.origins[0]);
  const preview = await fetch(`${h.base}/preview`);
  assert.equal(preview.status, 200);
  assert.match(await preview.text(), /No real money is charged/);
  assert.equal((await fetch(`${h.base}/preview.js`)).status, 200);
  for (let n = 0; n < 10; n++) assert.equal((await h.post()).status, 200);
  const limited = await h.post();
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
});

test('Stripe failures and unexpected checkout URLs or modes fail closed', async t => {
  const h = await harness(t, {}, true);
  assert.equal((await h.post()).status, 503);
  for (const result of [
    { livemode: true, url: 'https://checkout.stripe.com/c/pay/fixture' },
    { livemode: false, url: 'https://evil.invalid/pay' }
  ]) await assert.rejects(createCheckout({ checkout: { sessions: { create: async () => result } } }, config, randomUUID()));
});
