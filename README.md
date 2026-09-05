# Ubreathe

A small breathing exercise tool you draw with. Press and hold to inhale or exhale — the line grows as you hold, and letting go switches to the next breath. Trace a full shape and you're done with one cycle.

Works as a Chrome extension popup or as a plain website — same files either way.

## Files

- `popup.html` / `index.html` — the app's markup and styles (identical content; `popup.html` is used by the extension, `index.html` by the website, since GitHub Pages and most static hosts look for `index.html` by default)
- `app.js` — all of the app's JavaScript, loaded by both HTML files via `<script src="app.js"></script>`
- `manifest.json` — Chrome extension config (only needed for the extension)
- `icons/` — extension toolbar icons (16/32/48/128px), only needed for the extension

The JS lives in its own file rather than inline because Manifest V3 extensions enforce a Content Security Policy that blocks inline `<script>` execution entirely — this isn't optional, so `app.js` is required for the extension to run at all. The website version reuses the same file so there's only one copy of the logic to maintain.

**Important:** whichever HTML file you're using, `app.js` must sit in the same folder as it — the script tag references it by relative path.

## Modes

**Optimal** — Box breathing, the classic 4-4-4-4 rhythm. Locked to a square, each breath must be held for exactly 4 seconds. Hold longer than 4s and you start earning bonus XP; release before 4s and the shape resets with a "hold longer" prompt.

**Free** — Draw any regular polygon (3–12 sides), at your own pace. No minimum hold time.

**Snake** — Hold and steer with your cursor (or arrow keys / A-D) to curve the line freely, like steering a snake. No fixed shape — the path bends wherever you point.

In every mode: inhale and exhale each get their own permanent color, so a finished shape shows the full alternating pattern once it's done.

## Features

- Per-breath timer that counts up from zero on every hold
- A running log of each breath's duration for the current shape
- A completion popup showing the finished shape and every breath's time
- XP and cycle counters that persist until you hit Reset
- Two-tone audio chime on each breath (mutable), pitched differently for inhale vs. exhale
- A 3-slide first-run tutorial (also reachable anytime via the **?** button)
- Keyboard support: spacebar to hold, arrow keys / A-D to steer in Snake mode
- Fully responsive — works in a 340px extension popup or scaled up in a browser tab

## Running it

### As a website
1. Make sure `index.html` and `app.js` are both uploaded to the same folder in your repo/host.
2. Any static host works: GitHub Pages, Netlify Drop, Vercel, etc.
3. Open the resulting URL — no build step needed.

**GitHub Pages specifically:**
- Upload `index.html` and `app.js` together in one commit (Add file → Upload files) so the site is never live with one file updated and not the other.
- If `index.html` already exists in the repo, uploading a new one with the same name replaces it — GitHub will show it as a modified file in the commit.
- Settings → Pages should have Source set to "Deploy from a branch" → `main` → `/ (root)`.
- After committing, allow ~30–60 seconds for the rebuild, then hard-refresh your browser (Ctrl+Shift+R / Cmd+Shift+R) since Pages/browsers cache aggressively.

### As a Chrome extension
1. Keep `manifest.json`, `popup.html`, `app.js`, and the `icons/` folder together in one folder.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select that folder.
5. The Ubreathe icon appears in your toolbar — click it to open the popup.

To share the extension with someone else, zip the whole folder and have them repeat steps 2–4 with the unzipped contents.

## Notes

- No external services, no analytics, no network calls — everything runs client-side.
- No build tools required; it's plain HTML/CSS/JS.
- Audio uses the Web Audio API and only initializes after a user gesture (tap/click), per browser autoplay rules.
