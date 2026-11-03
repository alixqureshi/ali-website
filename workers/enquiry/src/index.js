/* Saves one contact form enquiry as a row in the Notion "Website enquiries" database.
   The site posts JSON here; the Notion token stays in a Worker secret. */

const CHOICES = {
  team_size: ["1-10", "11-50", "51-200", "200+"],
  interest: ["Team training", "AI brain and agent install", "Bespoke builds", "Not sure yet"],
  timing: ["This month", "Next quarter", "Later this year", "Just exploring"],
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGINS.split(",").includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : "https://aliqureshi.co",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply(405, { error: "Use POST." });
    if (!allowed) return reply(403, { error: "Unknown origin." });

    let data;
    try {
      data = await request.json();
    } catch {
      return reply(400, { error: "Send JSON." });
    }
    // Spam trap: a bot filled the hidden field. Pretend it worked.
    if (data.website) return reply(200, { ok: true });

    const text = (key, max = 500) => String(data[key] || "").trim().slice(0, max);
    const enquiry = {
      name: text("name", 120),
      email: text("email", 200),
      company: text("company", 200),
      role: text("role", 120),
      firstJob: text("first_job", 1000),
      utmSource: text("utm_source", 100),
      utmCampaign: text("utm_campaign", 100),
      sourceDetail: text("source_detail", 1000),
    };
    if (!enquiry.name || !enquiry.company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email))
      return reply(400, { error: "Name, a valid email and company are required." });
    for (const key of Object.keys(CHOICES))
      if (!CHOICES[key].includes(data[key])) return reply(400, { error: "Pick an option for " + key + "." });

    const richText = (value) => ({ rich_text: value ? [{ text: { content: value } }] : [] });
    const select = (value) => ({ select: { name: value } });
    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.NOTION_TOKEN,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: env.NOTION_DATA_SOURCE_ID },
        properties: {
          Name: { title: [{ text: { content: enquiry.name } }] },
          Email: { email: enquiry.email },
          Company: richText(enquiry.company),
          Role: richText(enquiry.role),
          "Team size": select(data.team_size),
          "Interested in": select(data.interest),
          Timing: select(data.timing),
          "First job for AI": richText(enquiry.firstJob),
          "UTM source": richText(enquiry.utmSource),
          "UTM campaign": richText(enquiry.utmCampaign),
          "Source detail": richText(enquiry.sourceDetail),
          Source: select("Website contact form"),
        },
      }),
    });
    if (!response.ok) {
      console.error("Notion error", response.status, await response.text());
      return reply(502, { error: "Could not save the enquiry." });
    }
    return reply(200, { ok: true });
  },
};
