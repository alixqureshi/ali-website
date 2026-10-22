# aliqureshi.co

Ali Qureshi’s personal website. Static HTML, CSS and JavaScript, deployed by GitHub Pages from `main`.

## Pages

- `/` — Home C: type, navy pixel texture and a compact name wordmark.
- `/work-with-me/` — AI consulting, implementation and training.
- `/ai-with-ali/` — newsletter signup, Dubai pixel animation and an interactive library of published editions.
- `/workshops/build-your-ai-brain/` — workshop interest page.
- `/contact/` — enquiries through the visitor’s email app.

`/about/` redirects home. Old newsletter and playbook URLs redirect to AI with Ali. The independent tools and lead magnet pages remain in place.

## Preview

Run `npx live-server . --host=127.0.0.1 --port=8092 --no-browser` and open http://127.0.0.1:8092.

## Integrations

- Contact is a mailto draft, not a server submission. The visitor must send the draft in their email app. A status message states that explicitly.
- Newsletter signup posts to the existing public Kit form. If Kit needs additional verification, the form links to the hosted signup rather than claiming success.
- `.github/workflows/fetch-posts.yml` refreshes `posts.json` from published Kit broadcasts. Only real, public editions appear in the bookshelf. Keep private API credentials in GitHub Actions secrets, never in frontend code.
- The workshop currently accepts enquiries. It has no payment link, final ticket price, session date or automated attendee email sequence yet.
- The video honours reduced motion. The newsletter library supports keyboard navigation and returns focus when closed. Without JavaScript the library remains visible.

## Assets and styling

`assets/site.css` contains the shared visual system. `assets/site.js` handles forms, the newsletter library and reduced motion. Pixel illustrations are SVGs exported from the approved Paper designs. The six-second Dubai loop is local and has no audio.

Motion stays in the shared CSS: short stepped heading reveals, staggered content entrances, a library entrance and button feedback. Native cross-document view transitions add a quick page crossfade in supporting browsers. Motion runs only when `prefers-reduced-motion` is `no-preference`; content and navigation work without it. The newsletter uses a navy gradient over the upper artwork rather than dimming the entire video, and has no footer bar.

Deploy through a feature branch and PR to `main`. Verify the Pages build and live routes after merging. No frontend build or package installation is needed for production.
