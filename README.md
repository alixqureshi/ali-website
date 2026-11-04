# aliqureshi.co

Ali Qureshi’s personal website. Static HTML, CSS and JavaScript, deployed by GitHub Pages from `main`.

## Pages

- `/` — Home C: type, navy pixel texture and a compact name wordmark.
- `/work-with-me/` — AI consulting, implementation and training.
- `/ai-with-ali/` — newsletter signup, Dubai pixel animation and an interactive library of published editions.
- `/workshops/build-your-ai-brain/`: $97 workshop landing page (v5 design). Styles in `assets/workshop-v5.css`; booking and Stripe reference in `assets/workshop.js`.
- `/privacy/` and `/terms/` — privacy policy and workshop ticket terms. They load no pixel or analytics. Update them if the processors, tracking or ticket terms change.
- `/contact/` — two-step enquiry form. Enquiries are saved to Notion through `workers/enquiry`.

`/about/` redirects home. Old newsletter and playbook URLs redirect to AI with Ali. The independent tools and lead magnet pages remain in place.

## Preview

Run `npx live-server . --host=127.0.0.1 --port=8092 --no-browser` and open http://127.0.0.1:8092.

## Integrations

- Contact posts to the enquiry Worker (`workers/enquiry`, Cloudflare), which adds a row to the "Website enquiries" database in Notion (AI with Ali · Base camp). Its URL (https://ali-enquiry.ali-e80.workers.dev) is `ENQUIRY_ENDPOINT` in `assets/site-v2.js`. The Notion token is a Worker secret (`npx wrangler secret put NOTION_TOKEN`), never in this repo. If the endpoint is empty or the request fails, the form opens an email draft instead and says so.
- Newsletter signup posts to the existing public Kit form. If Kit needs additional verification, the form links to the hosted signup rather than claiming success.
- `.github/workflows/fetch-posts.yml` refreshes `posts.json` from published Kit broadcasts. Only real, public editions appear in the bookshelf. Keep private API credentials in GitHub Actions secrets, never in frontend code.
- The workshop page sells a USD97 ticket through Stripe for “Build Your AI Team”, 19 November 2026, 16:00–18:00 UK. The buyer pack is the company brain files, four skill files, an agent template, the 7-day plan and recording. The booked route is a public details page, not a payment verification endpoint. Buyer confirmation and joining instructions must be driven by verified payment automation.
- The video honours reduced motion. The newsletter library supports keyboard navigation and returns focus when closed. Without JavaScript the library remains visible.

## Meta pixel

The five marketing pages load `assets/meta-pixel.js` with dataset/pixel ID
`1167132298977136` (AI with Ali). It sends one explicit `PageView` per page load,
only on `aliqureshi.co` and `www.aliqureshi.co`. Local previews, Global Privacy
Control and Do Not Track opt-outs do not load Meta's script. Automatic event
configuration is disabled; no form fields or advanced-matching data are supplied.
The homepage includes the portfolio's `facebook-domain-verification` meta tag.
Domain verification still needs completing in Meta after deployment.

There is no existing consent manager on this site. If one is added, gate this
script on marketing consent. No noscript image bypass is installed.

### Workshop Purchase

`Purchase` is sent only by the `meta-capi` Railway Function (project
`ai-with-ali-checkout`) after a signed Stripe webhook confirms a paid, live
checkout for the workshop. The browser does not trust `session_id` query
parameters or emit Meta/Google purchase events. `assets/workshop-booked.js`
removes the checkout identifier before analytics loads; it does not verify payment.

The workshop page passes the visitor's `_fbp` and `_fbc` values to Stripe as
`client_reference_id` (format `a1-…`, documented in `assets/workshop.js`) so
the server event can be matched to the ad click. Visitors with Global Privacy
Control or Do Not Track send `optout` instead, and the server skips their
Purchase, matching the pixel's behaviour.

The Stripe webhook signing secret and the Conversions API token live only in
Railway variables, never in this repository.

The existing Function source, configuration notes and handler tests are versioned
in [`services/meta-capi/`](services/meta-capi/README.md). Website deployment does
not redeploy that Function.

### Leads and signups

Two browser events, sent only when the pixel and GA loaded (production, no
opt-out) and carrying no form answers:

- A saved enquiry on `/contact/` sends Meta `Lead` and GA `generate_lead`
  (`assets/site-v2.js`). The email-draft fallback sends nothing, because the
  enquiry is not confirmed.
- A confirmed Kit newsletter signup sends Meta `CompleteRegistration` and GA
  `sign_up` (`assets/site.js`).

`assets/site.js` also keeps the visitor's first UTMs, referring site and landing
page in `localStorage` (`aiWithAliSource`, 90 days, replaced by a new UTM visit).
The enquiry form sends them to the Worker, which fills the UTM source, UTM
campaign and Source detail columns in Notion.

## Google Analytics

The same five marketing pages load `assets/analytics.js`, configured by
`data-measurement-id="G-D74XK8FM1T"` on each script tag. The **AI with Ali** account
(`413490358`) belongs to `ali@adcrate.co`; property **aliqureshi.co** (`560833513`)
uses Europe/London time and USD. The web stream is **AI with Ali website**
(`16207726510`).

The tag measures standard page views on `aliqureshi.co` and `www.aliqureshi.co`.
Enhanced measurement is off in the stream, so automatic form interactions and
outbound-link details are not collected. No submitted contact fields or purchase events are sent; the
`generate_lead` and `sign_up` events above are the only custom events. Mark
`generate_lead` as a key event in GA (Admin, Events). Google signals and ad personalization are disabled in
the tag configuration. Local previews, Global Privacy Control, Do Not Track and
the standard `ga-disable-G-D74XK8FM1T` opt-out skip the Google script. A per-page
guard prevents duplicate initialization. If a consent manager is added, gate
this script on analytics consent.

## Assets and styling

`assets/site.css` contains the shared visual system. `assets/site.js` handles forms, the newsletter library and reduced motion. Pixel illustrations are SVGs exported from the approved Paper designs. The six-second Dubai loop is local and has no audio.

Motion stays in the shared CSS: short stepped heading reveals, staggered content entrances, a library entrance and button feedback. Native cross-document view transitions add a quick page crossfade in supporting browsers. Motion runs only when `prefers-reduced-motion` is `no-preference`; content and navigation work without it. The newsletter uses a navy gradient over the upper artwork rather than dimming the entire video, and has no footer bar.

Deploy through a feature branch and PR to `main`. Verify the Pages build and live routes after merging. No frontend build or package installation is needed for production.
