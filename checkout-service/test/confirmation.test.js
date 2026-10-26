import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../assets/workshop-booking.js', import.meta.url), 'utf8');
const paid = { status: 'paid', mode: 'live', transaction_id: `order_${'a'.repeat(32)}`,
  event_id: `order_${'a'.repeat(32)}`, value: 97, currency: 'USD' };

async function run({ payment = paid, query = '?session_id=cs_live_fixture12345678&utm_source=private',
  mode = 'live', endpoint = 'https://checkout.example.invalid/api/booking-status',
  privacy = {}, stored = new Map(), tab = new Map(), failure = false, storageFailure = false,
  gaDisabled = false } = {}) {
  const elements = new Map();
  const scripts = [];
  const events = [];
  const fetches = [];
  let clean = false;
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { hidden: true,
        setAttribute() {}, addEventListener(_, callback) { this.retry = callback; } });
      return elements.get(id);
    },
    createElement() { return { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }; },
    head: { appendChild(script) { assert.equal(clean, true); scripts.push(script); script.onload?.(); } }
  };
  const storage = map => ({ getItem(k) { if (storageFailure) throw new Error(); return map.get(k); },
    setItem(k, v) { if (storageFailure) throw new Error(); map.set(k, v); } });
  const window = {
    location: { hostname: 'aliqureshi.co', pathname: '/workshops/build-your-ai-brain/booked/', search: query },
    history: { replaceState(_a, _b, path) { assert.equal(path.includes('?'), false); clean = true; } },
    aiWithAliCheckout: { statusEndpoint: endpoint, mode }, navigator: privacy,
    localStorage: storage(stored), sessionStorage: storage(tab),
    setTimeout, clearTimeout,
    fetch: async (url, opts) => {
      assert.equal(clean, true); assert.equal(opts.referrerPolicy, 'no-referrer');
      fetches.push(url);
      if (failure) throw new Error();
      return { ok: true, status: 200, json: async () => payment };
    },
    gtag: (...args) => events.push(args), fbq: (...args) => events.push(args),
    'ga-disable-G-D74XK8FM1T': gaDisabled
  };
  vm.runInNewContext(source, { window, document, URL, URLSearchParams, AbortController });
  await new Promise(resolve => setImmediate(resolve));
  return { elements, scripts, events, fetches, stored, tab };
}

test('only a verified live order sends purchases, after URL cleanup and without checkout tokens', async () => {
  const result = await run();
  assert.equal(result.elements.get('booking-title').textContent, 'Payment confirmed');
  assert.equal(result.events.length, 2);
  assert.equal(result.scripts.length, 2);
  assert.equal(JSON.stringify(result.events).includes('cs_live_'), false);
  assert.equal(JSON.stringify(result.events).includes('utm_source'), false);
  assert.equal(result.events[0][2].transaction_id, paid.transaction_id);
  assert.equal(result.events[1][4].eventID, paid.event_id);
});

test('test, unpaid, refunded, expired, missing, malformed and unavailable states send no conversions', async () => {
  for (const payment of [
    { ...paid, mode: 'test' }, { status: 'pending' }, { status: 'refunded' },
    { status: 'expired' }, { status: 'not_found' }, { ...paid, value: -1 },
    { ...paid, transaction_id: 'cs_live_token' }, { status: 'unknown' }
  ]) {
    const result = await run({ payment, mode: payment.mode === 'test' ? 'test' : 'live' });
    assert.equal(result.events.length, 0); assert.equal(result.scripts.length, 0);
    assert.notEqual(result.elements.get('booking-title').textContent, 'Payment confirmed');
  }
  for (const options of [{ query: '' }, { endpoint: '' }, { endpoint: 'http://insecure.example/' }, { failure: true }]) {
    const result = await run(options);
    assert.equal(result.events.length, 0);
    assert.notEqual(result.elements.get('booking-title').textContent, 'Payment confirmed');
  }
});

test('privacy settings, blocked storage and repeated confirmations suppress duplicate tracking', async () => {
  for (const options of [{ privacy: { globalPrivacyControl: true } },
    { privacy: { doNotTrack: '1' } }, { storageFailure: true }]) {
    const result = await run(options);
    assert.equal(result.elements.get('booking-title').textContent, 'Payment confirmed');
    assert.equal(result.events.length, 0);
  }
  const first = await run();
  const refresh = await run({ query: '', stored: first.stored, tab: first.tab });
  assert.equal(refresh.elements.get('booking-title').textContent, 'Payment confirmed');
  assert.equal(refresh.events.length, 0);
  assert.equal(refresh.fetches.length, 1);
  const gaOff = await run({ gaDisabled: true });
  assert.equal(gaOff.events.length, 1);
  assert.equal(gaOff.events[0][0], 'trackSingle');
});
