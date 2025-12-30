import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/node";
import { isSpoofedBot } from "@arcjet/inspect";

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:SEARCH_ENGINE"],
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
  // Parse URL for test flags
  const url = new URL((req as any).url || '', 'http://localhost');

  // Temporary: force responses for local testing
  const force = url.searchParams.get('force');
  if (force === 'rate') return jsonResponse({ error: 'Too many requests (forced)' }, 429);
  if (force === 'bot') return jsonResponse({ error: 'No bots allowed (forced)' }, 403);

  const decision = await aj.protect(req as any, { requested: 5 });
  console.log('Arcjet decision', decision);

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return jsonResponse({ error: 'Too many requests' }, 429);
    }
    if (decision.reason.isBot()) {
      return jsonResponse({ error: 'No bots allowed' }, 403);
    }
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  if (decision.ip?.isHosting()) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  if (decision.results?.some(isSpoofedBot)) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  // Debug option
  const debug = url.searchParams.has('debug');
  if (debug) {
    const debugInfo = {
      isDenied: !!decision.isDenied?.(),
      reasonIsRateLimit: !!decision.reason?.isRateLimit?.(),
      reasonIsBot: !!decision.reason?.isBot?.(),
      ipIsHosting: !!decision.ip?.isHosting?.(),
      resultsCount: Array.isArray(decision.results) ? decision.results.length : 0,
    };
    return jsonResponse({ debug: debugInfo }, 200);
  }

  return jsonResponse({ message: 'Bot not detected' }, 200);
}

export async function GET(req: Request) {
  return handleDecision(req);
}

export async function POST(req: Request) {
  return handleDecision(req);
}
