# Ali Qureshi — Personal Website

Personal site for Ali Qureshi. Currently includes homepage, consulting page, and newsletter (Leverage Lab) signup.

---

## Design Language

### Aesthetic
Dark, editorial, typographically-driven. The site communicates through restraint — what's absent matters as much as what's present. No decoration for decoration's sake. Every element earns its space.

The visual identity sits at the intersection of editorial publishing and technical precision — serif headlines for personality, monospace body text for credibility.

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| Black | `#0a0a0a` | Primary background |
| Off-white | `#f5f5f0` | Primary text, button fills, accents |
| Gray | `#6b6b6b` | Secondary text, muted labels, link borders |
| Surface alt | `#0f0f0f` | Alternate section backgrounds (proof sections) |
| Border | `#1a1a1a` | Section dividers, list item separators |
| Input bg | `#151515` | Form input backgrounds |
| Input border | `#2a2a2a` | Form input borders |

**Rules:**
- Never use pure white (`#ffffff`) — always `#f5f5f0` (warm, not clinical)
- Never use pure black (`#000000`) — always `#0a0a0a`
- No color accents. The palette is strictly monochromatic with warm undertones
- Text selection is inverted: off-white background, black text

### Typography

**Fonts:**
- Headings: [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) (Google Fonts)
- Body / UI: [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (Google Fonts)

**Scale:**

| Element | Font | Size | Notes |
|---|---|---|---|
| Hero heading | Instrument Serif | `clamp(48px, 8vw, 72px)` | Weight 400, tracking -0.02em, line-height 1.05 |
| Section heading | Instrument Serif | `clamp(32px, 5vw, 48px)` | Weight 400, line-height 1.2 |
| Card heading | Instrument Serif | 24px | Weight 400 |
| Body text | JetBrains Mono | 15px | Line-height 1.7 |
| Description text | JetBrains Mono | 16px | Color: gray |
| Section label | JetBrains Mono | 11px | Uppercase, tracking 0.2em, color: gray |
| Button text | JetBrains Mono | 13px | Uppercase, tracking 0.1em |
| Stat number | Instrument Serif | `clamp(32px, 5vw, 48px)` | Italic |
| Stat label | JetBrains Mono | 11px | Uppercase, tracking 0.15em |

**Rules:**
- All text is weight 400 — never use bold
- Emphasis in headings uses `font-style: italic`, never bold
- Always use `-webkit-font-smoothing: antialiased`

### Layout

- **Container**: max-width 1000px, 24px horizontal padding, centered
- **Hero sections**: `min-height: 100vh`, flex centered
- **Section padding**: 120px vertical (80px on subpages)
- **Section dividers**: `1px solid #1a1a1a` (border-top)
- **Grid gaps**: 48px between columns, 24-48px between rows
- **Mobile breakpoint**: 768px — all grids collapse to single column

### Components

**Buttons:**
- Primary: off-white background, black text, uppercase, monospace, letter-spaced
- Secondary: transparent background, off-white text, 1px gray border
- Padding: 14px 28px
- Hover: `opacity: 0.7`

**Links:**
- No text-decoration — use `border-bottom: 1px solid #6b6b6b` instead
- Hover: border brightens to off-white, opacity drops to 0.7

**Section labels:**
- 11px, uppercase, letter-spacing 0.2em, gray
- Always placed above section content with 48px margin-bottom

**Images:**
- Grayscale by default (`filter: grayscale(100%)`)
- Color on hover (0.3s transition)
- Offset border frame: `::before` pseudo-element, shifted -8px top/left

**Form inputs:**
- Background: `#151515`, border: `1px solid #2a2a2a`
- Focus: border shifts to off-white
- Monospace font, 14px, 16px 20px padding

**Cards/items:**
- No background, no shadow, no border-radius
- Separated by `border-top: 1px solid #6b6b6b`
- 24px top padding

**Writing/list items:**
- 3-column grid: number | title (serif) | date
- Bottom border `#1a1a1a`
- Hover: background shifts to `#0f0f0f` with negative margin bleed

### Inverted Sections

Used for newsletter CTAs and booking sections:
- Background: `#f5f5f0`, text: `#0a0a0a`
- Labels: black at 50% opacity
- Buttons invert: black background, off-white text
- Form inputs invert: black background, off-white text

### Interactions

| Element | Effect | Duration |
|---|---|---|
| Buttons | Opacity → 0.7 | 0.2s ease |
| Links | Border gray → off-white + opacity 0.7 | 0.2s ease |
| Images | Grayscale → color | 0.3s ease |
| List items | Background → #0f0f0f | 0.2s ease |
| Page load | FadeUp (translateY 20px → 0, opacity 0 → 1) | 0.6s ease, staggered 0.1s |

### What This Design Does NOT Use
- Border-radius (everything is square/sharp)
- Box shadows
- Gradients (exception: scroll indicator fade line)
- Color accents
- Icons
- Bold text
- Decorative elements or illustrations
- Multiple font weights

---

## Pages

| Page | File | Purpose |
|---|---|---|
| Homepage | `index.html` | Personal intro, what I'm building, proof, writing, newsletter CTA |
| Consulting | `consulting.html` | 1:1 consulting call booking ($600/session) |
| Newsletter | `newsletter.html` | Leverage Lab newsletter signup |

---

## Assets

- `/logos/` — Client logos (grayscale, brightened via CSS filter)
- Profile image sourced from Slack CDN (grayscale default, color on hover)

---

## Tech

- Vanilla HTML + CSS (no framework, no build step)
- Google Fonts (Instrument Serif + JetBrains Mono)
- ConvertKit API for newsletter subscriptions
- NeetoCal for consulting booking
