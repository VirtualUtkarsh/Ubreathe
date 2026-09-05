# Ubreathe

A small breathing exercise tool you draw with. Press and hold to inhale or exhale — the line grows as you hold, and letting go switches to the next breath. Trace a full shape and you're done with one cycle.

Works as a Chrome extension popup or as a plain website — same two files either way.

## Files

- `popup.html` — the entire app (HTML, CSS, and JS in one file, no build step, no dependencies)
- `manifest.json` — Chrome extension config (only needed if you're loading it as an extension)

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
Just open `popup.html` in any browser — it's fully self-contained. To host it:
1. Rename `popup.html` to `index.html`.
2. Upload it to any static host (GitHub Pages, Netlify Drop, Vercel, etc.).
3. Share the resulting URL.

### As a Chrome extension
1. Keep `manifest.json` and `popup.html` together in one folder.
2. Go to `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the folder.
5. The Ubreathe icon appears in your toolbar — click it to open the popup.

To share the extension with someone else, zip the folder and have them repeat steps 2–4 with your zip's contents.

## Notes

- No external services, no analytics, no network calls — everything runs client-side.
- No build tools required; it's plain HTML/CSS/JS.
- Audio uses the Web Audio API and only initializes after a user gesture (tap/click), per browser autoplay rules.
