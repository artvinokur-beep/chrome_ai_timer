# AI Footprint Timer (Chrome Extension)

A Chrome extension that tracks **active** time spent on popular AI assistant websites and estimates environmental impact based on simple conversion factors.

## What it does

- Tracks active usage on configured AI domains (ChatGPT, Claude, Grok, Gemini, Copilot, Perplexity, Poe).
- Maintains:
  - **Current session timer** (per-use on the currently active AI site).
  - **Cumulative timer** across all AI site usage.
  - **Per-site totals**.
- Converts cumulative time to estimated:
  - CO₂ emissions
  - Water usage
  - Energy usage
- Sends periodic reminder notifications each time cumulative usage crosses another 30-minute milestone.

## How tracking works

Usage only increments when:

1. The browser window is focused.
2. The active tab is on one of the tracked AI domains.

Switching away from tracked sites ends the current session timer and starts a new session timer when you return.

## Environmental conversion factors

These are intentionally simple defaults and can be tuned in code (`IMPACT_FACTORS` in `background.js` and `popup.js`):

- CO₂: `0.35 g / minute`
- Water: `8.5 ml / minute`
- Energy: `0.18 Wh / minute`

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder (`chrome_ai_timer`).

## Next improvements (optional)

- Add options page to customize:
  - tracked sites
  - conversion factors
  - reminder interval
- Add export/reporting over day/week/month.
- Add user-idle detection for stricter active-time measurement.

## Packaged install file

A packaged ZIP is included at:

- `dist/ai-footprint-timer-chrome.zip`

You can use this ZIP to distribute the extension source bundle or upload to the Chrome Web Store developer dashboard.
For local installation in Chrome, unzip it and use **Load unpacked** from `chrome://extensions`.
