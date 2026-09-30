# Cartbop

## Landing site
- Static landing page lives in `site/` (plain HTML/CSS, no build step).
- Waitlist uses Netlify Forms (`waitlist-operator`, `waitlist-runner`).
- Netlify publish dir: `site` (see `netlify.toml`).

## V2 redesign (branch `redesign/prestigesf-v2`)
- `site/index.html` + `site/assets/` (styles.css, app.js, pages.css, mark.svg), `site/thanks.html`, `site/404.html`, `site/_headers` (CSP: self only).
- Fonts are self-hosted from `site/fonts/` (Bricolage Grotesque, Instrument Sans, JetBrains Mono — SIL OFL 1.1, licenses alongside). No third-party requests, no trackers.
- The interactive order example runs entirely in the browser and is labeled "Example · simulated": no money moves and the example receipt is unsigned.
- Both Netlify forms are unchanged in name, fields, honeypot, hidden `form-name` and `action`; they submit with a plain POST when JavaScript is off.
