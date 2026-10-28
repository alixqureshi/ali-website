// AI with Ali: verified Stripe checkout -> Meta Purchase and Kit buyer tagging.
//
// Stripe sends checkout.session.completed here. For a paid, live session that
// came from the workshop payment link, this sends one Purchase to Meta with the
// Stripe session ID as event_id. Purchase is emitted only here, from verified
// payment events, so a forged return URL cannot create a Purchase.
//
// Variables:
//   STRIPE_WEBHOOK_SECRET  whsec_... from the Stripe webhook endpoint (secret)
//   META_ACCESS_TOKEN      Conversions API token for the pixel (secret)
//   META_PIXEL_ID          defaults to the AI with Ali pixel
//   META_TEST_EVENT_CODE   optional, routes events to Test events in Events Manager
//   STRIPE_PAYMENT_LINKS   optional, comma separated plink_ IDs to accept
//   KIT_API_KEY            Kit v4 key for the dedicated buyer integration (secret)
//   KIT_FULFILLMENT_ENABLED "true" enables buyer tagging, default off
//   KIT_BUYER_TAG_ID        optional, defaults to the workshop buyer tag

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const env = Bun.env;
const PIXEL_ID = env.META_PIXEL_ID || "1167132298977136";
const GRAPH_VERSION = env.META_GRAPH_VERSION || "v26.0";
const BOOKED_URL = "https://aliqureshi.co/workshops/build-your-ai-brain/booked/";
const TOLERANCE_SECONDS = 300;
const WORKSHOP_PAYMENT_LINK = "plink_1UUtKzGUKYQC9sJNfefzx2NZ";
const HANDLED = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const clean = (v?: string | null) => (v || "").trim().toLowerCase();
const hash = (v?: string | null) => (clean(v) ? [sha256(clean(v))] : undefined);

