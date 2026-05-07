// ── Fluffle API Proxy ─────────────────────────────────────────────────────────
// API key lives ONLY here — never sent to the browser.
// Rate limit: 20 requests per IP per hour (best-effort, resets per serverless instance).

const RATE_LIMIT   = 20;          // max requests
const WINDOW_MS    = 60 * 60 * 1000; // 1 hour window
const ipMap        = new Map();   // { ip: { count, resetAt } }

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function checkRateLimit(ip) {
  const now  = Date.now();
  const entry = ipMap.get(ip);

  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (entry.count >= RATE_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 60000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

// Cleanup old entries every ~100 requests to avoid memory growth
let cleanupCounter = 0;
function maybeCleanup() {
  cleanupCounter++;
  if (cleanupCounter % 100 !== 0) return;
  const now = Date.now();
  for (const [key, val] of ipMap.entries()) {
    if (now > val.resetAt) ipMap.delete(key);
  }
}

export default async function handler(req, res) {
  // ── CORS ────────────────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── API KEY ─────────────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  // ── RATE LIMIT ──────────────────────────────────────────────────────────────
  const ip = getIp(req);
  maybeCleanup();
  const limit = checkRateLimit(ip);

  if (!limit.allowed) {
    return res.status(429).json({
      error: {
        type:    "rate_limit_error",
        message: `You've used all ${RATE_LIMIT} free requests this hour. Try again in ${limit.retryAfter} minute${limit.retryAfter === 1 ? "" : "s"} 🧶`
      }
    });
  }

  res.setHeader("X-RateLimit-Remaining", limit.remaining);

  // ── BODY VALIDATION ─────────────────────────────────────────────────────────
  const body = req.body;
  if (!body || !body.messages || !Array.isArray(body.messages)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  // Enforce safe limits — never let the frontend request more than allowed
  const safeBody = {
    ...body,
    model:      "claude-sonnet-4-20250514",
    max_tokens: Math.min(body.max_tokens || 1500, 4096),
  };

  // ── FORWARD TO ANTHROPIC ────────────────────────────────────────────────────
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta":  "web-search-2025-03-05",
      },
      body: JSON.stringify(safeBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic error:", response.status, data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error("Proxy fetch error:", err);
    return res.status(500).json({
      error: { type: "server_error", message: "Could not reach Claude API. Please try again." }
    });
  }
}
