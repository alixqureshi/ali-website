import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Stripe from 'stripe';
import { readConfig } from '../src/config.js';
import { inspectPayment } from '../src/payment.js';
import { openStore } from '../src/store.js';
import { createApp } from '../src/app.js';

const config = {
  mode: 'test', live: false, accountId: 'acct_fixture',
  webhookSecret: 'whsec_fixture_not_a_real_secret',
  paymentLinkId: 'plink_workshop_fixture', priceId: 'price_workshop_fixture',
  cohortId: 'fixture-cohort', currency: 'usd', unitAmount: 9700,
  origins: ['https://aliqureshi.co'], databasePath: ':memory:'
};
const sessionId = 'cs_test_fixture12345678';
function paidSession(overrides = {}) {
  return {
    id: sessionId, livemode: false, mode: 'payment', status: 'complete',
    payment_status: 'paid', payment_link: config.paymentLinkId,
    amount_total: 9700, currency: 'usd',
    customer_details: { email: 'buyer@example.invalid', name: 'Private Buyer' },
    line_items: { has_more: false, data: [{ quantity: 1,
      price: { id: config.priceId, unit_amount: 9700, currency: 'usd' } }] },
    payment_intent: { id: 'pi_fixture', status: 'succeeded', amount_received: 9700,
      latest_charge: { id: 'ch_fixture', paid: true, refunded: false, amount_refunded: 0 } },
    ...overrides
  };
}
function fakeStripe(getSession) {
  return { checkout: { sessions: { retrieve: getSession } }, webhooks: Stripe.webhooks };
}
async function harness(t, initial = paidSession()) {
  let current = initial;
  let fail = false;
  const stripe = fakeStripe(async () => {
    if (fail) throw new Error('temporary network failure');
    return current;
  });
  const store = openStore(':memory:');
  const server = createApp({ stripe, config, store }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function webhook(type = 'checkout.session.completed', id = 'evt_fixture', object = { id: sessionId }, extra = {}) {
    const payload = JSON.stringify({ id, object: 'event', type, livemode: false,
      data: { object }, ...extra });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: config.webhookSecret });
    return fetch(`${base}/webhooks/stripe`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, body: payload });
  }
  return { base, store, webhook, setSession(value) { current = value; }, setFailure(value) { fail = value; } };
}

test('configuration fails closed on missing settings, live/test mismatch and unsafe origins', () => {
  assert.throws(() => readConfig({}), /Missing configuration/);
  const env = {
    STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: config.webhookSecret,
    STRIPE_ACCOUNT_ID: config.accountId, STRIPE_PAYMENT_LINK_ID: config.paymentLinkId,
    STRIPE_PRICE_ID: config.priceId, WORKSHOP_COHORT_ID: config.cohortId, DATABASE_PATH: ':memory:'
  };
  assert.equal(readConfig(env).mode, 'test');
  assert.throws(() => readConfig({ ...env, STRIPE_MODE: 'live' }), /does not match/);
  assert.throws(() => readConfig({ ...env, ALLOWED_ORIGINS: 'http://example.com' }), /exact HTTPS/);
  assert.throws(() => readConfig({ ...env, ALLOWED_ORIGINS: 'https://aliqureshi.co/path' }), /exact HTTPS/);
});

test('only the paid workshop session for this mode, link, price and quantity qualifies', async () => {
  const inspect = session => inspectPayment(fakeStripe(async () => session), config, sessionId);
  assert.equal((await inspect(paidSession())).status, 'paid');
  for (const override of [
    { livemode: true }, { mode: 'subscription' }, { payment_link: 'plink_unrelated' },
    { currency: 'gbp' }, { amount_total: 0 },
    { line_items: { has_more: true, data: paidSession().line_items.data } },
    { line_items: { data: [{ quantity: 1, price: { id: 'price_unrelated', unit_amount: 9700, currency: 'usd' } }] } },
    { line_items: { data: [{ quantity: 2, price: paidSession().line_items.data[0].price }] } }
  ]) assert.equal((await inspect(paidSession(override))).status, 'not_found');
  assert.equal((await inspect(paidSession({ payment_status: 'unpaid' }))).status, 'pending');
  assert.equal((await inspect(paidSession({ status: 'open' }))).status, 'pending');
  assert.equal((await inspect(paidSession({ status: 'expired' }))).status, 'expired');
  assert.equal((await inspect(paidSession({ payment_status: 'no_payment_required' }))).status, 'pending');
  assert.equal((await inspect(paidSession({ payment_intent: { status: 'processing' } }))).status, 'pending');
  for (const intent of [
    { ...paidSession().payment_intent, amount_received: undefined },
    { ...paidSession().payment_intent, latest_charge: 'ch_unexpanded' },
    { ...paidSession().payment_intent, latest_charge: null }
  ]) assert.equal((await inspect(paidSession({ payment_intent: intent }))).status, 'pending');
  assert.equal((await inspect(paidSession({ payment_intent: { ...paidSession().payment_intent,
    latest_charge: { refunded: true, amount_refunded: 9700 } } }))).status, 'refunded');
  assert.equal((await inspect(paidSession({ payment_intent: { ...paidSession().payment_intent,
    latest_charge: { refunded: false, amount_refunded: 100 } } }))).status, 'refunded');
});

