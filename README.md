# aliqureshi.co

Ali Qureshi’s personal website. Static HTML, CSS and JavaScript, deployed by GitHub Pages from `main`.

## Pages

- `/` — Home C: type, navy pixel texture and a compact name wordmark.
- `/work-with-me/` — AI consulting, implementation and training.
- `/ai-with-ali/` — newsletter signup, Dubai pixel animation and an interactive library of published editions.
- `/workshops/build-your-ai-brain/`: $97 workshop landing page (v5 design). Styles in `assets/workshop-v5.css`; booking and Stripe reference in `assets/workshop.js`.
- `/contact/` — enquiries through the visitor’s email app.

`/about/` redirects home. Old newsletter and playbook URLs redirect to AI with Ali. The independent tools and lead magnet pages remain in place.

## Preview

Run `npx live-server . --host=127.0.0.1 --port=8092 --no-browser` and open http://127.0.0.1:8092.

## Integrations

- Contact is a mailto draft, not a server submission. The visitor must send the draft in their email app. A status message states that explicitly.
- Newsletter signup posts to the existing public Kit form. If Kit needs additional verification, the form links to the hosted signup rather than claiming success.
- `.github/workflows/fetch-posts.yml` refreshes `posts.json` from published Kit broadcasts. Only real, public editions appear in the bookshelf. Keep private API credentials in GitHub Actions secrets, never in frontend code.
- The workshop page lists the USD97 ticket, the call-notes-to-proposal demonstration, DIY materials and an optional USD999 setup. It currently accepts enquiries: there is no payment link, confirmed session date or automated attendee email sequence. Do not describe its enquiry CTA as a paid booking.
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

`Purchase` is sent twice with the same event ID (the Stripe checkout session
ID), and Meta keeps one:

- **Browser:** `assets/workshop-booked.js` fires it on the booked page when the
  Stripe redirect carries a `cs_live_` session ID. Test sessions are ignored.
- **Server:** the `meta-capi` Railway Function (project `ai-with-ali-checkout`)
  receives Stripe's `checkout.session.completed` webhook at
  `/stripe/webhook`, checks the signature, and sends the Purchase through the
  Conversions API with hashed buyer details. It only sends paid, live sessions
  whose success URL is the booked page. This catches buyers who never reach the
  booked page.

The workshop page passes the visitor's `_fbp` and `_fbc` values to Stripe as
`client_reference_id` (format `a1-…`, documented in `assets/workshop.js`) so
the server event can be matched to the ad click. Visitors with Global Privacy
Control or Do Not Track send `optout` instead, and the server skips their
Purchase, matching the pixel's behaviour.

The Stripe webhook signing secret and the Conversions API token live only in
Railway variables, never in this repository.

## Google Analytics

The same five marketing pages load `assets/analytics.js`, configured by
`data-measurement-id="G-D74XK8FM1T"` on each script tag. The **AI with Ali** account
(`413490358`) belongs to `ali@adcrate.co`; property **aliqureshi.co** (`560833513`)
uses Europe/London time and USD. The web stream is **AI with Ali website**
(`16207726510`).

The tag measures standard page views on `aliqureshi.co` and `www.aliqureshi.co`.
Enhanced measurement is off in the stream, so automatic form interactions and
outbound-link details are not collected. No submitted contact fields or custom
purchase events are sent. Google signals and ad personalization are disabled in
the tag configuration. Local previews, Global Privacy Control, Do Not Track and
the standard `ga-disable-G-D74XK8FM1T` opt-out skip the Google script. A per-page
guard prevents duplicate initialization. If a consent manager is added, gate
this script on analytics consent.

## Assets and styling

`assets/site.css` contains the shared visual system. `assets/site.js` handles forms, the newsletter library and reduced motion. Pixel illustrations are SVGs exported from the approved Paper designs. The six-second Dubai loop is local and has no audio.

Motion stays in the shared CSS: short stepped heading reveals, staggered content entrances, a library entrance and button feedback. Native cross-document view transitions add a quick page crossfade in supporting browsers. Motion runs only when `prefers-reduced-motion` is `no-preference`; content and navigation work without it. The newsletter uses a navy gradient over the upper artwork rather than dimming the entire video, and has no footer bar.

Deploy through a feature branch and PR to `main`. Verify the Pages build and live routes after merging. No frontend build or package installation is needed for production.
