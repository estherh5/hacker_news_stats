# Roadmap

Committed doc, not scratch. Kept current by hand as work ships.
**Shipped** = live in production. **Next** = intended, not promised.
**Declined** = decided against, with the reason, so it doesn't get re-proposed.

## Shipped

- **2026-10 — Sign out stays in the open menu until it lands.** The vanilla fleet kit in `src/fleet/` now holds the panel open on "Signing out…" with a spinner while the logout request runs, instead of closing it before the label could show.
- **2026-10 — Signed-in state carries over from the rest of Crystal Prism.** The menu showed signed out for everyone, because it looked for a token in this origin's `localStorage` that the account site stopped writing when sessions became the API's `cp_session` cookie. Decided 2026-10-12: join that cookie session, not a `.crystalprism.io` cookie or a token hand-off (the first sends the cookie to every fleet subdomain; the second brings back script-readable tokens). `checkIfLoggedIn` in `src/main.js` now sends a credentialed `GET /api/user/verify`, and Sign out sends `POST /api/logout`, reads "Signing out…" while it runs, then lands on `account.crystalprism.io/sign-in/?signed-out`. Both requests give up after 4s. An unreachable API still shows the cached username. Needed `hn-stats.crystalprism.io` in api.crystalprism.io's `user.ALLOWED_ORIGINS` (4df3a0a).

- **2026-10 — Fleet apps + account menu and footer.** The hand-ported site menu (top-left) and the profile / My Account / Sign In links are gone; the fleet kit's apps menu sits at the header's trailing end, listing every live app from `crystalprism.io/apps.json` (bundled fallback on failure). Its rows follow the existing Crystal Prism session check: signed in shows the username, Settings (My Account) and Sign out; signed out shows Sign in. The kit footer replaces the static copyright line. Vanilla kit copied byte-identical into `src/fleet/`; tokens in `src/style.scss`.

## Next

## Declined

## Open questions