function verifyStripe(raw: string, header: string | null): boolean {
  const secret = env.STRIPE_WEBHOOK_SECRET || "";
  if (!header || !secret.startsWith("whsec_")) return false;
  const parts = header.split(",").map((p) => {
    const i = p.indexOf("=");
    return [p.slice(0, i), p.slice(i + 1)];
  });
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !/^\d+$/.test(t) || !Number.isSafeInteger(Number(t)) || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest();
  return sigs.some((s) => {
    if (!/^[a-f0-9]{64}$/i.test(s)) return false;
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

// The workshop page passes Meta's browser IDs in client_reference_id, because a
// payment link only accepts letters, digits, dashes and underscores:
//   a1-<fbp version>-<fbp time>-<fbp random>-<fbc version>-<fbc time>-<fbclid>
// "optout" means the visitor sent Global Privacy Control or Do Not Track.
function browserIds(ref?: string | null) {
  if (!ref || !ref.startsWith("a1-")) return {};
  const [, pv, pt, pr, cv, ct, ...rest] = ref.split("-");
  const fbclid = rest.join("-");
  return {
    fbp: pv && pt && pr ? `fb.${pv}.${pt}.${pr}` : undefined,
    fbc: cv && ct && fbclid ? `fb.${cv}.${ct}.${fbclid}` : undefined,
  };
}

function userData(session: any) {
  const d = session.customer_details || {};
  const a = d.address || {};
  const [first, ...last] = clean(d.name).split(/\s+/);
  const phone = (d.phone || "").replace(/\D/g, "");
  const ids = browserIds(session.client_reference_id);
  return {
    em: hash(d.email),
    ph: phone ? [sha256(phone)] : undefined,
    fn: hash(first),
    ln: hash(last.join(" ")),
    ct: hash(clean(a.city).replace(/\s+/g, "")),
    zp: hash(clean(a.postal_code).replace(/\s+/g, "")),
    country: hash(a.country),
    fbp: ids.fbp,
    fbc: ids.fbc,
  };
}

// Report Stripe's settled checkout total and currency, including tax/local pricing.
// The client never guesses a $97 purchase from an unverified return URL.
function amount(session: any) {
  const currency = (session.currency || "").toUpperCase();
  const zeroDecimal = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
  const threeDecimal = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);
  const divisor = zeroDecimal.has(currency) ? 1 : threeDecimal.has(currency) ? 1000 : 100;
  return { value: session.amount_total / divisor, currency };
}

function skipReason(event: any, session: any): string | null {
  if (!HANDLED.has(event.type)) return `event ${event.type}`;
  if (event.livemode !== true || session.livemode !== true) return "test mode";
  if (session.object !== "checkout.session" || !/^cs_live_[A-Za-z0-9]+$/.test(session.id || "")) return "invalid checkout session";
  if (session.mode !== "payment" || session.payment_status !== "paid") return "payment not completed";
  if (!Number.isSafeInteger(session.amount_total) || session.amount_total <= 0 || !/^[a-z]{3}$/.test(session.currency || "")) return "invalid payment amount";
  if (!Number.isSafeInteger(event.created) || event.created <= 0) return "invalid event time";
  const links = (env.STRIPE_PAYMENT_LINKS || WORKSHOP_PAYMENT_LINK).split(",").map((s) => s.trim()).filter(Boolean);
  if (!links.includes(session.payment_link)) return "other payment link";
  return null;
}

async function sendPurchase(event: any, session: any) {
  const token = env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN is not set");
  const { value, currency } = amount(session);
  const body: Record<string, unknown> = {
    access_token: token,
    data: [
      {
        event_name: "Purchase",
        event_time: event.created,
        event_id: session.id,
        action_source: "website",
        event_source_url: BOOKED_URL,
        user_data: userData(session),
        custom_data: {
          value,
          currency,
          content_name: "The AI setup I run my business on",
          content_type: "product",
          order_id: session.id,
        },
      },
    ],
  };
  if (env.META_TEST_EVENT_CODE) body.test_event_code = env.META_TEST_EVENT_CODE;
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Meta HTTP ${res.status}`);
  const result = JSON.parse(text);
  if (result.events_received !== 1) throw new Error("Meta did not accept the Purchase event");
  return { value, currency, meta: `events_received=${result.events_received}` };
}

// BEGIN INLINED KIT FULFILLMENT
// Buyer fulfillment integration. Inlined into the Railway Function by sync-fulfillment.mjs.
// Caller must verify Stripe's raw-body signature before invoking this module.
const WORKSHOP_LINK = "plink_1UUtKzGUKYQC9sJNfefzx2NZ";
type Config = Record<string, string | undefined>;
type Transport = typeof fetch;

function isPaidWorkshop(event: any, config: Config): boolean {
  const s = event?.data?.object;
  const links = (config.STRIPE_PAYMENT_LINKS || WORKSHOP_LINK).split(",").map(x => x.trim()).filter(Boolean);
  return ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event?.type)
    && event.livemode === true && s?.livemode === true
    && s.object === "checkout.session" && /^cs_live_[A-Za-z0-9]+$/.test(s.id || "")
    && s.mode === "payment" && s.payment_status === "paid"
    && Number.isSafeInteger(s.amount_total) && s.amount_total > 0
    && /^[a-z]{3}$/.test(s.currency || "") && links.includes(s.payment_link);
}

async function fulfillWorkshopBuyer(event: any, config: Config, transport: Transport = fetch) {
  if (config.KIT_FULFILLMENT_ENABLED !== "true") return { status: "disabled" };
  if (!isPaidWorkshop(event, config)) return { status: "ineligible" };
  if (!config.KIT_API_KEY) throw new Error("KIT_API_KEY is required when fulfillment is enabled");
  const tag = config.KIT_BUYER_TAG_ID || "25020379";
  if (!/^\d+$/.test(tag)) throw new Error("Invalid KIT_BUYER_TAG_ID");
  const session = event.data.object;
  const email = String(session.customer_details?.email || session.customer_email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Paid buyer email is unavailable; manual fulfillment required");
  async function request(path: string, body: unknown) {
    const res = await transport(`https://api.kit.com/v4${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Kit-Api-Key": config.KIT_API_KEY! },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    // Never log provider payloads, buyer details, or credentials on failure.
    if (!res.ok) throw new Error(`Kit HTTP ${res.status}`);
    return res.json();
  }
  // Kit's documented upsert preserves existing subscriber state; it does not
  // reactivate an unsubscribed subscriber. No marketing-consent tag is applied.
  const result = await request("/subscribers", { email_address: email, state: "active" });
  const subscriber = result.subscriber;
  if (!Number.isSafeInteger(subscriber?.id) || subscriber.id <= 0) throw new Error("Kit did not acknowledge a subscriber");
  if (subscriber.state !== "active") return { status: "manual_delivery_required", reason: "subscriber_not_active" };
  // Tagging an already-tagged subscriber returns200 rather than creating a new
  // subscription. Let the single native buyer-tag automation enroll the sequence;
  // do not add them to the sequence on every Stripe/Meta retry.
  const tagged = await request(`/tags/${tag}/subscribers/${subscriber.id}`, {});
  if (tagged.subscriber?.id !== subscriber.id) throw new Error("Kit did not acknowledge the buyer tag");
  return { status: "tagged", subscriberId: subscriber.id };
}

async function processVerifiedWorkshopPurchase(
  event: any,
  config: Config,
  sendMeta: (event: any, session: any) => Promise<unknown>,
  transport: Transport = fetch,
) {
  if (!isPaidWorkshop(event, config)) return { status: "ineligible", retry: false };
  // Both effects start independently. Tracking opt-out affects Meta only, and
  // Meta errors cannot prevent the buyer's confirmation workflow from running.
  const meta = event.data.object.client_reference_id === "optout"
    ? Promise.resolve({ status: "privacy_opt_out" })
    : Promise.resolve().then(() => sendMeta(event, event.data.object));
  const [metaResult, buyerResult] = await Promise.allSettled([
    meta, fulfillWorkshopBuyer(event, config, transport),
  ]);
  return { status: "processed", meta: metaResult, buyer: buyerResult,
    retry: metaResult.status === "rejected" || buyerResult.status === "rejected" };
}
// END INLINED KIT FULFILLMENT

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

Bun.serve({
  port: Number(env.PORT) || 3000,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") return json(200, { ok: true });
    if (req.method !== "POST" || url.pathname !== "/stripe/webhook") return json(404, { error: "not found" });

    const raw = await req.text();
    if (!verifyStripe(raw, req.headers.get("stripe-signature"))) {
      console.warn("rejected: bad or missing Stripe signature");
      return json(400, { error: "invalid signature" });
    }

    let event: any;
    try { event = JSON.parse(raw); } catch { return json(400, { error: "invalid JSON" }); }
    const session = event.data?.object || {};
    const reason = skipReason(event, session);
    if (reason) {
      console.log(`skipped ${event.id}: ${reason}`);
      return json(200, { skipped: reason });
    }

    const effects = await processVerifiedWorkshopPurchase(event, env, sendPurchase);
    const buyer = effects.buyer!;
    const meta = effects.meta!;
    const privacyOptOut = session.client_reference_id === "optout";
    const buyerStatus = buyer.status === "fulfilled" ? buyer.value.status : "failed";
    if (effects.retry) {
      // Both effects already ran. Retry keeps Meta's event ID and Kit's buyer tag.
      console.error(`purchase effects failed ${session.id}: meta=${meta.status} buyer=${buyerStatus}`);
      return json(502, { error: "purchase processing incomplete", buyer: buyerStatus });
    }
    if (buyerStatus === "manual_delivery_required") {
      console.warn(`manual buyer delivery required ${session.id}`);
    }
    console.log(`processed Purchase ${session.id}: meta=${privacyOptOut ? "privacy_opt_out" : "sent"} buyer=${buyerStatus}`);
    return json(200, { sent: !privacyOptOut, buyer: buyerStatus,
      ...(privacyOptOut ? { skipped: "visitor opted out" } : {}) });

  },
});

console.log("meta-capi listening");
