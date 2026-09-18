import { createClient } from "npm:@supabase/supabase-js@2";
import {
  flushOutbox,
  flushOutboxByOrderNumber,
  graphGet,
  normalizeInstagram,
  parseOrderRef,
  verifyWebhookSignature,
} from "../_shared/instagram.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

function extractOrderNumber(event: Record<string, unknown>) {
  const message = event.message as Record<string, unknown> | undefined;
  const referral = (event.referral ?? message?.referral) as
    | Record<string, unknown>
    | undefined;
  const fromRef = parseOrderRef(referral?.ref as string | undefined);
  if (fromRef) return fromRef;

  const text = typeof message?.text === "string" ? message.text : "";
  const fromText = text.match(/\bOrder\s+([MY]\d{4})\s+is\s+placed\b/i);
  return fromText?.[1]?.toUpperCase() ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const verifyToken = Deno.env.get("INSTAGRAM_VERIFY_TOKEN") ?? "";

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { headers: corsHeaders });
    }
    return json({ error: "Verification failed" }, 403);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  if (!(await verifyWebhookSignature(req, rawBody))) {
    return json({ error: "Invalid signature" }, 403);
  }

  const payload = JSON.parse(rawBody || "{}");
  const supabase = db();
  const entries = payload.entry ?? [];
  let flushed = 0;

  for (const entry of entries) {
    const messaging = entry.messaging ?? [];
    for (const event of messaging) {
      const igsid = event.sender?.id as string | undefined;
      if (!igsid || event.message?.is_echo) continue;

      let username: string | null = null;
      try {
        const profile = await graphGet(`${igsid}?fields=username`);
        username = normalizeInstagram(profile.username ?? null);
      } catch {
        username = null;
      }

      await supabase.from("instagram_contacts").upsert(
        { igsid, username, last_seen_at: new Date().toISOString() },
        { onConflict: "igsid" },
      );

      const orderNumber = extractOrderNumber(event);
      if (orderNumber) {
        const byOrder = await flushOutboxByOrderNumber(supabase, orderNumber, igsid);
        flushed += byOrder.sent;
      }

      const result = await flushOutbox(supabase, username, igsid);
      flushed += result.sent;
    }
  }

  return json({ ok: true, flushed });
});
