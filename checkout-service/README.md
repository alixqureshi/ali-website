# AI with Ali payment confirmation service

Prepared for the USD97 Build your AI brain workshop. **Not deployed, connected to
Stripe, or accepting payments yet.** Ali confirmed **ADCRATE LTD** as merchant
on 2026-10-26, and said the workshop date is undecided. The public site still
takes enquiries; its CTAs have not been changed.

The landing page will link to a Stripe Payment Link. Configure the link to return
to `/workshops/build-your-ai-brain/booked/?session_id={CHECKOUT_SESSION_ID}`.
The confirmation page must ask this service whether payment actually succeeded;
loading the page itself is never evidence of a sale.

## Contract

- `GET /healthz`: service mode and health, no account details.
- `GET /api/booking-status?session_id=cs_...`: retrieves the current Stripe session
  and verifies mode, Payment Link, exact Price, quantity, currency, settled payment
  and refunds. Returns only status and non-personal transaction/event/value fields.
  This route creates no booking and sends no emails or conversion events.
- `POST /webhooks/stripe`: Stripe-signed raw JSON only. Processes
  `checkout.session.completed`, `checkout.session.async_payment_succeeded` and
  `charge.refunded`. Retrieves the current payment before storing a booking.
  SQLite transactions deduplicate event IDs and paid sessions, including retries.
  A refunded booking cannot be revived by an out-of-order paid event.

Bookings contain Stripe IDs and payment/cohort state, not card data, customer
names, emails or raw webhook bodies. Stripe remains the source for buyer details.
All paid bookings start with `fulfillment_status=pending`; **no attendee emails,
Zoom invitations or server-side Meta/GA purchase events are active in this service.**
Partial refunds are conservatively excluded from the pending fulfillment list
for manual review; do not automatically revoke a seat for a partial refund.

## Local validation

Requires Node 24–26. `npm ci` then `npm test`. Tests use locally signed fixtures
and a mocked Stripe client, with no Stripe calls, purchases, emails or ad events.
The fixture secrets are fictional. Use `npm start` only after configuration.

Copy `.env.example` to an ignored `.env` for local development and use
`node --env-file=.env src/server.js`. Never paste real secrets into a chat,
source file, README or commit. Use the hosting provider's secret manager for a
deployment. At startup, the service verifies the merchant account ID against the
Stripe credential and refuses to start on a mismatch. Mode defaults to **test**;
the credential prefix and webhook event must match the configured mode.

## Stripe sandbox setup

1. Use the confirmed merchant **ADCRATE LTD**, account
   `acct_1M9wquGUKYQC9sJN`. Stripe currently requires representative verification.
   Ali handles any business verification, bank details, passwords and security
   codes directly in Stripe. No identity details are stored in this repository.
2. In a Stripe sandbox/test mode, create the USD97 one-time workshop Product and
   Price. Create a Payment Link for quantity 1, no quantity adjustment or optional
   products. Keep checkout currency USD; configure any required tax treatment with
   the merchant before live activation. The backend captures the actual charged
   amount, including configured tax/discount effects.
3. Configure receipt emails in Stripe and the confirmation redirect above.
4. Add the actual merchant, test Payment Link, Price, cohort, API credential and
   webhook signing secret in the deployment's secret manager. The Stripe API
   credential needs read access to the merchant account, Checkout Sessions and
   expanded payment/Price/charge data. It does not need payment-write access.
5. Register the deployed `/webhooks/stripe` endpoint for the three event types.
   Test and live endpoints have different signing secrets.
6. Mount a persistent volume at `/data` and use one service replica. Configure
   `DATABASE_PATH=/data/bookings.sqlite`; do not run production with an ephemeral
   database. No existing Adcrate service should be reused for this personal site.

## Confirmation page

`/workshops/build-your-ai-brain/booked/` is prepared with neutral, pending,
verified, test, refunded and unavailable states. It sends no analytics until a
live payment for this offer is verified. It removes checkout/campaign query
parameters before loading analytics and uses a hashed order ID, never the Stripe
checkout token, buyer name or email, in conversion events. Tab-only session
storage preserves checking after refresh; it does not put the token back in URLs.

`assets/workshop-checkout-config.js` intentionally has an empty `statusEndpoint`
and `mode: "test"`. Set the HTTPS endpoint and matching mode only after deployment.
Test payments, local previews, GPC/DNT and GA opt-outs are respected. Live mode
uses the existing Meta dataset and GA4 property. Purchase events have stable
order IDs, with best-effort local-storage deduplication per browser. Storage
failure suppresses tracking; blockers, closed tabs and browser/network failures
can lose browser conversions. **CAPI is not implemented**; browser tracking is
not a durable sales ledger. Do not claim guaranteed or cross-device deduplication.

## Still required before live launch

- Workshop date/time, booking/cancellation terms and actual
  sandbox Product/Price/Payment Link.
- Deploy this service with persistent storage and secrets. Hosting cost and
  destination must be settled before provisioning; nothing is provisioned yet.
- Connect and visually verify the prepared booked page against the deployed
  Stripe service. Verify actual browser conversion requests in live mode only
  after a genuine authorized purchase, keeping checkout tokens out of analytics.
- Wire the landing page only once actual checkout and workshop details are ready.
- Connect attendee registration/transactional delivery. Stripe receipts are not
  workshop join instructions. Until that is automated, a documented manual cohort
  operation is required, and no screen may claim an invitation was sent.
- Complete end-to-end sandbox checks (successful, declined, delayed, duplicate,
  refunded, reopened confirmation) and verify browser analytics/CAPI behavior.
- Review and activate live mode separately. Never run a real-money test payment
  or refund without Ali handling/authorizing that financial action.

Provider references:
[Payment Links](https://docs.stripe.com/payment-links),
[after payment](https://docs.stripe.com/payment-links/post-payment),
[webhook signatures](https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors).
