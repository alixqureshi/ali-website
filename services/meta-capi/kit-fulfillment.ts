// Optional integration draft. Not imported by the deployed Railway Function.
// Caller must verify Stripe's raw-body signature before invoking this module.
const WORKSHOP_LINK = "plink_1UUtKzGUKYQC9sJNfefzx2NZ";
type Config = Record<string, string | undefined>;
type Transport = typeof fetch;

export function isPaidWorkshop(event: any, config: Config): boolean {
  const s = event?.data?.object;
  const links = (config.STRIPE_PAYMENT_LINKS || WORKSHOP_LINK).split(",").map(x => x.trim()).filter(Boolean);
  return ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event?.type)
    && event.livemode === true && s?.livemode === true
    && s.object === "checkout.session" && /^cs_live_[A-Za-z0-9]+$/.test(s.id || "")
    && s.mode === "payment" && s.payment_status === "paid"
    && Number.isSafeInteger(s.amount_total) && s.amount_total > 0
    && /^[a-z]{3}$/.test(s.currency || "") && links.includes(s.payment_link);
}

export async function fulfillWorkshopBuyer(event: any, config: Config, transport: Transport = fetch) {
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

export async function processVerifiedWorkshopPurchase(
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
