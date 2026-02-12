# Comprehensive Technical Audit Report

## 1. Ranking Analysis & Formulas
The ranking system in `rssAggregator.js` uses a complex, multi-factor multiplicative model.

### The Formula
```javascript
Total Score = (Base Score + Buzz Boost) * Multipliers

Where:
Base Score = (Freshness + Keyword + Sentiment) * SourceMultiplier
SourceMultiplier = 1 + (SourceScore * CategoryWeight * TierBoost)
```

### Detailed Breakdown
1.  **Freshness (0-3 pts):**
    *   **Smart Mode:** Logistic decay (Half-life: 12h). Drops fast after 12h.
    *   **Legacy Mode:** Linear decay over 26h.
2.  **Source Influence:**
    *   **Tier Boost:** +50% (0.5) for Tier 1 sources (BBC, Reuters, etc.).
    *   **Category Weight:** Boosts specific sources for specific sections (e.g., ESPN for Sports).
3.  **Buzz Boost (Section Specific):**
    *   Applies to Entertainment, Tech, Sports.
    *   `Score = (PositiveMatches * 1.0) - (NegativeMatches * 1.0)`
    *   If `Score < Threshold`, item is effectively hidden (0.01x penalty).
4.  **Multipliers (x1.0 - x5.0):**
    *   **Impact:** GPT-based severity check.
    *   **Proximity:** Boosts local keywords (Chennai, Muscat).
    *   **Temporal:**
        *   **Weekend:** 2.0x (Fri-Sun) for local/events.
        *   **Entertainment:** 2.5x (Always).
    *   **Seen Penalty:** 0.4x (if viewed once), 0.2x (if viewed >3 times).

### Suggestions
*   **Top Stories:** The "Seen Penalty" might be too aggressive (0.4x). Increasing it to 0.7x would keep stories visible longer.
*   **Up Ahead:** Currently relies heavily on the `_forwardScore`. This should be exposed in settings to allow tuning the "Forward Look" bias.

---

## 2. Filtering & "Poor Data" Root Cause
The "Up Ahead" module uses a 3-layer filter in `upAheadService.js`.

### Why Data is "Poor"?
1.  **Strict Date Extraction:** The `extractFutureDate` function requires explicit date strings ("Jan 25", "next Friday"). Most RSS headlines like "Leo Review: A visual treat" don't have future dates, so they are dropped from "Plan My Week".
2.  **Negative Keywords:** The `movies_negative` list filters out "review", "collection", "gossip". This removes 90% of entertainment news, leaving only "Release Date" announcements (which are rare).
3.  **Search Queries:** The `CATEGORY_QUERIES` list in `upAheadService.js` might be too specific (e.g., "Tamil movie release this week").

### Improvement Plan
1.  **Broaden Keywords:** Add "Watch", "Streaming", "Booking" to positive keywords.
2.  **Lenient Date Fallback:** If an item is from a "Planner" category (Movies, Events) and has no date, default it to "This Week" instead of dropping it, provided it passes the sentiment check.

---

## 3. Up Ahead Architecture
*   **Current Flow:**
    1.  `fetchUpAheadData` calls `fetchStaticUpAheadData` (public/data/up_ahead.json).
    2.  Simultaneously fetches live RSS feeds via Proxy.
    3.  Merges both.
*   **Persistence:**
    *   **Browser:** Saves "Hidden" events to `localStorage`.
    *   **Backend:** `scripts/up_ahead.py` *does* append/merge data when running on a server.
    *   **Issue:** If running only in browser, the `public/data/up_ahead.json` never updates. The "Append" logic requested by the user effectively requires the Python script to run periodically (e.g., via GitHub Actions).
*   **Loading Forever:** The `Promise.all` in `fetchUpAheadData` waits for *every* RSS feed. If one proxy hangs, the whole tab freezes.
    *   **Fix:** Implement `Promise.allSettled` or a strict timeout (e.g., 5s) for RSS fetches.

---

## 4. E-Paper & Market
*   **E-Paper:** The summarizer uses Gemini. If the API key is missing or quota exceeded, it fails silently.
    *   **Fix:** Add a "Client-Side" fallback using `window.ai` (Chrome Nano) or a robust error message.
*   **Market:** The robust fallback (Alpha Vantage -> Yahoo -> Static) is good, but the UI needs to clearly indicate *source* and *freshness*.

---

## 5. UI Improvements
1.  **Releasing Soon Tab:** Move the `sections.movies` list to a dedicated tab in `UpAheadPage`.
2.  **PC Settings:** The CSS Grid in `SettingsPage.css` needs `min-width` constraints to prevent icon crushing.
3.  **Fonts/Icons:** Use `rem` units consistently and increase base font size for desktop media queries (`@media (min-width: 1024px)`).
