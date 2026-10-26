# AI with Ali workshop checkout

Prepared for the one-time **USD97** workshop, merchant **ADCRATE LTD**. Not deployed or connected to Stripe credentials yet. Public booking stays closed: Ali has not chosen a date. No landing-page CTAs changed.

## Flow

The backend creates a Stripe-hosted Checkout Session for a server-owned Price and cohort. Each session uses Ali’s navy **#07182D** and display name, without modifying Adcrate-wide branding. Adaptive Pricing is disabled per session to keep USD. Quantity is fixed at one, with no upsells, discounts, saved payment methods or customer IDs supplied by the browser. Card/wallet payments only for this initial test.

Stripe redirects to `/workshops/build-your-ai-brain/booked/?session_id={CHECKOUT_SESSION_ID}`. The page checks payment with the backend before showing success. A redirect or page visit alone never counts as a sale. Signed webhooks create one booking per paid session; refunds suppress pending fulfillment. SQLite transactions deduplicate webhook events and sessions.

## Endpoints and safeguards

- `GET /healthz`: health and test/live mode, no merchant details.
- `POST /api/checkout`: JSON with `attempt_id` (UUID v4), exact allowed browser Origin required. Server fixes price, quantity, cohort, branding and return URLs. Repeated attempts use the same Stripe idempotency key. Limit: 10 attempts per IP per minute, with bounded transient counters. Closed booking fails before Stripe is called.
- `GET /preview`: test-only launcher, available only with test mode and `CHECKOUT_ENABLED=true`. Never serves a live sales page.
- `GET /api/booking-status?session_id=cs_...`: retrieves current payment and verifies mode, exact offer/cohort metadata, Price, currency, quantity, settlement and refunds. Returns status and hashed non-personal order/value fields. Creates no booking or emails.
- `POST /webhooks/stripe`: raw-body Stripe signature verification. Handles `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `charge.refunded`. Retrieves current Stripe state before persisting. Network/storage failures return 503 for Stripe retry.

New sessions default to disabled. **Enabling session creation in live mode is deliberately blocked in configuration** until schedule, tax treatment, booking terms and fulfillment are agreed and the tested launch is reviewed. Test configuration is not approval to collect live money.

Bookings contain Stripe IDs and payment/cohort state, not buyer names, emails, card details or raw webhook bodies. Stripe remains the buyer-details source. Paid bookings start with fulfillment pending. No invitations, attendee emails or server-side conversion delivery exist yet. Partial refunds require manual review; do not automatically revoke seats.

## Local validation

Node 24–26: `npm ci` then `npm test`. Tests use mocked Stripe calls and locally signed fictional fixtures. They do not spend money, send email or report ad purchases. `npm start` requires real private test configuration and verifies the merchant account matches the credential.

For local development copy `.env.example` to ignored `.env`, then run `node --env-file=.env src/server.js`. Never paste secrets into chat, source, README or commits. Configure hosted secrets in the provider’s private variable store.

## Test setup

1. Confirm merchant in the dashboard: ADCRATE LTD, account `acct_1M9wquGUKYQC9sJN`. Ali completed representative verification; current Payments status is Active. Stripe has a separate W8/W9 task warning payouts pause November 2, 2026. Ali completes that declaration himself; recheck live status before launch.
2. Existing **test** Product: `prod_VVucDPoNL4r4kw`; one-time USD97 Price: `price_1UUsnaGUKYQC9sJNqekIf1VK`. It inherited Advertising Services classification from Adcrate. That is not an approved workshop tax category. Automatic tax is off only for this test fixture. Review category, registrations and inclusive/exclusive pricing before any live offer.
3. A Checkout Studio draft named AI with Ali — workshop has the navy override scoped to this checkout. The backend includes the corresponding session-specific settings directly. No saved Payment Link is required. Do not confirm Studio’s suggested shared Adaptive Pricing change.
4. Set private `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, account and Price IDs, a test-only cohort such as `test-undated`, and `DATABASE_PATH=/data/bookings.sqlite`. Use `CHECKOUT_ENABLED=true` only in test mode for now.
5. The restricted **test** credential needs Checkout Sessions write/read, and read access to Account, Prices, Payment Intents and Charges for merchant/offer/payment verification. Do not grant live access, payouts, refunds, customers write, or account settings write. New credentials require action-time approval. Keep any setup webhook-management permission separate; the running service does not create endpoints.
6. Register the deployed `/webhooks/stripe` endpoint for the three events above and put its signing secret in private config. Test/live signing secrets are separate.
7. Use a separate personal Railway service, one replica, with persistent `/data` storage. Add the exact service origin to `ALLOWED_ORIGINS` for its test launcher. Use `TRUST_PROXY_HOPS=1` only behind Railway’s single trusted proxy; use 0 locally. Do not trust arbitrary proxy chains.
8. `SITE_ORIGIN` controls the confirmation/cancel destination; use the production site only after the prepared confirmation page is deployed. For local tests, HTTP localhost/127.0.0.1 is allowed in test mode. The public site’s `assets/workshop-checkout-config.js` still has an empty status endpoint and test mode.

## Tracking and delivery

The confirmation page removes the checkout query before analytics. Tab-only storage permits refresh checking. Live verified payments alone can send Purchase events with one-way hashed order IDs; checkout tokens, buyer names and emails are never supplied to analytics. Local previews, test payments, GPC/DNT and GA opt-outs do not send purchases. Per-browser local-storage deduplication is best effort; blockers, storage/network failures and closed tabs can lose browser events. **CAPI is not implemented.** Browser events are not the sales ledger.

Stripe receipts are distinct from workshop invitations. Connect transactional delivery or document a manual cohort operation before sales open, with actual schedule, join instructions, exception handling and fulfillment state. No screen claims an invitation was sent.

## Remaining launch checks

Deploy with secrets and persistent storage; verify actual Stripe success/decline/retry/refund, duplicate webhook handling, reopened confirmation and attendee delivery. Visually inspect desktop/mobile and resolve the Studio preview’s missing logo placeholder. Agree date/timezone, tax, refund/booking terms and delivery before a separate live activation change. Then connect real live Price and credentials and enable the landing-page booking CTA. Ali handles any real-money test purchase/refund directly.

References: [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create), [customization](https://docs.stripe.com/payments/checkout/customization/appearance), [webhooks](https://docs.stripe.com/events/manage-webhook-endpoints).
