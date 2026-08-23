import { createClient } from "npm:@supabase/supabase-js@2";

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

function normalizeInstagram(handle: string | null) {
  if (!handle) return null;
  const value = handle.trim().replace(/^@+/, "").toLowerCase();
  return value || null;
}

async function graphGet(path: string) {
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? "";
  const url = `https://graph.facebook.com/v21.0/${path}${path.includes("?") ? "&" : "?"}access_token=${token}`;
  const res = await fetch(url);
  return await res.json();
}

async function sendInstagram(igsid: string, text: string) {
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? "";
  const igUserId = Deno.env.get("INSTAGRAM_IG_USER_ID") ?? "me";
  const res = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text },
      access_token: token,
    }),
  });
  return await res.json();
}

async function flushOutbox(supabase: ReturnType<typeof db>, username: string | null, igsid: string) {
  const handle = normalizeInstagram(username);
  let query = supabase
    .from("instagram_outbox")
    .select("*")
    .in("status", ["pending", "needs_customer_message"]);
  if (handle) query = query.eq("instagram_username", handle);
  else query = query.eq("igsid", igsid);
  const { data: rows } = await query;
  for (const row of rows ?? []) {
    const result = await sendInstagram(igsid, row.body);
    if (result.error) {
      await supabase
        .from("instagram_outbox")
        .update({ status: "failed", last_error: result.error.message })
        .eq("id", row.id);
    } else {
      await supabase
        .from("instagram_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          igsid,
          last_error: null,
        })
        .eq("id", row.id);
    }
  }
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

  const payload = await req.json().catch(() => ({}));
  const supabase = db();
  const entries = payload.entry ?? [];

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

      await flushOutbox(supabase, username, igsid);
    }
  }

  return json({ ok: true });
});
