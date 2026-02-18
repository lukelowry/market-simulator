# Power Market Simulator

Electricity market simulation for classroom use. Students compete as power plant owners, submitting price offers each period. See [docs/GAME_GUIDE.md](docs/GAME_GUIDE.md) for game rules.

## Setup

```bash
npm install
```

Create `.dev.vars` in the project root:
```
ADMIN_PASSWORD=your-password-here
```

## Run Locally

```bash
npm run dev             # terminal 1
npm run dev:worker      # terminal 2
```

## Publish to the Web

Push to `main` deploys automatically via [Cloudflare Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/).

Set your production admin password once:
```bash
npx wrangler secret put ADMIN_PASSWORD
```

### Fork Quickstart

1. Fork repo, [create a Cloudflare Worker](https://dash.cloudflare.com/) linked to your fork
2. Set build command to `npm run build`
3. Run `npx wrangler secret put ADMIN_PASSWORD`
