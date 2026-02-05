# Cryptid Fates - Cloudflare Multiplayer Setup

## Overview

We'll use **Cloudflare Workers** + **Durable Objects** for the multiplayer server. This is perfect for games because:
- **Durable Objects** maintain game state between requests
- **WebSocket support** for real-time communication
- **Global edge network** = low latency worldwide
- **No server management** - Cloudflare handles everything
- **Pay-per-use** pricing (generous free tier)

## Architecture

```
Player A (Browser)                    Player B (Browser)
        │                                    │
        └────────► Cloudflare Worker ◄───────┘
                          │
                          ▼
                   Durable Object
                   (GameRoom-12345)
                   - Holds game state
                   - Validates moves
                   - Broadcasts events
```

---

## Step-by-Step Setup

### 1. Create a Cloudflare Account
- Go to https://dash.cloudflare.com/
- Sign up (free tier is fine to start)

### 2. Enable Workers & Durable Objects
1. In dashboard, click **Workers & Pages** in the left sidebar
2. Click **Create Application** → **Create Worker**
3. Name it `cryptid-fates-multiplayer`
4. Click **Deploy** (we'll update the code next)

### 3. Enable Durable Objects
1. Go to **Workers & Pages** → your worker
2. Click **Settings** → **Bindings**
3. Click **Add binding** → **Durable Object namespace**
4. Name: `GAME_ROOMS`
5. Class name: `GameRoom`
6. Click **Save**

### 4. Update Worker Code
1. Go to your worker → **Quick Edit** (or use Wrangler CLI)
2. Replace the code with the contents of `worker.js` (provided below)
3. Click **Save and Deploy**

### 5. Configure Your Game Client
In your game's HTML, add before other scripts:
```html
<script>
  window.MULTIPLAYER_SERVER_URL = 'wss://cryptid-fates-multiplayer.YOUR-SUBDOMAIN.workers.dev';
</script>
```

---

## Files to Deploy

You need TWO files for Cloudflare:

1. **`worker.js`** - The main Worker that routes requests
2. **`wrangler.toml`** - Configuration file (if using Wrangler CLI)

See the code files in this folder for the complete implementation.

---

## Testing Locally

If you want to test before deploying:

1. Install Wrangler CLI: `npm install -g wrangler`
2. Login: `wrangler login`
3. From this folder: `wrangler dev`
4. Opens local server at `localhost:8787`

---

## Dashboard-Only Deployment (No CLI)

If you prefer to use only the Cloudflare Dashboard:

1. Go to **Workers & Pages** → **Create Application**
2. Choose **Create Worker**
3. Click on the worker name after creation
4. Click **Quick Edit**
5. Paste the entire contents of `worker.js`
6. Click **Save and Deploy**

For Durable Objects:
1. Go to worker **Settings** → **Variables**
2. Add a **Durable Object Binding**:
   - Variable name: `GAME_ROOMS`
   - Durable Object class: `GameRoom`

---

## Cost Estimate

Cloudflare Workers pricing (as of 2024):
- **Free tier**: 100,000 requests/day, 10ms CPU time
- **Paid ($5/month)**: 10 million requests, 50ms CPU time

Durable Objects:
- **Free tier**: 1 million requests/month
- **Storage**: $0.20/GB-month

For a card game, you'll likely stay well within free tier during development and early launch.

---

## Troubleshooting

### "Durable Object not found"
- Make sure the binding name in Settings matches the code (`GAME_ROOMS`)
- Make sure class name matches (`GameRoom`)

### WebSocket won't connect
- Check browser console for CORS errors
- Make sure URL starts with `wss://` not `https://`

### "Script exceeded CPU time limit"
- Game logic is taking too long
- Optimize heavy loops or break into smaller chunks
