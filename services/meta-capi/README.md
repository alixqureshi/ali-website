# Workshop purchase tracking

This directory versions the source already running as the Railway `meta-capi` Function. It is independent of the static GitHub Pages site. Merging or deploying this website repository does **not** update Railway.

## Payment flow

1. Workshop booking links pass the visitor's Meta browser identifiers to Stripe in `client_reference_id`. Global Privacy Control / Do Not Track visitors pass `optout`.
2. Stripe sends signed `checkout.session.completed` and `checkout.session.async_payment_succeeded` snapshot events to `POST /stripe/webhook`.
3. The handler checks the raw-body signature and five-minute timestamp tolerance. It accepts only live, paid, one-time sessions from the exact workshop payment link. It ignores other Adcrate payments, unpaid/test sessions and unsupported events.
4. Eligible purchases send Meta `Purchase` with the Stripe session ID as `event_id` and `order_id`. Retries use that same ID for Meta deduplication. Customer matching fields are hashed, and the event reports Stripe's actual paid total and currency, including tax and local pricing. An untaxed base ticket is USD97.
5. Meta failures or missing acknowledgement return HTTP502 so Stripe retries. Opt-outs never send a Meta Purchase. The public booked page does not verify payment or emit browser purchase events.

`GET /` is a basic process health check; it does not verify downstream credentials. Browser return visits are not needed to record payment.

## Existing production service

| Resource | Identifier |
| --- | --- |
| Railway project | `ai-with-ali-checkout` / `b038a50d-1d35-462e-91bd-fba2b83814e5` |
| Environment | production / `2a6a59ab-6fca-4aa7-a75b-4ddde27d2865` |
| Function | meta-capi / `14c3b373-5477-4b02-b3aa-14ccbe8a952c` |
| Webhook URL | `https://meta-capi-production-6e21.up.railway.app/stripe/webhook` |
| Stripe endpoint | `we_1UVSi4GUKYQC9sJNAUTB3vDQ`, snapshot API 2022-11-15 |
| Workshop payment link | `plink_1UUtKzGUKYQC9sJNfefzx2NZ` |
| Meta dataset | `1167132298977136` |
| Runtime | Railway Function, Bun 1.4.4 |
| Source deployment | `fa3ebc20-e932-4204-b05d-35dab60601a6`, SUCCESS observed 28 October 2026 UTC |

Keep one function instance of this integration; do not provision a second webhook consumer merely to deploy a source change. The unused `checkout-api` service is not required.

## Configuration

Store credentials only in Railway variables. Never put secret values in source, frontend code, test fixtures, screenshots or PRs.

| Variable | Purpose |
| --- | --- |
| `STRIPE_WEBHOOK_SECRET` | Required signing secret for the existing Stripe endpoint. |
| `META_ACCESS_TOKEN` | Required event-write credential for the intended dataset. |
| `META_PIXEL_ID` | Dataset identifier; defaults to the existing workshop dataset. |
| `META_GRAPH_VERSION` | Optional Graph API version override; source currently defaults to v26.0. |
| `STRIPE_PAYMENT_LINKS` | Optional comma-separated allowlist; defaults to the exact existing workshop link. Do not broaden it to unrelated products. |
| `META_TEST_EVENT_CODE` | Optional Meta Test Events routing code. Leave unset for normal production delivery. |
| `PORT` | Provided by Railway; defaults to 3000 locally. |

The existing legacy `ALLOW_TEST_MODE` variable is not used by the hardened handler. Test Stripe sessions are always rejected by this production source. Do not toggle live configuration to rehearse a sandbox flow.

No Kit buyer fulfillment or GA4 purchase submission is implemented here. Paid-buyer email automation is a separate integration; a valid payment must not imply marketing consent.

## Validation

Run tests with Node 24+; no dependency installation or external API calls are required:

```sh
cd services/meta-capi
npm test
```

The 21 tests invoke the real handler with a stubbed Bun server and stubbed Meta transport. They cover valid USD97 purchase payloads, hashed matching data, exact payment-link restriction, unpaid/test/subscription rejection, opt-outs, expired/invalid signatures and timestamps, invalid JSON, delayed payment success, stable retry event IDs, tax/local currency amounts, and retryable downstream failures. Fixtures contain synthetic data and fake credentials only.

Production verification performed 29 October 2026 Dubai time:

