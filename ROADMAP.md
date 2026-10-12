# Roadmap

Committed doc, not scratch. Kept current by hand as work ships.
**Shipped** = live in production. **Next** = intended, not promised.
**Declined** = decided against, with the reason, so it doesn't get re-proposed.

## Shipped

- **2026-10 — Fleet apps + account menu and footer.** The hand-ported site menu (top-left) and the profile / My Account / Sign In links are gone; the fleet kit's apps menu sits at the header's trailing end, listing every live app from `crystalprism.io/apps.json` (bundled fallback on failure). Its rows follow the existing Crystal Prism session check: signed in shows the username, Settings (My Account) and Sign out; signed out shows Sign in. The kit footer replaces the static copyright line. Vanilla kit copied byte-identical into `src/fleet/`; tokens in `src/style.scss`.

## Next

## Declined

## Open questions

- **Does the Crystal Prism session ever reach this origin?** `checkIfLoggedIn` in `src/main.js` reads `localStorage.token`, but sign-in happens on `account.crystalprism.io`, a different origin since the apps moved to subdomains, so this page likely always shows the signed-out menu. The sign-out's `sessionStorage` `account-request` hand-off has the same origin gap. Settled by deciding whether legacy accounts should carry across subdomains (a cookie on `.crystalprism.io` or a token hand-off) or be retired.
