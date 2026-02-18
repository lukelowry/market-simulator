# Power Market Simulator

Electricity market simulation for classroom use, developed for Dr. Birchfield at Texas A&M University.

Students compete as power plant owners, submitting price offers for their generators each period. The market clears using merit-order dispatch (cheapest generators first), and profits depend on the selected payment method. See [docs/GAME_GUIDE.md](docs/GAME_GUIDE.md) for full game rules and mechanics.

## Architecture

**Frontend:** SvelteKit SPA (`adapter-static`) served from Cloudflare's CDN. No server-side rendering — all routing is client-side.

**Backend:** Cloudflare Workers + Durable Objects in `worker/`. Two DOs handle game state:
- `MarketRoom` — real-time WebSocket game logic per market
- `MarketRegistry` — market listing and discovery

During local development, Vite proxies `/api` requests to the wrangler dev server on port 8787.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up) (Durable Objects are included on the free Workers plan)

## Local Development

```bash
npm install
npm run dev             # SvelteKit frontend (terminal 1)
npm run dev:worker      # Cloudflare Worker (terminal 2)
```

### Admin Password

The admin password is **not** in source control. Set it separately for local and production:

**Local:** Create `.dev.vars` in the project root (gitignored):
```
ADMIN_PASSWORD=your-password-here
```
Wrangler reads this automatically. Restart the worker if you change it.

**Production:** Set as a Cloudflare secret (persists across deploys):
```bash
npx wrangler secret put ADMIN_PASSWORD
```

## Deploy

```bash
npx wrangler login      # first time only
npm run deploy          # builds frontend + deploys worker
```

The first deploy automatically creates the Worker and runs Durable Object migrations.
