# aliqureshi.co

Personal site. Static HTML, deployed via GitHub Pages.

## Structure

- `index.html` — the site (single page, builder's notebook aesthetic)
- `lp/template.html` — copy this for new lead magnet pages
- `legacy/` — previous version of the site, preserved
- Redirect files at `/consulting.html`, `/ai-audit.html`, `/newsletter.html`, `/azadea.html`, and `/<lead-magnet>/index.html` route old URLs to their `/legacy/` equivalents

## Adding a new lead magnet page

1. Copy `lp/template.html` → `<slug>/index.html`
2. Swap the title, question, reply line, and Kit form values
3. Commit; GitHub Pages deploys it at `aliqureshi.co/<slug>`
