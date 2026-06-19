# WORLDVIEW AIS relay

A tiny always-on service that holds one **aisstream.io** WebSocket connection and
serves the latest global ship snapshot over HTTP, so the Vercel app (serverless,
which aisstream won't stream to) can read real AIS over plain HTTP.

- `GET /ships` → `{ items: [...], source: "aisstream-relay", count }`
- `GET /health` → `{ connected, ships, statics, rawMsgs, lastMsgAgoSec }`

## Deploy to Render (free, no credit card)

1. Sign in at **render.com** with GitHub.
2. **New +** → **Web Service** → connect the `Worldview` repo.
3. **Root Directory:** `relay`
4. **Build Command:** `npm install` · **Start Command:** `node index.js`
5. **Instance Type:** Free
6. **Environment** → add `AISSTREAM_API_KEY` = *(your aisstream key)*
7. **Create Web Service.** Render gives a URL like `https://worldview-relay.onrender.com`.
8. Open `…/health` — `connected:true` and a rising `ships` count means aisstream
   is serving this host. 🎉

Then set `RELAY_URL` to that base URL in the Vercel project's env vars.

## Run locally

```bash
cd relay && npm install
AISSTREAM_API_KEY=xxxx node index.js
# curl localhost:8080/health
```
