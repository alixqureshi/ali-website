// All commercial settings are server-owned. No browser price, return URL,
// customer ID, payment token or tax decision is accepted here.
export async function createCheckout(stripe, config, attemptId) {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', ui_mode: 'hosted_page',
    line_items: [{ price: config.priceId, quantity: 1 }],
    success_url: `${config.siteOrigin}/workshops/build-your-ai-brain/booked/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.siteOrigin}/workshops/build-your-ai-brain/`,
    metadata: { offer: 'ai-brain-workshop', cohort_id: config.cohortId },
    integration_identifier: 'hosted_web_0001',
    adaptive_pricing: { enabled: false },
    // Test fixture only. Agree live tax treatment before enabling real sales.
    ...(config.live ? {} : { automatic_tax: { enabled: false } }),
    allow_promotion_codes: false,
    billing_address_collection: 'auto',
    payment_method_types: ['card'],
    branding_settings: { background_color: '#07182d', button_color: '#0074d4',
      font_family: 'default', border_style: 'rounded', display_name: 'AI with Ali' },
    custom_text: { submit: { message: config.live
      ? 'Workshop joining instructions are sent separately from your Stripe receipt.'
      : 'Test checkout only. No real money will be charged and no workshop seat will be booked.' } }
  }, { idempotencyKey: `ai-workshop-${config.cohortId}-${attemptId}` });
  const url = new URL(session.url);
  if (session.livemode !== config.live || url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') {
    throw new Error('Unexpected Stripe checkout response');
  }
  return url.href;
}
