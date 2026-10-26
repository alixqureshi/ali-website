import express from 'express';
import { inspectPayment, publicPayment } from './payment.js';
import { createCheckout } from './checkout.js';
import { fileURLToPath } from 'node:url';

export function createApp({ stripe, config, store }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops || false);
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" });
    next();
  });
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', mode: config.mode }));
  // A separate test launcher, never a public live booking CTA.
  app.get('/preview', (_req, res) => {
    if (config.live || !config.checkoutEnabled) return res.sendStatus(404);
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    res.sendFile(fileURLToPath(new URL('../public/preview.html', import.meta.url)), { dotfiles: 'allow' });
  });
  app.get('/preview.js', (_req, res) => res.sendFile(fileURLToPath(new URL('../public/preview.js', import.meta.url)), { dotfiles: 'allow' }));
  const attempts = new Map();
  const allowOrigin = (req, res, next) => {
    const origin = req.get('Origin');
    if (!origin || !config.origins.includes(origin)) return res.status(403).json({ error: 'Origin not allowed' });
    res.set({ 'Access-Control-Allow-Origin': origin, Vary: 'Origin',
      'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    next();
  };
  app.options('/api/checkout', allowOrigin, (_req, res) => res.sendStatus(204));
  app.post('/api/checkout', allowOrigin, express.json({ limit: '2kb' }), async (req, res) => {
    if (!config.checkoutEnabled || (config.live && config.startAt <= Date.now())) {
      return res.status(503).json({ error: 'Booking is not open' });
    }
    const id = req.body?.attempt_id;
    if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid checkout attempt' });
    }
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const counter = attempts.get(req.ip) || { count: 0, until: now + 60000 };
    if (counter.count >= 10 || attempts.size >= 10000) {
      res.set('Retry-After', '60');
      return res.status(429).json({ error: 'Please wait before trying again' });
    }
    counter.count++;
    attempts.set(req.ip, counter);
    try {
      return res.json({ url: await createCheckout(stripe, config, id) });
    } catch {
      return res.status(503).json({ error: 'Checkout temporarily unavailable; retry the same attempt' });
    }
  });

  // Preserve raw bytes for Stripe signature verification; no JSON middleware
  // may run before this route. Unknown/duplicate events safely receive 200.
  app.post('/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.get('Stripe-Signature'), config.webhookSecret);
    } catch {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
    if (event.livemode !== config.live) return res.status(400).json({ error: 'Wrong Stripe mode' });
    try {
      const type = event.type;
      let sessionId;
      if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(type)) {
        sessionId = event.data.object.id;
      } else if (type === 'charge.refunded') {
        const intent = event.data.object.payment_intent;
        sessionId = store.findByIntent(typeof intent === 'string' ? intent : intent?.id)?.session_id;
      } else {
        return res.json({ received: true });
      }
      const payment = sessionId ? await inspectPayment(stripe, config, sessionId) : null;
      store.recordEvent(event.id, payment, config);
      return res.json({ received: true });
    } catch {
      // Do not log request bodies, account secrets, customer details or sessions.
      console.error('Stripe webhook processing failed; delivery will be retried');
      return res.status(503).json({ error: 'Please retry delivery' });
    }
  });

  app.get('/api/booking-status', async (req, res) => {
    const origin = req.get('Origin');
    if (origin && !config.origins.includes(origin)) return res.status(403).json({ error: 'Origin not allowed' });
    if (origin) res.set({ 'Access-Control-Allow-Origin': origin, Vary: 'Origin' });
    try {
      const payment = await inspectPayment(stripe, config, req.query.session_id);
      return res.status(payment.status === 'not_found' ? 404 : 200).json(publicPayment(payment));
    } catch {
      return res.status(503).json({ error: 'Payment confirmation temporarily unavailable' });
    }
  });
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  // Parser/transport failures must not expose Express stack traces or payloads.
  app.use((error, _req, res, _next) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid request' });
  });
  return app;
}
