import { createHash } from 'node:crypto';

const objectId = value => typeof value === 'string' ? value : value?.id;

// A redirect, event payload, browser price or arbitrary paid Stripe session is
// insufficient. Retrieve Stripe's current session and verify this exact offer.
export async function inspectPayment(stripe, config, sessionId) {
  if (!/^cs_(test|live)_[A-Za-z0-9]{8,240}$/.test(sessionId || '')) {
    return { status: 'not_found' };
  }
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price', 'payment_intent.latest_charge']
    });
  } catch (error) {
    if (error.code === 'resource_missing') return { status: 'not_found' };
    throw error;
  }
  const items = session.line_items;
  const item = items?.data?.[0];
  if (session.livemode !== config.live || session.mode !== 'payment' ||
      session.payment_link != null || session.metadata?.offer !== 'ai-brain-workshop' ||
      session.metadata?.cohort_id !== config.cohortId ||
      session.currency !== config.currency || items?.has_more ||
      items?.data?.length !== 1 || objectId(item?.price) !== config.priceId ||
      item.quantity !== 1 || item.price.unit_amount !== config.unitAmount ||
      item.price.currency !== config.currency ||
      !Number.isSafeInteger(session.amount_total) || session.amount_total <= 0) {
    return { status: 'not_found' };
  }
  const intent = session.payment_intent;
  const charge = intent?.latest_charge;
  if (charge && (charge.refunded || charge.amount_refunded > 0)) {
    return { status: 'refunded', sessionId: session.id, paymentIntentId: objectId(intent) };
  }
  if (session.status !== 'complete' || session.payment_status !== 'paid' ||
      intent?.status !== 'succeeded' || !objectId(intent) ||
      !Number.isSafeInteger(intent.amount_received) || intent.amount_received < session.amount_total ||
      typeof charge !== 'object' || charge === null || charge.paid !== true ||
      !Number.isSafeInteger(charge.amount_refunded)) {
    return { status: session.status === 'expired' ? 'expired' : 'pending' };
  }
  return {
    status: 'paid', sessionId: session.id, paymentIntentId: objectId(intent),
    amount: session.amount_total, currency: session.currency,
    // Same identifier on repeated callbacks/refreshes; never generate a new sale.
    eventId: `order_${createHash('sha256').update(session.id).digest('hex').slice(0, 32)}`,
    live: session.livemode
  };
}

export function publicPayment(payment) {
  if (payment.status !== 'paid') return { status: payment.status };
  return {
    status: 'paid', mode: payment.live ? 'live' : 'test',
    transaction_id: payment.eventId, event_id: payment.eventId,
    value: payment.amount / 100, currency: payment.currency.toUpperCase()
  };
}
