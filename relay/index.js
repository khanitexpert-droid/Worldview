// WORLDVIEW AIS relay
// ---------------------------------------------------------------------------
// aisstream.io is free and UNLIMITED but only streams to normal connections —
// it sends nothing to Vercel's serverless servers. This tiny always-on service
// holds ONE persistent aisstream WebSocket connection, keeps the latest global
// ship snapshot in memory, and serves it over plain HTTP:
//
//   GET /ships   -> { items: [...], source: "aisstream-relay", count }
//   GET /health  -> { connected, ships, statics, rawMsgs, lastMsgAgoSec }
//
// The Vercel app fetches /ships (plain HTTP works from anywhere) and renders +
// interpolates exactly as before. Deploy this to any always-on Node host
// (Render free tier works). Set AISSTREAM_API_KEY in the host's env.
// ---------------------------------------------------------------------------

const http = require("http");
const WebSocket = require("ws");

const KEY = process.env.AISSTREAM_API_KEY;
const PORT = process.env.PORT || 8080;
const MAX_SHIPS = 6000;

const NAV_STATUS = {
  0: "UNDER WAY (ENGINE)",
  1: "AT ANCHOR",
  2: "NOT UNDER COMMAND",
  3: "RESTRICTED MANOEUVRE",
  4: "CONSTRAINED BY DRAUGHT",
  5: "MOORED",
  6: "AGROUND",
  7: "FISHING",
  8: "UNDER WAY (SAILING)",
};

// MMSI MID (first 3 digits) -> flag. Common maritime nations.
const MID_FLAG = {
  "201": "ALBANIA", "205": "BELGIUM", "209": "CYPRUS", "211": "GERMANY",
  "219": "DENMARK", "224": "SPAIN", "226": "FRANCE", "227": "FRANCE",
  "232": "UK", "233": "UK", "235": "UK", "236": "GIBRALTAR", "237": "GREECE",
  "238": "CROATIA", "244": "NETHERLANDS", "245": "NETHERLANDS", "247": "ITALY",
  "248": "MALTA", "249": "MALTA", "256": "MALTA", "257": "NORWAY",
  "258": "NORWAY", "259": "NORWAY", "265": "SWEDEN", "266": "SWEDEN",
  "269": "SWITZERLAND", "271": "TURKEY", "273": "RUSSIA", "304": "ANTIGUA",
  "305": "ANTIGUA", "308": "BAHAMAS", "309": "BAHAMAS", "311": "BAHAMAS",
  "316": "CANADA", "338": "USA", "351": "PANAMA", "352": "PANAMA",
  "353": "PANAMA", "354": "PANAMA", "355": "PANAMA", "356": "PANAMA",
  "357": "PANAMA", "366": "USA", "367": "USA", "368": "USA", "369": "USA",
  "370": "PANAMA", "371": "PANAMA", "372": "PANAMA", "373": "PANAMA",
  "374": "PANAMA", "412": "CHINA", "413": "CHINA", "416": "TAIWAN",
  "431": "JAPAN", "432": "JAPAN", "440": "S.KOREA", "441": "S.KOREA",
  "477": "HONG KONG", "525": "INDONESIA", "563": "SINGAPORE",
  "564": "SINGAPORE", "565": "SINGAPORE", "566": "SINGAPORE", "574": "VIETNAM",
  "636": "LIBERIA", "637": "LIBERIA", "657": "NIGERIA", "710": "BRAZIL",
  "725": "CHILE", "773": "URUGUAY",
};
const flagOf = (mmsi) => MID_FLAG[String(mmsi).slice(0, 3)];

function shipType(t) {
  if (t == null) return "VESSEL";
  if (t >= 70 && t <= 79) return "CARGO";
  if (t >= 80 && t <= 89) return "TANKER";
  if (t >= 60 && t <= 69) return "PASSENGER";
  if (t >= 40 && t <= 49) return "HIGH-SPEED";
  if (t >= 50 && t <= 59) return "SPECIAL CRAFT";
  if (t === 30) return "FISHING";
  if (t === 31 || t === 32 || t === 52) return "TUG";
  if (t === 36) return "SAILING";
  if (t === 37) return "PLEASURE CRAFT";
  return "VESSEL";
}

