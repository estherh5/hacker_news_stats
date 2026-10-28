# Roadmap

Committed doc, not scratch. Kept current by hand as work ships.
**Shipped** = live in production. **Next** = intended, not promised.
**Declined** = decided against, with the reason, so it doesn't get re-proposed.

## Shipped

- **2026-10 — Whole-app critique + audit; live data again.** impeccable 18/40 → **31/40**, 2026-10-28 (snapshots in `.impeccable/critique/`). The P0 and P1s are fixed: periods are an `aria-pressed` group with 44px targets and focus rings, every panel ends in its chart, an empty message or Try again, a stale response can't overwrite a newer period, phone contrast is fixed, and the bubble chart starts at 0 with only the five users on its axis. With the scraper running hourly again (hacker_news_scrape), the archive note is gone and the page opens on past day under "From hourly snapshots of the Hacker News front page." Charts explain themselves (horizontal bars with whole titles, axis titles, bubble-size subtitle), sit in a 2x2 grid at 900px+, and live in a `<main>` with presentation-role layout tables and Highcharts' accessibility module. A panel drawn from the saved copy after a failed fetch says so, with Try again.
- **2026-10 — Sign out stays in the open menu until it lands.** The vanilla fleet kit in `src/fleet/` now holds the panel open on "Signing out…" with a spinner while the logout request runs, instead of closing it before the label could show.
- **2026-10 — Signed-in state carries over from the rest of Crystal Prism.** The menu showed signed out for everyone, because it looked for a token in this origin's `localStorage` that the account site stopped writing when sessions became the API's `cp_session` cookie. Decided 2026-10-12: join that cookie session, not a `.crystalprism.io` cookie or a token hand-off (the first sends the cookie to every fleet subdomain; the second brings back script-readable tokens). `checkIfLoggedIn` in `src/main.js` now sends a credentialed `GET /api/user/verify`, and Sign out sends `POST /api/logout`, reads "Signing out…" while it runs, then lands on `account.crystalprism.io/sign-in/?signed-out`. Both requests give up after 4s. An unreachable API still shows the cached username. Needed `hn-stats.crystalprism.io` in api.crystalprism.io's `user.ALLOWED_ORIGINS` (4df3a0a).

- **2026-10 — Fleet apps + account menu and footer.** The hand-ported site menu (top-left) and the profile / My Account / Sign In links are gone; the fleet kit's apps menu sits at the header's trailing end, listing every live app from `crystalprism.io/apps.json` (bundled fallback on failure). Its rows follow the existing Crystal Prism session check: signed in shows the username, Settings (My Account) and Sign out; signed out shows Sign in. The kit footer replaces the static copyright line. Vanilla kit copied byte-identical into `src/fleet/`; tokens in `src/style.scss`.

## Next

- **"As of" time under the period buttons.** The page never says when the data was scraped (critique 2026-10-28, H1 scored 2). Needs a last-scrape endpoint in hacker_news_scrape's API (latest `Feed.created`), then a line under `#period-note` in `src/index.html`. Also `initialize` in `src/main.js` keeps each period in `sessionStorage` for the whole session, so a tab left open never sees a newer scrape.
- **Post types as a stat line, not a pie.** `displayPieChart` in `src/main.js` spends a panel on 89:1; Show HN and Ask HN are 1.1:1 apart and 1.4:1 on the phone's yellow. Replace with "89 articles · 1 Show HN · 0 Ask HN" or a thin stacked bar.
- **Bars in the palette.** `displayBarChart` uses Highcharts' stock `#2caffe` (3.3:1 on violet, 2.3:1 on yellow); at 390px gridlines cross the value labels. Pick per-ground fills in `src/style.scss` like the bubbles, checking data-label contrast inside the bar.
- **Word cloud drops contraction fragments.** `re`, `ve`, `doesn`, `us` come from hacker_news_scrape's `comment_words` tokenizer splitting on apostrophes; fix there, not in `displayWordCloud`.
- **Period in the URL.** `selectedButton` in `src/main.js` is not reflected in the URL, so a view can't be shared and a reload resets to past day.

## Declined

## Open questions
