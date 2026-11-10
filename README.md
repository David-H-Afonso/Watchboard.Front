# Watchboard Front

Independent **React 19 / TypeScript / Vite** repository. The .NET API is a separate repository. Frontend install/build/lint/unit tests need no parent workspace files or API checkout.

## Start

Node.js **22.12+ or 24+**, current security patches.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5333`. For real data, run Watchboard API at `127.0.0.1:5197`; Vite proxies `/api` without permissive CORS. First access configures the API's **admin** password locally. No credentials in this repository or browser build environment.

## Checks

```sh
npm run build
npm run lint
npm run test
npm run security:deps
```

`npm run preview` also uses 5333. Production assets are in ignored `dist`. Deployment must serve `/api` on the same origin or explicitly design a secure proxy; the current local API is not an internet-ready service.

## UI and boundaries

- Compact overview, independent versions and price-detail views.
- Paste GitHub/AllKeyShop/Steam URLs; explicit keys versus official Steam values/targets, current source selection and observed history.
- Reusable, creatable project/location selectors. Known location aliases reuse **Linux**, **Steam Deck**, etc.; project name, category and installation provenance remain separate. One watch represents one installation, not an implied remote probe.
- Widget rules select owned locations (`null`: all including unassigned; `[]`: no software). The default update-only rule requires a known installed version and a fresh, successful newer release; it excludes failed detections too. The unsaved preview uses the same eligibility rules.
- Reciprocal verified Steam/AllKeyShop sources keep separate goals/history. Unverified matches have an explicit review/retry dialog; similar names are never presented as proof of the same edition.
- Market offers prefer Steam activation (key or gift), then an explicitly labelled supported PC DRM when no eligible Steam offer exists. Accounts and gift cards remain excluded; restricted languages such as English-only are visible.
- New market watches choose the lowest eligible published card/PayPal **total**, already including fees. Platform, delivery and payment provenance are preserved per reading. Optional details show the breakdown without permanent tutorial/disclaimer paragraphs.
- A grouped game defaults to a real fresh official Steam offer whenever it costs the same or less than the chosen market offer. Raw observations and source-specific goals are never clamped, rewritten or transferred. Explicit source inspection remains available.
- Daily API-side price collection and explicit manual refresh; navigating reads saved observations, not the stores. Lifetime and 730-day observed minima include their dates. The two-year chart exposes partial coverage and leaves missing data as gaps; no fabricated backfill or complete historical-price claim.
- Configurable web widget, owned configuration **v2** export (portable location names, not runtime IDs), v1/v2 import and administrator user management. Multiple installations are not collapsed by the frontend.
- Operation success toasts expire; actionable errors stay near the operation.
- Source network work does not disable unrelated add/remove controls.
- Owner-bound async actions, latest-wins/cancelled reads, authoritative post-write confirmation, per-user **v4** cache and cleanup after logout/auth denial. Earlier snapshots without platform/delivery/language metadata are not reinterpreted as current data. No passwords/cookies stored in localStorage.
- Loaded authenticated frontend can fall back to public release APIs permitting CORS, then dated owned cache. Offline prices never confirm goals. Reload without the API cannot authenticate a new session. No native Windows/Plasma client or offline PWA shell is claimed.

The local `src/test/fixtures/version-cases.json` is this repo's small snapshot of the API comparison contract. It intentionally matches the API test fixture, but imports no sibling repo. UI/contract unit tests are not proof of backend authorization; the separate API repository exercises those policies with actual HTTP middleware/cookies/SQLite.

The current frontend expects the additive prices-v4 API contract (`src/types.ts`, `src/services/api.ts`), including actual platform/delivery/language and minimum-context fields. Unique exact full public product metadata drives automatic reciprocal matching; shared-ID registry membership is not required for every game. Missing prices do not mean missing identity. Public Steam appdetails does not supply two-year price history, and no permitted fee-inclusive AllKeyShop backfill is configured. Optional history information makes that coverage limitation available without a permanent lecture. Single-day readings are compact, not a huge empty plot.

Fonts are locally bundled; no unrequested UI framework, remote font tracking or motion library. Build artifacts, caches, environment credentials and runtime data must not be committed. No distribution license has been selected.