// live state
const positions = new Map(); // mmsi -> { id,name,lat,lon,heading,speed,navStatus,ts }
const statics = new Map(); // mmsi -> { Type, ImoNumber, ... }
let connected = false;
let rawMsgs = 0;
let lastMsg = 0;
let backoff = 5000; // reconnect delay; grows on repeated failures, resets on success
let lastEvent = "starting up"; // last connect/close/error reason (for /health)

function connect() {
  if (!KEY) {
    console.error("FATAL: AISSTREAM_API_KEY not set");
    return;
  }
  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

  ws.on("open", () => {
    connected = true;
    backoff = 5000; // healthy connection — reset the backoff
    lastEvent = "connected";
    console.log("aisstream connected");
    ws.send(
      JSON.stringify({
        APIKey: KEY,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      })
    );
  });

  ws.on("message", (raw) => {
    rawMsgs++;
    lastMsg = Date.now();
    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const meta = m.MetaData;
    if (!meta || typeof meta.MMSI !== "number") return;

    if (m.MessageType === "ShipStaticData" && m.Message.ShipStaticData) {
      if (statics.size < 100000 || statics.has(meta.MMSI)) {
        statics.set(meta.MMSI, m.Message.ShipStaticData);
      }
      return;
    }

    const pr = m.Message.PositionReport;
    if (!pr) return;
    const lat = pr.Latitude != null ? pr.Latitude : meta.latitude;
    const lon = pr.Longitude != null ? pr.Longitude : meta.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") return;

    if (positions.size >= MAX_SHIPS && !positions.has(meta.MMSI)) {
      positions.delete(positions.keys().next().value); // drop oldest
    }
    positions.set(meta.MMSI, {
      id: String(meta.MMSI),
      name: (meta.ShipName || "").trim() || `MMSI ${meta.MMSI}`,
      lat,
      lon,
      heading: pr.Cog != null ? pr.Cog : pr.TrueHeading != null ? pr.TrueHeading : 0,
      speed: pr.Sog != null ? pr.Sog : 0,
      navStatus: pr.NavigationalStatus,
      ts: meta.time_utc ? Date.parse(meta.time_utc) : Date.now(),
    });
  });

  // schedule at most ONE reconnect per connection, with exponential backoff so
  // a refused connection can't turn into a request storm (which trips
  // aisstream's 429 rate limit).
  let scheduled = false;
  const reconnect = (why) => {
    if (scheduled) return;
    scheduled = true;
    connected = false;
    lastEvent = why;
    console.log(`aisstream ${why} — reconnecting in ${Math.round(backoff / 1000)}s`);
    setTimeout(connect, backoff);
    backoff = Math.min(Math.round(backoff * 1.8), 60000); // cap at 60s
  };
  ws.on("close", () => reconnect("closed"));
  ws.on("error", (e) => reconnect(`error: ${e.message}`));
}
connect();

// drop vessels we haven't heard from in 15 min so the snapshot stays current
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [mmsi, s] of positions) if (s.ts < cutoff) positions.delete(mmsi);
}, 60 * 1000);

function snapshot() {
  const items = [];
  for (const [mmsi, s] of positions) {
    const st = statics.get(mmsi);
    items.push({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      heading: s.heading,
      speed: s.speed,
      type: shipType(st && st.Type),
      status: s.navStatus != null ? NAV_STATUS[s.navStatus] : undefined,
      flag: flagOf(mmsi),
      imo: (st && st.ImoNumber) || undefined,
      timePosition: s.ts,
    });
  }
  return items;
}

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const url = (req.url || "").split("?")[0];

    if (url === "/health" || url === "/") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          connected,
          ships: positions.size,
          statics: statics.size,
          rawMsgs,
          lastMsgAgoSec: lastMsg ? Math.round((Date.now() - lastMsg) / 1000) : null,
          lastEvent,
          hasKey: !!KEY,
        })
      );
      return;
    }
    if (url === "/ships") {
      const items = snapshot();
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=15");
      res.end(JSON.stringify({ items, source: "aisstream-relay", count: items.length }));
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  })
  .listen(PORT, () => console.log("relay listening on", PORT));