- Deployed source observed SUCCESS; health 200; unsigned/stale requests 400; signed ineligible events skipped.
- A direct Meta CAPI **Purchase event routed with `test_event_code`** returned HTTP 200, `events_received:1`, and no messages. Events Manager showed that Purchase as Processed / Server / Manual setup with the same `cs_test_` event ID. This was visible only in Meta Test Events; no production conversion or Stripe transaction was created.
- That direct Meta check validates the event-write credential and transport, not Stripe delivery end to end. A Stripe-generated sandbox webhook rehearsal remains outstanding because the session had no Stripe CLI or Composio Stripe connection. No paid test transaction was performed.

## Updating the existing Function

Read the currently deployed Function source first and compare it with this directory. The canonical deployable file is `meta-capi.ts`; Railway's Function editor/runtime stores it as `index.tsx`.

After tests and review, replace the existing Function's complete source with this file through Railway's Function source editor or `update-function-source-code` tool, preserving existing variables and endpoint. This operation deploys immediately unless staged. Do not run a bare new-project deployment from this directory. Observe SUCCESS for the exact deployment and verify health/signature rejection before claiming completion. Roll back using the previous Railway deployment/source if needed.

When changing payment eligibility or fulfillment, verify the exact intended Stripe product/link and use an isolated sandbox for Stripe-generated tests. Do not manufacture paid live Stripe events or generate production Purchase events for a test.

## Optional buyer fulfillment adapter (not deployed)

`kit-fulfillment.ts` is a dormant adapter prepared for the buyer email integration. It is **not imported by `meta-capi.ts`**, not deployed, and cannot send email or call Kit merely by merging this PR. It is disabled unless `KIT_FULFILLMENT_ENABLED` is exactly `true`; enabling a variable alone on the existing Function does not wire it in.

Its additional configuration names are `KIT_FULFILLMENT_ENABLED`, `KIT_API_KEY` and optional `KIT_BUYER_TAG_ID`. Keep the flag false/unset and do not create or copy a credential without the approved access grant. The buyer tag defaults to `25020379`. The intended native Kit automation is buyer tag → booking sequence `2948382`; automation `2155405` is being configured separately and remains paused until release.

The adapter revalidates paid workshop eligibility, upserts the buyer, and adds only the buyer tag. It never sets an offers/marketing-consent tag or directly reenrolls a sequence. Kit's upsert preserves an existing subscriber's state; the adapter requires manual delivery for a non-active subscriber rather than reactivating them. Marketing broadcasts must still require the separate explicit consent segment. A newly active Kit record is not evidence of marketing consent.

`processVerifiedWorkshopPurchase` is an integration helper for use **after raw-body Stripe signature verification**. It starts Meta and Kit effects independently. Meta privacy opt-out skips tracking only; it does not skip buyer fulfillment. Meta failure cannot prevent Kit from running. A failed effect requests a webhook retry, while already-applied buyer tags return HTTP200 from Kit without adding a new tag transition. Keep the native buyer automation limited to one enrollment per subscriber; do not remove/re-add the tag on retries.

Before wiring this helper into production:

1. Verify the native automation's buyer-tag trigger, one-time enrollment, booking sequence content, refund suppression and sending-domain settings. Leave it paused until the release checks pass.
2. Obtain approved Kit access and supply the secret through Railway variables. Do not copy a broad Composio credential into Railway.
3. Inline the adapter functions into the Railway Function's complete single-file source (relative imports are not supported by that runtime), and replace the current Meta-only side-effect block with the helper. Handle its `retry` result with HTTP502 and report `manual_delivery_required` for operator action without logging buyer PII. Preserve the verified-signature and payment-eligibility boundaries.
4. Rehearse normal payment, privacy opt-out, provider failure, replay and refund suppression with an isolated test workflow before enabling delivery. No Kit calls or emails have been sent by these tests.

There are 12 additional isolated adapter tests, bringing `npm test` to 33 passing tests. They cover default-off behavior, explicit configuration, paid-only eligibility, privacy-independent fulfillment, provider failure isolation, idempotent tagging rather than sequence reenrollment, unsubscribed-state preservation and missing buyer email. These tests do not establish exactly-once delivery by Kit; that final behavior also depends on the native automation settings and a release rehearsal.

Primary API references: [subscriber upsert](https://developers.kit.com/api-reference/subscribers/create-a-subscriber), [tag a subscriber](https://developers.kit.com/api-reference/tags/tag-a-subscriber). The latter documents HTTP200 when the subscriber already has the tag.
