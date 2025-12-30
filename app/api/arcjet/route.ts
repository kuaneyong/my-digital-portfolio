import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/node";
import { isSpoofedBot } from "@arcjet/inspect";

const aj = arcjet({
  key: process.env.ARCJET_KEY!, // Get your site key from https://app.arcjet.com
  rules: [
    // Shield protects your app from common attacks e.g. SQL injection
    shield({ mode: "LIVE" }),
    // Create a bot detection rule
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE",
      ],
    }),
    tokenBucket({
      mode: "LIVE",
      refillRate: 5,
      interval: 10,
      capacity: 10,
    }),
  ],
});

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleDecision(req: Request) {
  const decision = await aj.protect(req as any, { requested: 5 });
  console.log("Arcjet decision", decision);

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return jsonResponse({ error: "Too many requests" }, 429);
    }
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  if (decision.ip?.isHosting()) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  if (decision.results?.some(isSpoofedBot)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  return jsonResponse({ message: "Hello world" }, 200);
}

export async function GET(req: Request) {
  return handleDecision(req);
}

export async function POST(req: Request) {
  return handleDecision(req);
}
