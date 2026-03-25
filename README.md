# Court Cash HQ

Court Cash HQ is a mobile-first NBA card marketplace game built as a monorepo.
The original CLI prototype remains in `main.py`, `database.py`, and `user.py`
as a reference for scoring, rarity, and pack ideas. The production-facing app
is now split across web, mobile, shared packages, a ranking service, and a
Supabase-ready SQL schema.

## Workspace Layout

- `apps/web`: Next.js web application with ranking, collection, shop,
  marketplace, profile, and admin views.
- `apps/mobile`: Expo mobile application with the same core surfaces.
- `packages/domain`: Shared TypeScript contracts, ranking helpers, and mock
  seed data used by both clients.
- `packages/ui`: Shared web UI primitives and theme tokens.
- `services/ranking`: FastAPI service for rankings, wallets, packs, and the
  marketplace.
- `supabase/migrations`: Postgres schema for a Supabase deployment.

## Quick Start

### Web and Mobile

```bash
pnpm install
pnpm dev:web
pnpm dev:mobile
```

### API

```bash
cd services/ranking
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload
```

### Validation

```bash
pnpm typecheck
pnpm --filter @court-cash/web build
cd services/ranking && pytest
```

## Notes

- All economy-changing actions are routed through the FastAPI service.
- The SQL schema targets Postgres and is organized for Supabase deployment.
- The clients can fall back to shared mock data if the API is unavailable during
  local UI work.
