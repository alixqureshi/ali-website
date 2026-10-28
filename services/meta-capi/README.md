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
| Prior CAPI-only deployment | `fa3ebc20-e932-4204-b05d-35dab60601a6`, SUCCESS observed 28 October 2026 UTC |

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

GA4 purchase submission is not implemented here. Kit buyer tagging is wired separately from marketing consent; email sending still depends on the native automation and sequence release state.

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

## Buyer fulfillment integration

`kit-fulfillment.ts` is the readable Kit adapter. `sync-fulfillment.mjs` embeds it into `meta-capi.ts` so the Railway Function remains a single self-contained file with no relative imports. After changing the adapter run `npm run sync`, then `npm test`; tests fail if the embedded source is stale. Deploy only `meta-capi.ts`.

Buyer tagging is disabled unless `KIT_FULFILLMENT_ENABLED` is exactly `true`. Additional variables:

| Variable | Purpose |
| --- | --- |
| `KIT_FULFILLMENT_ENABLED` | Explicit opt-in to buyer tagging; default off. |
| `KIT_API_KEY` | Dedicated Kit v4 integration key stored only in Railway. |
| `KIT_BUYER_TAG_ID` | Optional override; defaults to buyer tag `25020379`. |

The intended native Kit automation `2155405` runs buyer tag → remove welcome-active → booking sequence `2948382`. That automation and sequence must remain inactive with unpublished emails during setup; sequence repeat is false. Tagging alone must not be described as a sent buyer confirmation. Check the live automation/sequence state before activating delivery.

After verified payment, the handler starts Meta and Kit independently. Meta tracking opt-out skips Meta only; it still fulfills the buyer. Meta failure cannot prevent Kit from running. A provider failure returns HTTP502 so Stripe retries, retaining the Meta session event ID and the same Kit buyer tag. Kit documents HTTP200 when a subscriber already has a tag, so retries do not create a new tag transition. The native booking sequence must also retain one-time enrollment; do not remove/re-add buyer tags on retries.

The adapter upserts and tags buyers, without setting offers/marketing-consent tags or enrolling a sequence directly. Kit's documented upsert preserves an existing subscriber's state. For non-active subscribers the handler returns and logs `manual_delivery_required` rather than reactivating them. Handle these manually through a suitable transactional delivery route; do not interpret the webhook's HTTP200 as email delivery. Marketing broadcasts must still require the separate explicit-consent segment. A newly active Kit record is not marketing consent.

41 isolated tests run without network access: 21 original CAPI tests, 12 adapter tests, and 8 tests exercising the exact self-contained handler with both providers enabled. They cover privacy opt-out, failure isolation, webhook replay, subscriber state, paid-link restrictions, and unsigned/test rejection. No real buyer or email is created by these tests.

## Refund suppression boundary

Automatic refunds are not implemented. The current Stripe endpoint subscribes only to paid checkout events. A generic `charge.refunded` event from the shared Adcrate account does not identify the workshop payment link. There is no Stripe API credential or durable session/payment-intent ledger in this service to establish that relationship. Do not guess from buyer email or amount; that could suppress workshop access after an unrelated Adcrate refund.

Before any refund is processed for this workshop, an operator must verify the exact workshop purchase in Stripe and apply Kit refund tag `25020380` to that buyer. The booking sequence, buyer segment and prospect segment exclude that tag. This tags/suppresses delivery only; it does not create a Stripe refund. Do not remove the buyer tag and re-add it later as a workaround, because that can retrigger automation. Automated refund handling requires an authoritative payment-intent→workshop mapping and replay/out-of-order tests before adding a signed refund-event subscription.

## Safe release checks

1. Store the approved dedicated key in Railway and verify it by a read-only Kit account request without exposing it. Check enabled/disabled flag names, intended tag and native flow/sequence states.
2. Deploy the self-contained source to the existing Function. Observe SUCCESS for that exact deployment, compare source readback and verify health plus unsigned/test/ineligible payload rejection.
3. Verify both providers in the local handler tests. Do not send a synthetic paid live buyer through production. Use an isolated Stripe sandbox and separate Kit test workflow for a real provider integration rehearsal once available. Keep live automation inactive until buyer delivery is explicitly released.

Primary API references: [subscriber upsert](https://developers.kit.com/api-reference/subscribers/create-a-subscriber), [tag a subscriber](https://developers.kit.com/api-reference/tags/tag-a-subscriber). The latter documents HTTP200 when the subscriber already has the tag.