test('random, malformed and missing sessions do not become purchases', async () => {
  let calls = 0;
  const stripe = fakeStripe(async () => { calls++; const error = new Error(); error.code = 'resource_missing'; throw error; });
  assert.equal((await inspectPayment(stripe, config, 'anything')).status, 'not_found');
  assert.equal(calls, 0);
  assert.equal((await inspectPayment(stripe, config, sessionId)).status, 'not_found');
});

test('confirmation exposes no buyer details, creates no booking, and keeps a stable event ID', async t => {
  const h = await harness(t);
  const get = () => fetch(`${h.base}/api/booking-status?session_id=${sessionId}`, { headers: { Origin: 'https://aliqureshi.co' } });
  const response = await get();
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://aliqureshi.co');
  const body = await response.json();
  const orderId = `order_${createHash('sha256').update(sessionId).digest('hex').slice(0, 32)}`;
  assert.deepEqual(body, { status: 'paid', mode: 'test', transaction_id: orderId,
    event_id: orderId, value: 97, currency: 'USD' });
  assert.equal(JSON.stringify(body).includes(sessionId), false);
  assert.equal((await (await get()).json()).event_id, body.event_id);
  assert.equal(h.store.listPending().length, 0);
  assert.equal((await fetch(`${h.base}/api/booking-status?session_id=${sessionId}`,
    { headers: { Origin: 'https://unrelated.example' } })).status, 403);
});

test('invalid, modified and expired webhook signatures cannot create bookings', async t => {
  const h = await harness(t);
  const payload = JSON.stringify({ id: 'evt_bad', type: 'checkout.session.completed' });
  for (const signature of ['', 't=1,v1=bad', Stripe.webhooks.generateTestHeaderString({
    payload, secret: config.webhookSecret, timestamp: 1
  })]) {
    const response = await fetch(`${h.base}/webhooks/stripe`, { method: 'POST', body: payload,
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature } });
    assert.equal(response.status, 400);
  }
  assert.equal(h.store.listPending().length, 0);
});

test('duplicate webhook deliveries and separate paid events create one booking', async t => {
  const h = await harness(t);
  assert.equal((await h.webhook()).status, 200);
  assert.equal((await h.webhook()).status, 200);
  assert.equal((await h.webhook('checkout.session.async_payment_succeeded', 'evt_second')).status, 200);
  assert.equal(h.store.listPending().length, 1);
  const booking = h.store.listPending()[0];
  assert.equal(booking.amount, 9700);
  assert.equal(booking.fulfillment_status, 'pending');
  assert.equal(booking.cohort_id, config.cohortId);
});

test('delayed payments wait for successful payment; failed delivery can retry', async t => {
  const h = await harness(t, paidSession({ payment_status: 'unpaid' }));
  await h.webhook();
  assert.equal(h.store.listPending().length, 0);
  h.setSession(paidSession());
  h.setFailure(true);
  assert.equal((await h.webhook('checkout.session.async_payment_succeeded', 'evt_later')).status, 503);
  h.setFailure(false);
  assert.equal((await h.webhook('checkout.session.async_payment_succeeded', 'evt_later')).status, 200);
  assert.equal(h.store.listPending().length, 1);
});

test('test/live isolation and unrelated purchases are enforced at the webhook', async t => {
  const h = await harness(t, paidSession({ payment_link: 'plink_unrelated' }));
  assert.equal((await h.webhook('checkout.session.completed', 'evt_wrong_mode', { id: sessionId }, { livemode: true })).status, 400);
  await h.webhook();
  assert.equal(h.store.listPending().length, 0);
});

test('refunds stop pending fulfillment and a stale paid event cannot revive a refunded booking', async t => {
  const h = await harness(t);
  await h.webhook();
  h.setSession(paidSession({ payment_intent: { ...paidSession().payment_intent,
    latest_charge: { refunded: true, amount_refunded: 9700 } } }));
  await h.webhook('charge.refunded', 'evt_refund', { payment_intent: 'pi_fixture' });
  assert.equal(h.store.listPending().length, 0);
  h.setSession(paidSession());
  await h.webhook('checkout.session.completed', 'evt_stale');
  assert.equal(h.store.listPending().length, 0);
});

test('a temporary confirmation failure stays pending instead of claiming payment', async t => {
  const h = await harness(t);
  h.setFailure(true);
  const response = await fetch(`${h.base}/api/booking-status?session_id=${sessionId}`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Payment confirmation temporarily unavailable' });
});

test('bookings and webhook deduplication survive reopening the database', t => {
  const folder = mkdtempSync(join(tmpdir(), 'ali-checkout-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, 'bookings.sqlite');
  const payment = { status: 'paid', sessionId, paymentIntentId: 'pi_fixture', amount: 9700, currency: 'usd' };
  let store = openStore(path);
  store.recordEvent('evt_persisted', payment, config);
  store.close();
  store = openStore(path);
  try {
    assert.equal(store.listPending().length, 1);
    assert.equal(store.recordEvent('evt_persisted', payment, config), false);
    assert.equal(store.findByIntent('pi_fixture').session_id, sessionId);
  } finally { store.close(); }
});
