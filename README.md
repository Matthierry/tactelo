# Tactelo

Tactelo is the FootyBuilder proof of concept described in PRD v1.4: a mobile-first, free-to-play football prediction game built around three selections and six weekly credits.

## Product journey

- Visitors land directly on **Make picks** and can choose without an account.
- Exactly three selections are required, each from a different fixture.
- Markets are limited to Match Result (1X2) and Under/Over 2.5 Goals.
- Selecting from a fixture locks every other outcome on that fixture; removing the pick unlocks it.
- All six credits must be allocated: one to four on each pick and zero or one on the three-pick combo.
- Login/registration appears only at final submission, with the draft preserved in browser storage.
- The server revalidates snapshot, fixtures, prices, deadline and credits before creating a receipt.
- My picks, overall/gameweek leaderboards, admin feed health, manual score entry and settlement controls are included.

## Data and free-tier architecture

- **Fixture/price feed:** published Google Sheet CSV (`gid=0`).
- **Team colours:** published Google Sheet CSV (`gid=2066031773`).
- **Persistent data:** Cloudflare D1 using the checked-in Drizzle schema and generated migrations.
- **Hosting:** compatible with the free Cloudflare worker/Sites runtime in this repository.
- **Scheduled imports:** GitHub Actions checks at 13:00 and 19:00 Europe/London, with a manual trigger.
- **Fallback:** a clearly labelled demo snapshot keeps the journey testable when the published CSV is empty or unavailable.

No paid feed, licensed club crest, custom domain, wallet, prize or real-money mechanic is required.

## Local development

```bash
npm ci
npm run dev
```

The app uses the demo snapshot when it cannot reach the public Google Sheet. Configure `TACTELO_ADMIN_KEY` to protect import and settlement writes. Copy `.env.example` to a local environment file and never commit secrets.

## Database

The schema covers password-hashed users, sessions, fixture snapshots, fixtures, team colours, markets, submissions, selections, combo allocation, results, leaderboard entries, analytics and audit history. Passwords are derived with PBKDF2/SHA-256 and never stored in plain text.

```bash
npm run db:generate
npm run build
npm run lint
```

## Scheduled import setup

Add these free GitHub repository secrets:

- `TACTELO_APP_URL`: the deployed application origin.
- `TACTELO_ADMIN_KEY`: the same long random value configured on the deployment.

Scheduled imports are staged by default. A manual workflow run can confirm a snapshot as active, preserving the POC rule that submitted gameweeks are not overwritten without explicit confirmation.
